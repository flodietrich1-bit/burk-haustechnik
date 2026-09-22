import { XMLParser } from 'fast-xml-parser';
import type { Position } from '../types';

export interface GaebProjectMetadata {
  projectName?: string;
  projectNumber?: string;
  trade?: string; // Gewerk (e.g. "Sanitär", "Heizung")
  client?: string; // Auftraggeber
  location?: string; // Baustellenort
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  currency?: string;
  date?: string;
}

export interface GaebParseResult {
  positions: Partial<Position>[];
  metadata: GaebProjectMetadata;
  rawType: 'gaeb_xml' | 'gaeb_90';
}

export function parseGaebFile(fileContent: string, fileName: string = ''): GaebParseResult {
  const trimmed = fileContent.trim();
  const isXml = trimmed.startsWith('<') || fileName.toLowerCase().endsWith('.x81') || fileName.toLowerCase().endsWith('.xml');

  if (isXml) {
    return parseGaebXml(fileContent, fileName);
  } else {
    return parseGaeb90(fileContent, fileName);
  }
}

// 1. GAEB XML Parser (Supports DA81, DA83, X81, and simplified GAEB XML)
export function parseGaebXml(xmlString: string, fileName: string = ''): GaebParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  const parsed = parser.parse(xmlString);
  const gaeb = parsed?.GAEB;
  
  if (!gaeb) {
    throw new Error('Ungültiges XML: Kein <GAEB> Wurzelelement gefunden.');
  }

  // BoQ Body search (supports official BoQ or BillOfQuantities)
  const award = gaeb?.Award;
  const boq = award?.BoQ || award?.BillOfQuantities || gaeb?.BoQ || gaeb?.BillOfQuantities;
  const boqBody = boq?.BoQBody || award?.BoQBody || gaeb?.BoQBody;

  if (!boqBody) {
    throw new Error('Ungültiges GAEB XML-Format (BoQBody fehlt).');
  }

  // Metadata extraction
  const prjInfo = gaeb?.PrjInfo;
  const gaebInfo = gaeb?.GAEBInfo;
  const boqInfo = boq?.BoQInfo;

  let projectName = 
    extractText(award?.ProjectName) || 
    extractText(prjInfo?.LblPrj) || 
    extractText(gaebInfo?.Description) || 
    extractText(boqInfo?.LblBoQ) || 
    fileName.replace(/\.[^/.]+$/, "");

  let projectNumber = 
    extractText(award?.ProjectNumber) || 
    extractText(prjInfo?.NamePrj) || 
    extractProjectNumberFromFilename(fileName) || 
    "";

  let trade = 
    extractText(award?.Trade) || 
    extractText(boqInfo?.LblBoQ) || 
    (fileName.toLowerCase().includes('sanitär') || projectName.toLowerCase().includes('sanitär') ? 'Sanitärinstallation' : 
     fileName.toLowerCase().includes('heizung') || projectName.toLowerCase().includes('heizung') ? 'Heizung' : 'Haustechnik');

  let currency = extractText(prjInfo?.Cur) || extractText(award?.AwardInfo?.Cur) || 'EUR';
  let date = extractText(gaebInfo?.Date) || new Date().toISOString().slice(0, 10);
  let location = detectLocationFromTitle(projectName);

  const positions: Partial<Position>[] = [];
  let counter = 0;

  // Case 1: Items are directly under boqBody (Simplified GAEB XML e.g. EFH Demo)
  if (boqBody.Item) {
    const rawItems = Array.isArray(boqBody.Item) ? boqBody.Item : [boqBody.Item];
    for (const item of rawItems) {
      if (!item) continue;
      counter++;
      const posNr = item['@_RNoPart'] || item['@_ID'] || `01.01.${String(counter).padStart(3, '0')}`;
      
      const qty = typeof item.Quantity === 'object' 
        ? parseFloat(item.Quantity['#text']) || 0
        : parseFloat(item.Quantity || item.Qty) || 0;

      const qu = (typeof item.Quantity === 'object' && item.Quantity['@_Unit']) 
        ? item.Quantity['@_Unit'] 
        : item.QU || 'Stk';

      const shortText = extractText(item.Description) || extractText(item?.OutlineText) || `Position ${posNr}`;
      const longText = extractText(item?.DetailTxt) || shortText;

      // Extract explicit Room mappings if present in GAEB item (e.g. "Bad EG; Gäste-WC")
      let assignedRoomNames: string[] = [];
      if (item.Room) {
        const roomStr = extractText(item.Room);
        assignedRoomNames = roomStr.split(/[;,]+/).map((s: string) => s.trim()).filter(Boolean);
      }

      const isCut = (shortText.toLowerCase().includes('rohr') || shortText.toLowerCase().includes('leitung')) && (qu === 'm' || qu === 'Meter');

      positions.push({
        id: `pos_${posNr.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        posNr: posNr,
        group: inferGroupFromPosNr(posNr, shortText),
        shortText: cleanHtml(shortText),
        longText: cleanHtml(longText),
        qty: qty,
        qu: qu,
        deliveredQty: qty,
        unitPrice: 0,
        isCutMaterial: isCut,
        status: 'open',
        assignedRoomNames: assignedRoomNames.length > 0 ? assignedRoomNames : undefined,
        updatedAt: new Date().toISOString()
      });
    }
  }

  // Case 2: Items are in categories (BoQCtgy, official GAEB DA81/DA83 format)
  if (boqBody.BoQCtgy) {
    const categories = Array.isArray(boqBody.BoQCtgy) ? boqBody.BoQCtgy : [boqBody.BoQCtgy];

    for (const ctgy of categories) {
      if (!ctgy) continue;
      const categoryTitle = extractText(ctgy?.LblTx) || 'Allgemeine Positionen';
      const categoryRNo = ctgy['@_RNoPart'] || '01';

      const items = ctgy?.BoQBody?.Itemlist?.Item || ctgy?.Itemlist?.Item || ctgy?.Item;
      if (!items) continue;

      const itemList = Array.isArray(items) ? items : [items];

      for (const item of itemList) {
        if (!item) continue;
        counter++;
        const posNrRaw = item['@_RNoPart'] || item['@_ID'] || String(counter);
        const posNr = `${categoryRNo}.${String(posNrRaw).padStart(2, '0')}`;
        const qty = parseFloat(item.Qty) || 0;
        const qu = item.QU || 'Stk';

        const shortText = extractText(item?.Description?.CompleteText?.OutlineText) || 
                          extractText(item?.Description?.CompleteText?.DetailTxt) || 
                          extractText(item?.Description) ||
                          'Position ohne Text';
        
        const longText = extractText(item?.Description?.CompleteText?.DetailTxt) || shortText;

        positions.push({
          id: `pos_${posNr.replace(/\./g, '_')}`,
          posNr: posNr,
          group: categoryTitle,
          shortText: cleanHtml(shortText),
          longText: cleanHtml(longText),
          qty: qty,
          qu: qu,
          deliveredQty: qty,
          unitPrice: 0,
          isCutMaterial: shortText.toLowerCase().includes('m') && (qu === 'm' || qu === 'Meter'),
          status: 'open',
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  return {
    positions,
    metadata: {
      projectName,
      projectNumber,
      trade,
      location,
      currency,
      date
    },
    rawType: 'gaeb_xml'
  };
}

// 2. GAEB 90 Parser (.D83, .D81)
export function parseGaeb90(content: string, fileName: string = ''): GaebParseResult {
  const lines = content.split(/\r?\n/);
  const metadata: GaebProjectMetadata = {
    projectNumber: extractProjectNumberFromFilename(fileName) || '',
    currency: 'EUR'
  };
  const positions: Partial<Position>[] = [];
  let currentGroup = 'Allgemein';
  let posCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || rawLine.length < 2) continue;

    const line = rawLine.replace(/\s*\d{6}$/, '').trimEnd();
    const recordType = line.substring(0, 2);

    if (recordType === '01') {
      const textPart = line.substring(2, 45).replace(/\s+/g, ' ').trim();
      if (textPart) metadata.trade = textPart;
      
      const dateMatches = line.match(/(\d{2}\.\d{2}\.\d{2,4})/g);
      if (dateMatches && dateMatches.length >= 1) {
        metadata.startDate = convertGermanDateToIso(dateMatches[0]);
      }
      if (dateMatches && dateMatches.length >= 2) {
        metadata.endDate = convertGermanDateToIso(dateMatches[1]);
      }
    }
    else if (recordType === '02') {
      const prj = cleanSpecialChars(line.substring(2).trim());
      if (prj) {
        metadata.projectName = prj;
        metadata.location = detectLocationFromTitle(prj);
      }
    }
    else if (recordType === '03') {
      const client = cleanSpecialChars(line.substring(2).trim());
      if (client) metadata.client = client;
    }
    else if (recordType === '11') {
      const groupText = line.substring(4).trim();
      if (groupText) currentGroup = groupText;
    }
    else if (recordType === '21') {
      posCounter++;
      const posNr = `${String(posCounter).padStart(2, '0')}`;
      let qty = 0;
      let qu = 'Stk';

      const rawQty = line.substring(13, 24).trim().replace(',', '.');
      if (rawQty && !isNaN(parseFloat(rawQty))) {
        qty = parseFloat(rawQty);
      }
      const rawQu = line.substring(24, 28).trim();
      if (rawQu) qu = rawQu;

      let shortText = '';
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const nextLine = lines[j];
        if (nextLine.startsWith('25') || nextLine.startsWith('26')) {
          shortText += ' ' + nextLine.substring(2).trim();
        } else if (nextLine.startsWith('21') || nextLine.startsWith('11')) {
          break;
        }
      }

      shortText = shortText.trim() || `Position ${posNr}`;

      positions.push({
        id: `pos_${posNr}`,
        posNr: posNr,
        group: currentGroup,
        shortText: shortText,
        longText: shortText,
        qty: qty || 1,
        qu: qu,
        deliveredQty: qty || 1,
        unitPrice: 0,
        isCutMaterial: shortText.toLowerCase().includes('m') && (qu === 'm' || qu === 'Meter'),
        status: 'open',
        updatedAt: new Date().toISOString()
      });
    }
  }

  if (!metadata.projectName) {
    metadata.projectName = fileName.replace(/\.[^/.]+$/, "");
  }

  return {
    positions,
    metadata,
    rawType: 'gaeb_90'
  };
}

// Helpers
function extractText(obj: any): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number') return String(obj);
  if (obj['#text']) return obj['#text'];
  if (Array.isArray(obj)) return obj.map(extractText).join(' ');
  if (typeof obj === 'object') {
    let res = '';
    for (const key of Object.keys(obj)) {
      if (key.startsWith('@_')) continue;
      res += ' ' + extractText(obj[key]);
    }
    return res;
  }
  return '';
}

function cleanHtml(str: string): string {
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSpecialChars(str: string): string {
  return str
    .replace(/\x94/g, 'ö')
    .replace(/\x84/g, 'ä')
    .replace(/\x81/g, 'ü')
    .replace(/\x99/g, 'Ö')
    .replace(/\x8E/g, 'Ä')
    .replace(/\x9A/g, 'Ü')
    .replace(/\xE1/g, 'ß')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProjectNumberFromFilename(fileName: string): string {
  if (!fileName) return '';
  const match = fileName.match(/(\d{4,5}[-_]\d{3}|\d{4})/);
  return match ? match[1] : '';
}

function detectLocationFromTitle(title: string): string {
  if (!title) return '';
  const knownPlaces = ['Weingarten', 'Ravensburg', 'Bavendorf', 'Friedrichshafen', 'Biberach', 'Aulendorf', 'Wangen', 'Bodensee', 'Ulm', 'Memmingen', 'Leutkirch'];
  for (const place of knownPlaces) {
    if (new RegExp(`\\b${place}\\b`, 'i').test(title)) {
      return place;
    }
  }
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    return parts[parts.length - 1].trim();
  }
  if (title.includes(', ')) {
    const parts = title.split(', ');
    return parts[parts.length - 1].trim();
  }
  return '';
}

function convertGermanDateToIso(dateStr: string): string {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return '';
  let day = parts[0].padStart(2, '0');
  let month = parts[1].padStart(2, '0');
  let year = parts[2];
  if (year.length === 2) {
    year = (parseInt(year, 10) > 50 ? '19' : '20') + year;
  }
  return `${year}-${month}-${day}`;
}

function inferGroupFromPosNr(posNr: string, shortText: string): string {
  const lower = shortText.toLowerCase();
  if (lower.includes('wc') || lower.includes('waschtisch') || lower.includes('dusche') || lower.includes('spüle')) {
    return 'Sanitärobjekte & Armaturen';
  }
  if (lower.includes('rohr') || lower.includes('leitung') || lower.includes('abwasser')) {
    return 'Rohrleitungen & Entwässerung';
  }
  if (lower.includes('kugelhahn') || lower.includes('verteiler') || lower.includes('armatur')) {
    return 'Verteiler & Armaturen';
  }
  if (posNr.startsWith('01.01')) return 'Sanitäreinrichtung';
  if (posNr.startsWith('01.02')) return 'Rohrleitungen';
  if (posNr.startsWith('01.03')) return 'Armaturen & Verteiler';
  return 'Allgemeine Positionen';
}
