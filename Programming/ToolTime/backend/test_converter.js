import fs from 'fs';
import path from 'path';
import {
  detectLevelFromFilename,
  generatePlanName,
  convertCadToPdf,
  processAndStorePlan
} from './cadConverterService.js';

async function runTests() {
  console.log('--- 1. Testing detectLevelFromFilename ---');
  const testCases = [
    { file: 'Hallenbad Weingarten_Montagepläne_UG_Modell_1.dwg', expected: 'UG' },
    { file: '24316_Keller_Heizung.dwg', expected: 'UG' },
    { file: 'Hallenbad Weingarten_Montagepläne_EG_Modell_2.dwg', expected: 'EG' },
    { file: 'Wohnanlage_Erdgeschoss_Lueftung.dxf', expected: 'EG' },
    { file: 'Haus_B_OG_Plan.dwg', expected: 'OG' },
    { file: 'Penthouse_DG_Sanitaer.dwg', expected: 'DG' },
    { file: 'Hallenbad Weingarten_Montagepläne_Strangschema Sanitär_Isometrie.dwg', expected: 'Strangschema' },
    { file: 'Allgemeiner_Lageplan.pdf', expected: 'Sonstiges' }
  ];

  let passedDetection = true;
  for (const tc of testCases) {
    const detected = detectLevelFromFilename(tc.file);
    const pass = detected === tc.expected;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] "${tc.file}" -> ${detected} (expected: ${tc.expected})`);
    if (!pass) passedDetection = false;
  }

  if (!passedDetection) throw new Error('Level detection tests failed!');

  console.log('\n--- 2. Testing generatePlanName ---');
  const name1 = generatePlanName('Hallenbad Weingarten_Montagepläne_UG_Modell_1.dwg', 'UG');
  console.log('  Clean Name 1:', name1);
  const name2 = generatePlanName('24316_EG_Sanitaer.dwg', 'EG');
  console.log('  Clean Name 2:', name2);

  console.log('\n--- 3. Testing DXF to Vector PDF Conversion ---');
  const sampleDxfPath = path.resolve('../sample_data/Hallenbad_Weingarten_Plan.dxf');
  if (fs.existsSync(sampleDxfPath)) {
    const dxfBuffer = fs.readFileSync(sampleDxfPath);
    const pdfBuffer = await convertCadToPdf({
      inputBuffer: dxfBuffer,
      fileName: 'Hallenbad_Weingarten_Plan.dxf',
      floor: 'EG',
      projectName: 'Hallenbad Weingarten',
      planName: 'Montageplan EG Schwimmhalle'
    });

    const isPdf = pdfBuffer.slice(0, 5).toString('ascii') === '%PDF-';
    console.log(`  PDF Generated: ${pdfBuffer.length} bytes. Header check: ${isPdf ? 'PASS (%PDF-)' : 'FAIL'}`);
    if (!isPdf) throw new Error('Generated file is not a valid PDF!');

    const outPath = '/tmp/test_hbw_plan.pdf';
    fs.writeFileSync(outPath, pdfBuffer);
    console.log(`  Saved test output to ${outPath}`);
  } else {
    console.warn('  Sample DXF file not found, skipping DXF render test');
  }

  console.log('\n--- 4. Testing DWG to Vector PDF Conversion ---');
  // Create synthetic DWG buffer with AutoCAD AC1027 header and text records
  const dwgHeader = Buffer.from('AC1027\x00\x00', 'binary');
  const dwgPayload = Buffer.from('Technikzentrale UG\x00Kesselraum\x00Umkleide Damen\x00Schwimmhalle\x00', 'utf-8');
  const fakeDwgBuffer = Buffer.concat([dwgHeader, dwgPayload]);

  const dwgPdfBuffer = await convertCadToPdf({
    inputBuffer: fakeDwgBuffer,
    fileName: 'Hallenbad_Weingarten_UG_Modell_1.dwg',
    floor: 'UG',
    projectName: 'Hallenbad Weingarten',
    planName: 'Montageplan UG Modell 1'
  });

  const isDwgPdf = dwgPdfBuffer.slice(0, 5).toString('ascii') === '%PDF-';
  console.log(`  DWG Vector PDF Generated: ${dwgPdfBuffer.length} bytes. Header check: ${isDwgPdf ? 'PASS (%PDF-)' : 'FAIL'}`);
  if (!isDwgPdf) throw new Error('Generated DWG PDF is invalid!');

  console.log('\n--- 5. Testing processAndStorePlan data structure ---');
  const testProjectId = 'test_proj_hbw_' + Date.now();
  const testPlanId = 'plan_ug_001';
  
  const result = await processAndStorePlan({
    projectId: testProjectId,
    planId: testPlanId,
    fileBuffer: fakeDwgBuffer,
    fileName: 'Hallenbad_Weingarten_UG_Modell_1.dwg',
    projectName: 'Hallenbad Weingarten'
  });

  console.log('  processAndStorePlan result plan doc:');
  console.log(JSON.stringify(result.plan, null, 2));

  // Validate exact required fields
  const requiredFields = ['id', 'name', 'fileName', 'floor', 'dwgUrl', 'pdfUrl', 'status', 'createdAt'];
  const missing = requiredFields.filter(f => result.plan[f] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required fields in plan doc: ${missing.join(', ')}`);
  }

  console.log(`\n✅ ALL TESTS PASSED! Subcollection entry schema verified successfully.`);
}

runTests().catch(err => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
