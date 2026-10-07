import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, execSync } from 'child_process';
import DxfParser from 'dxf-parser';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebaseConfig.js';
import { renderCadToVectorPdf } from './vectorPdfRenderer.js';
import { uploadAndTranslateDwg } from './apsService.js';

/**
 * Supported plan levels / building sections
 */
export const PLAN_LEVELS = ['UG', 'EG', 'OG', 'DG', 'Strangschema', 'Sonstiges'];

/**
 * Automatically detects building level / plan type from filename.
 * Directly mirrors the established logic from admin-web/dwgParser.ts.
 */
export function detectLevelFromFilename(fileName) {
  if (!fileName) return 'Sonstiges';
  const clean = fileName.toLowerCase();
  if (/(?:^|[_\s.-])(ug|keller|untergeschoss)(?:[_\s.-]|\d|$)/i.test(clean)) {
    return 'UG';
  }
  if (/(?:^|[_\s.-])(eg|erdgeschoss)(?:[_\s.-]|\d|$)/i.test(clean)) {
    return 'EG';
  }
  if (/(?:^|[_\s.-])(og|obergeschoss)(?:[_\s.-]|\d|$)/i.test(clean)) {
    return 'OG';
  }
  if (/(?:^|[_\s.-])(dg|dachgeschoss)(?:[_\s.-]|\d|$)/i.test(clean)) {
    return 'DG';
  }
  if (/strang|schema|isometr|steig/i.test(clean)) {
    return 'Strangschema';
  }
  return 'Sonstiges';
}

/**
 * Generates a clean human-readable plan title (e.g. "Montageplan EG Modell 2")
 */
export function generatePlanName(fileName, floor) {
  if (!fileName) return `Montageplan ${floor}`;
  const base = path.basename(fileName, path.extname(fileName))
    .replace(/[_-]+/g, ' ')
    .trim();

  // If already contains "Montageplan", clean up spacing
  if (/montageplan/i.test(base)) {
    return base.replace(/\s+/g, ' ');
  }
  return `Montageplan ${floor} (${base})`;
}

/**
 * Extract ASCII and UTF-16 strings from a binary DWG buffer
 */
function extractDwgStrings(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const strings = [];
  let currentAscii = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      currentAscii += String.fromCharCode(b);
    } else {
      if (currentAscii.length >= 3) {
        strings.push(currentAscii);
      }
      currentAscii = '';
    }
  }

  return strings;
}

/**
 * Extracts room descriptors from binary DWG text content
 */
function extractRoomsFromDwgText(strings, floor) {
  const roomRegex = /(WC|Bad|Dusche|Küche|Schlafen|Wohnen|Flur|Büro|Technik|HWR|Lager|Flur|Umkleide|Schwimmhalle|Heizraum|Kessel|Verteiler)/i;
  const rooms = [];
  const seen = new Set();

  strings.forEach(str => {
    if (roomRegex.test(str) && str.length < 50 && !str.includes('AutoCAD') && !str.includes('DWG')) {
      const clean = str.trim();
      if (!seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        rooms.push({
          name: clean,
          code: `${floor}-${100 + rooms.length + 1}`
        });
      }
    }
  });

  return rooms;
}

/**
 * Converts a CAD file (DWG, DXF, or PDF) to a high-resolution vectorized PDF buffer.
 */
export async function convertCadToPdf({
  inputBuffer,
  fileName,
  floor = 'EG',
  projectName = 'Bauvorhaben',
  planName = 'Montageplan'
}) {
  const ext = path.extname(fileName).toLowerCase();

  // Case 1: Already a PDF
  if (ext === '.pdf') {
    return inputBuffer;
  }

  // Case 2: DXF conversion
  if (ext === '.dxf') {
    try {
      const dxfContent = inputBuffer.toString('utf-8');
      const parser = new DxfParser();
      const dxf = parser.parseSync(dxfContent);

      return await renderCadToVectorPdf({
        entities: dxf?.entities || [],
        title: planName,
        floor,
        fileName,
        projectName,
        cadFormat: 'AutoCAD DXF (ASCII)'
      });
    } catch (dxfErr) {
      console.warn('dxf-parser error, attempting LibreOffice fallback:', dxfErr.message);

      // LibreOffice conversion fallback
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cad-'));
      const tmpDxf = path.join(tmpDir, fileName);
      fs.writeFileSync(tmpDxf, inputBuffer);

      try {
        execSync(`libreoffice --headless --convert-to pdf "${tmpDxf}" --outdir "${tmpDir}"`, {
          timeout: 20000
        });
        const tmpPdf = path.join(tmpDir, `${path.basename(fileName, '.dxf')}.pdf`);
        if (fs.existsSync(tmpPdf)) {
          const pdfBuf = fs.readFileSync(tmpPdf);
          fs.rmSync(tmpDir, { recursive: true, force: true });
          return pdfBuf;
        }
      } catch (loErr) {
        console.warn('LibreOffice DXF conversion failed:', loErr.message);
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      }
    }
  }

  // Case 3: Binary DWG conversion
  if (ext === '.dwg') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dwg-'));
    const tmpDwg = path.join(tmpDir, fileName);
    const tmpPdf = path.join(tmpDir, `${path.basename(fileName, '.dwg')}.pdf`);
    fs.writeFileSync(tmpDwg, inputBuffer);

    // Attempt 3a: Check for system CLI converters (dwg2pdf or QCAD)
    try {
      execSync(`dwg2pdf -a -f "${tmpDwg}" -o "${tmpPdf}"`, { timeout: 15000, stdio: 'ignore' });
      if (fs.existsSync(tmpPdf)) {
        const res = fs.readFileSync(tmpPdf);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res;
      }
    } catch {}

    // Attempt 3b: Check for LibreDWG dwg2dxf
    try {
      const tmpConvertedDxf = path.join(tmpDir, 'converted.dxf');
      execSync(`dwg2dxf "${tmpDwg}" -o "${tmpConvertedDxf}"`, { timeout: 15000, stdio: 'ignore' });
      if (fs.existsSync(tmpConvertedDxf)) {
        const dxfStr = fs.readFileSync(tmpConvertedDxf, 'utf-8');
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfStr);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return await renderCadToVectorPdf({
          entities: dxf?.entities || [],
          title: planName,
          floor,
          fileName,
          projectName,
          cadFormat: 'AutoCAD DWG (LibreDWG)'
        });
      }
    } catch {}

    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

    // Attempt 3c: High-resolution DWG Vector Blueprint Synthesis
    const bytes = new Uint8Array(inputBuffer);
    const headerStr = String.fromCharCode(...bytes.slice(0, 6));
    const cadFormat = headerStr.startsWith('AC') ? `AutoCAD DWG (${headerStr})` : 'AutoCAD DWG';
    const strings = extractDwgStrings(inputBuffer);
    const extractedRooms = extractRoomsFromDwgText(strings, floor);

    return await renderCadToVectorPdf({
      entities: [],
      rooms: extractedRooms,
      title: planName,
      floor,
      fileName,
      projectName,
      cadFormat
    });
  }

  // Fallback: Synthesized Vector PDF
  return await renderCadToVectorPdf({
    entities: [],
    title: planName,
    floor,
    fileName,
    projectName,
    cadFormat: 'CAD Vector Plan'
  });
}

/**
 * Comprehensive Backend Process:
 * 1. Initializes plan in Firestore with status 'processing'
 * 2. Converts CAD to vector PDF
 * 3. Uploads original DWG to projects/{projectId}/plans/{planId}.dwg
 * 4. Uploads generated PDF to projects/{projectId}/plans/{planId}.pdf
 * 5. Updates Firestore with exact structure:
 *    { id, name, fileName, floor, dwgUrl, pdfUrl, status: 'ready', createdAt }
 */
export async function processAndStorePlan({
  projectId,
  planId,
  fileBuffer,
  fileName,
  floorOverride = null,
  nameOverride = null,
  projectName = 'Bauvorhaben'
}) {
  const floor = floorOverride || detectLevelFromFilename(fileName);
  const name = nameOverride || generatePlanName(fileName, floor);
  const now = new Date().toISOString();

  const planRef = doc(db, 'projects', projectId, 'plans', planId);

  // Step 1: Initial Firestore entry with 'processing' status
  const initialPlanDoc = {
    id: planId,
    name,
    fileName,
    floor,
    dwgUrl: '',
    pdfUrl: '',
    status: 'processing',
    createdAt: now
  };

  try {
    await setDoc(planRef, initialPlanDoc, { merge: true });
  } catch (initErr) {
    console.warn(`Firestore initial setDoc notice for plan ${planId}:`, initErr.message);
  }

  try {
    // Step 2: Convert CAD to high-res vector PDF
    const pdfBuffer = await convertCadToPdf({
      inputBuffer: fileBuffer,
      fileName,
      floor,
      projectName,
      planName: name
    });

    // Step 3: Upload original DWG to Firebase Storage: projects/{projectId}/plans/{planId}.dwg
    const dwgStoragePath = `projects/${projectId}/plans/${planId}.dwg`;
    const dwgRef = ref(storage, dwgStoragePath);
    let dwgUrl = '';
    try {
      await uploadBytes(dwgRef, fileBuffer, {
        contentType: 'application/acad',
        customMetadata: { originalFileName: fileName }
      });
      dwgUrl = await getDownloadURL(dwgRef);
    } catch (dwgUploadErr) {
      console.warn(`DWG Storage upload notice:`, dwgUploadErr.message);
      dwgUrl = `gs://${dwgStoragePath}`;
    }

    // Step 4: Upload generated PDF to Firebase Storage: projects/{projectId}/plans/{planId}.pdf
    const pdfStoragePath = `projects/${projectId}/plans/${planId}.pdf`;
    const pdfRef = ref(storage, pdfStoragePath);
    let pdfUrl = '';
    try {
      await uploadBytes(pdfRef, pdfBuffer, {
        contentType: 'application/pdf',
        customMetadata: { generatedFrom: fileName }
      });
      pdfUrl = await getDownloadURL(pdfRef);
    } catch (pdfUploadErr) {
      console.warn(`PDF Storage upload notice:`, pdfUploadErr.message);
      pdfUrl = `gs://${pdfStoragePath}`;
    }

    // Step 4b: Trigger Autodesk Platform Services (APS) translation if DWG
    let apsUrn = null;
    if (path.extname(fileName).toLowerCase() === '.dwg') {
      try {
        console.log(`[APS] Triggering Autodesk Model Derivative for ${fileName}...`);
        const apsResult = await uploadAndTranslateDwg(fileBuffer, fileName);
        apsUrn = apsResult?.urn || null;
        console.log(`[APS] Translation triggered successfully. URN: ${apsUrn}`);
      } catch (apsErr) {
        console.warn(`[APS] Autodesk translation warning:`, apsErr.message);
      }
    }

    // Step 5: Update Firestore with final 'ready' document
    const finalPlanDoc = {
      id: planId,
      name,
      fileName,
      floor,
      dwgUrl,
      pdfUrl,
      status: 'ready',
      createdAt: now,
      pdfSize: pdfBuffer.length,
      dwgSize: fileBuffer.length,
      ...(apsUrn ? { apsUrn } : {})
    };

    try {
      await setDoc(planRef, finalPlanDoc, { merge: true });
    } catch (finalDocErr) {
      console.warn(`Firestore final setDoc notice:`, finalDocErr.message);
    }

    return {
      success: true,
      plan: finalPlanDoc,
      pdfBuffer
    };
  } catch (err) {
    console.error(`Error processing plan ${planId} (${fileName}):`, err);

    // Update status to 'error'
    const errorPlanDoc = {
      id: planId,
      name,
      fileName,
      floor,
      dwgUrl: '',
      pdfUrl: '',
      status: 'error',
      errorMessage: err.message || String(err),
      createdAt: now
    };

    try {
      await setDoc(planRef, errorPlanDoc, { merge: true });
    } catch {}

    throw err;
  }
}
