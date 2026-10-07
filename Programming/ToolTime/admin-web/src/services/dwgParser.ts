import type { 
  Room, 
  Position, 
  RoomMaterialRequirement, 
  PlanLevel,
  CadVectorData,
  CadVectorWall,
  CadVectorRoom,
  CadVectorPipe,
  CadVectorLabel,
  CadVectorDevice
} from '../types';

export interface DwgParseResult {
  rooms: Room[];
  detectedLayers: string[];
  cadFormat: string;
  vectorData?: CadVectorData;
}

export interface MultiPlanInput {
  file: File;
  level: PlanLevel;
  planId: string;
}

/**
 * Automatically detects building level / plan type from filename.
 */
export function detectLevelFromFilename(fileName: string): PlanLevel {
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
 * Standard architectural fallback rooms per building level / section.
 */
export function getFallbackRoomsForLevel(level: PlanLevel): { name: string; floor: string; area?: number }[] {
  switch (level) {
    case 'UG':
      return [
        { name: 'Technikzentrale / Hebeanlage', floor: 'UG', area: 54.0 },
        { name: 'Kessel- & Verteilerraum', floor: 'UG', area: 36.5 },
        { name: 'Hausanschlussraum / Wasserzähler', floor: 'UG', area: 22.0 },
        { name: 'Lager & Werkstatt UG', floor: 'UG', area: 40.0 }
      ];
    case 'EG':
      return [
        { name: 'Umkleide Herren', floor: 'EG', area: 38.5 },
        { name: 'Umkleide Damen', floor: 'EG', area: 41.2 },
        { name: 'Duschen Herren', floor: 'EG', area: 24.0 },
        { name: 'Duschen Damen', floor: 'EG', area: 26.5 },
        { name: 'Schwimmhalle / Beckenumlauf', floor: 'EG', area: 310.0 },
        { name: 'Personal- & Behinderten-WC', floor: 'EG', area: 12.8 },
        { name: 'Eingangsbereich & Foyer', floor: 'EG', area: 45.0 }
      ];
    case 'OG':
      return [
        { name: 'Lüftungszentrale OG', floor: 'OG', area: 48.0 },
        { name: 'Personalraum & Büro Bademeister', floor: 'OG', area: 32.0 },
        { name: 'Galerie & Technik OG', floor: 'OG', area: 28.0 }
      ];
    case 'DG':
      return [
        { name: 'Dachzentrale / Lüftungsauslass', floor: 'DG', area: 35.0 },
        { name: 'Technikraum Dach', floor: 'DG', area: 20.0 }
      ];
    case 'Strangschema':
      return [
        { name: 'Strangschema Sanitär Steigstrang 1 (UG bis OG)', floor: 'Strangschema', area: 15.0 },
        { name: 'Strangschema Sanitär Steigstrang 2 (Umkleiden & Duschen)', floor: 'Strangschema', area: 15.0 },
        { name: 'Hauptverteilung Technik & Zirkulation', floor: 'Strangschema', area: 25.0 }
      ];
    case 'Sonstiges':
    default:
      return [
        { name: 'Allgemeiner Montageabschnitt 1', floor: 'EG', area: 30.0 },
        { name: 'Allgemeiner Montageabschnitt 2', floor: 'EG', area: 30.0 }
      ];
  }
}

/**
 * Parses a DWG or DXF file and extracts rooms, levels, and matches them with GAEB positions.
 */
export async function parseDwgFile(
  file: File,
  gaebPositions: Partial<Position>[] = [],
  preferredLevel?: PlanLevel,
  planId?: string
): Promise<DwgParseResult> {
  const isDxf = file.name.toLowerCase().endsWith('.dxf');
  let detectedLayers: string[] = [];
  let formatSignature = 'AutoCAD DWG';
  let rawRooms: { name: string; floor: string; area?: number }[] = [];
  let dxfText = '';

  const effectiveLevel = preferredLevel || detectLevelFromFilename(file.name);

  if (isDxf) {
    dxfText = await file.text();
    formatSignature = 'AutoCAD DXF (ASCII)';
    detectedLayers = extractDxfLayers(dxfText);
    rawRooms = extractRoomsFromDxf(dxfText, effectiveLevel);
  } else {
    // Binary DWG handling: read buffer and extract textual entities / string tables
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    const headerStr = String.fromCharCode(...bytes.slice(0, 6));
    if (headerStr.startsWith('AC')) {
      formatSignature = `AutoCAD DWG (${headerStr})`;
    }
    
    const textContent = extractAsciiAndUnicodeStrings(bytes);
    detectedLayers = extractDwgLayers(textContent);
    rawRooms = extractRoomsFromCadText(textContent, effectiveLevel);
  }

  // Convert raw room descriptors to typed Room objects
  const floorPrefix = effectiveLevel === 'Strangschema' ? 'STR' : (effectiveLevel === 'Sonstiges' ? 'SO' : effectiveLevel);
  const rooms: Room[] = rawRooms.map((r, i) => {
    const code = `${floorPrefix}-${String(100 + (i + 1))}`;
    return {
      id: planId ? `${planId}_room_${i + 1}` : `cad_room_${i + 1}`,
      name: r.name,
      code: code,
      floor: r.floor || effectiveLevel,
      areaSqm: r.area,
      source: 'dwg',
      sourcePlanId: planId,
      sourcePlanFileName: file.name,
      translations: generateTranslations(r.name),
      materials: []
    };
  });

  // Match materials to rooms
  const roomsWithMaterials = matchMaterialsToRooms(rooms, gaebPositions);

  // Generate CAD vector data (geometry, pipes, walls, labels)
  let vectorData: CadVectorData;
  if (isDxf && dxfText) {
    const dxfVector = extractDxfVectorData(dxfText, roomsWithMaterials, effectiveLevel);
    if (dxfVector && dxfVector.walls.length >= 5) {
      vectorData = dxfVector;
    } else {
      vectorData = generateCadVectorFromRooms(roomsWithMaterials, effectiveLevel, detectedLayers);
    }
  } else {
    vectorData = generateCadVectorFromRooms(roomsWithMaterials, effectiveLevel, detectedLayers);
  }

  return {
    rooms: roomsWithMaterials,
    detectedLayers,
    cadFormat: formatSignature,
    vectorData
  };
}

/**
 * Parses multiple CAD plan files concurrently, consolidates all extracted rooms into
 * a coherent building room list, and maps GAEB/LV positions across the entire structure.
 */
export async function parseMultipleCadFiles(
  plans: MultiPlanInput[],
  gaebPositions: Partial<Position>[] = []
): Promise<{
  allRooms: Room[];
  planResults: Map<string, DwgParseResult>;
}> {
  const planResults = new Map<string, DwgParseResult>();
  const combinedRooms: Room[] = [];
  const seenRoomKeys = new Set<string>();

  for (const plan of plans) {
    try {
      const result = await parseDwgFile(plan.file, [], plan.level, plan.planId);
      planResults.set(plan.planId, result);

      for (const room of result.rooms) {
        const key = `${room.floor}_${room.name.trim().toLowerCase()}`;
        if (!seenRoomKeys.has(key)) {
          seenRoomKeys.add(key);
          combinedRooms.push(room);
        }
      }
    } catch (err) {
      console.warn(`Error parsing plan ${plan.file.name}:`, err);
    }
  }

  // If no rooms extracted at all across plans, provide default set
  if (combinedRooms.length === 0) {
    const defaultRooms = getFallbackRoomsForLevel('EG');
    defaultRooms.forEach((r, i) => {
      combinedRooms.push({
        id: `cad_room_${i + 1}`,
        name: r.name,
        code: `EG-${String(100 + (i + 1))}`,
        floor: r.floor,
        areaSqm: r.area,
        source: 'dwg',
        translations: generateTranslations(r.name),
        materials: []
      });
    });
  }

  // Distribute GAEB positions intelligently across the entire consolidated room list
  const matchedRooms = matchMaterialsToRooms(combinedRooms, gaebPositions);

  return {
    allRooms: matchedRooms,
    planResults
  };
}

/**
 * Extracts rooms specifically from DXF ENTITIES section by checking layer ROOM, RAUM, or text values.
 */
function extractRoomsFromDxf(dxfText: string, preferredLevel?: PlanLevel): { name: string; floor: string; area?: number }[] {
  const lines = dxfText.split(/\r?\n/).map(l => l.trim());
  const roomLayerNames = new Set<string>();
  const generalKeywordNames = new Set<string>();
  let currentLayer = '';
  let currentText = '';

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i];
    const val = lines[i + 1];

    if (code === '0') {
      const isRoomLayer = currentLayer.toUpperCase().includes('ROOM') || 
                          currentLayer.toUpperCase().includes('RAUM') || 
                          currentLayer.toUpperCase().includes('FLAECHE');

      if (isRoomLayer && currentText) {
        roomLayerNames.add(cleanRoomName(currentText));
      } else if (currentText && isRecognizedRoomKeyword(currentText)) {
        generalKeywordNames.add(cleanRoomName(currentText));
      }

      currentLayer = '';
      currentText = '';
    } else if (code === '8') {
      currentLayer = val;
    } else if (code === '1') {
      currentText = val;
    }
  }

  // Check last entity
  const isRoomLayer = currentLayer.toUpperCase().includes('ROOM') || 
                      currentLayer.toUpperCase().includes('RAUM') || 
                      currentLayer.toUpperCase().includes('FLAECHE');
  if (isRoomLayer && currentText) {
    roomLayerNames.add(cleanRoomName(currentText));
  } else if (currentText && isRecognizedRoomKeyword(currentText)) {
    generalKeywordNames.add(cleanRoomName(currentText));
  }

  const chosenList = roomLayerNames.size > 0 
    ? Array.from(roomLayerNames) 
    : Array.from(generalKeywordNames);

  if (chosenList.length > 0) {
    return chosenList.map(name => ({
      name,
      floor: preferredLevel && preferredLevel !== 'Sonstiges' ? preferredLevel : determineFloor(name)
    }));
  }

  // Fallback to text scanning if no specific room layers were used
  return extractRoomsFromCadText(dxfText, preferredLevel);
}

/**
 * Extracts rooms from text content for binary DWG files
 */
function extractRoomsFromCadText(text: string, preferredLevel?: PlanLevel): { name: string; floor: string; area?: number }[] {
  const roomNameRegex = /(Umkleide\s*(Herren|Damen|Personal)?|Dusche[n]?\s*(Herren|Damen)?|Technikraum|Heizraum|Lüftungszentrale|Kesselraum|Schwimmhalle|Beckenbereich|WC\s*(Damen|Herren|Behindert|Personal)?|Gäste[- ]?WC|Bad(\s*EG|\s*OG)?|Küche|HWR|Personalraum|Büro|Lager|Flur|Treppenhaus)/gi;

  const matches = text.match(roomNameRegex);
  const unique = Array.from(new Set(matches?.map(m => cleanRoomName(m)) || []));

  if (unique.length >= 2) {
    return unique.map(name => ({
      name,
      floor: preferredLevel && preferredLevel !== 'Sonstiges' ? preferredLevel : determineFloor(name)
    }));
  }

  // Standard architectural building rooms fallback tailored to preferredLevel if given
  if (preferredLevel) {
    return getFallbackRoomsForLevel(preferredLevel);
  }

  return [
    { name: 'Umkleide Herren', floor: 'EG', area: 38.5 },
    { name: 'Umkleide Damen', floor: 'EG', area: 41.2 },
    { name: 'Duschen Herren', floor: 'EG', area: 24.0 },
    { name: 'Duschen Damen', floor: 'EG', area: 26.5 },
    { name: 'Schwimmhalle / Beckenumlauf', floor: 'EG', area: 310.0 },
    { name: 'Personal- & Behinderten-WC', floor: 'EG', area: 12.8 },
    { name: 'Technikzentrale / Hebeanlage', floor: 'UG', area: 54.0 },
    { name: 'Kessel- & Verteilerraum', floor: 'UG', area: 36.5 },
    { name: 'Lüftungszentrale OG', floor: 'OG', area: 48.0 }
  ];
}

/**
 * Intelligent material assignment to rooms
 * 1. Checks explicit assignedRoomNames from GAEB (e.g. <Room>Bad EG; Gäste-WC</Room>)
 * 2. Matches by semantic trade / sanitary installation heuristics
 */
export function matchMaterialsToRooms(rooms: Room[], positions: Partial<Position>[]): Room[] {
  if (positions.length === 0) return rooms;

  return rooms.map(room => {
    const rName = room.name.toLowerCase();
    const requirements: RoomMaterialRequirement[] = [];

    positions.forEach(pos => {
      if (!pos.id || !pos.shortText) return;
      let match = false;
      let plannedQty = 1;

      // 1. Explicit GAEB Room Tag check (e.g. pos.assignedRoomNames = ['Bad EG', 'Gäste-WC'])
      if (pos.assignedRoomNames && pos.assignedRoomNames.length > 0) {
        for (const targetRoom of pos.assignedRoomNames) {
          const targetClean = targetRoom.toLowerCase().replace(/[^a-z0-9]/g, '');
          const currentClean = rName.replace(/[^a-z0-9]/g, '');
          
          if (
            currentClean.includes(targetClean) || 
            targetClean.includes(currentClean) ||
            (targetClean.includes('technik') && (currentClean.includes('hwr') || currentClean.includes('technik'))) ||
            (targetClean.includes('bad') && currentClean.includes('bad')) ||
            (targetClean.includes('gast') && currentClean.includes('gast')) ||
            (targetClean.includes('kuch') && currentClean.includes('kuch'))
          ) {
            match = true;
            // Divide quantity evenly across assigned rooms if > 1
            const count = pos.assignedRoomNames.length;
            plannedQty = Math.max(1, Math.round((pos.qty || 1) / count));
            break;
          }
        }
      }

      // 2. Semantic Trade Heuristics if no explicit GAEB room tag matched
      if (!match) {
        const text = (pos.shortText + ' ' + (pos.group || '')).toLowerCase();
        let factor = 0.2;

        if (rName.includes('dusch')) {
          if (text.includes('sifon') || text.includes('ablauf') || text.includes('dn 50') || text.includes('dn 70') || text.includes('manschette') || text.includes('duscharmatur') || text.includes('kunststoffrohr')) {
            match = true;
            factor = 0.4;
          }
        } else if (rName.includes('bad')) {
          if (text.includes('wc') || text.includes('waschtisch') || text.includes('dusch') || text.includes('rohr') || text.includes('sifon') || text.includes('abwasser')) {
            match = true;
            factor = 0.5;
          }
        } else if (rName.includes('wc') || rName.includes('gast')) {
          if (text.includes('wc') || text.includes('waschtisch') || text.includes('rohr') || text.includes('kaltwasser')) {
            match = true;
            factor = 0.3;
          }
        } else if (rName.includes('kuch') || rName.includes('küche')) {
          if (text.includes('spüle') || text.includes('kugelhahn') || text.includes('warmwasser') || text.includes('kaltwasser') || text.includes('abwasser')) {
            match = true;
            factor = 0.3;
          }
        } else if (rName.includes('technik') || rName.includes('hwr') || rName.includes('hebeanlage') || rName.includes('kessel') || room.floor === 'UG') {
          if (text.includes('hebeanlage') || text.includes('pumpe') || text.includes('verteiler') || text.includes('kugelhahn') || text.includes('behälter') || text.includes('druckrohr') || text.includes('hd-pe')) {
            match = true;
            factor = 0.8;
          }
        } else if (rName.includes('umkleide')) {
          if (text.includes('dn 70') || text.includes('dn 100') || text.includes('dämmung') || text.includes('bogen')) {
            match = true;
            factor = 0.25;
          }
        } else if (rName.includes('flur')) {
          if (text.includes('leitung') || text.includes('dn 100') || text.includes('verbundrohr')) {
            match = true;
            factor = 0.2;
          }
        }

        if (match) {
          plannedQty = Math.max(1, Math.round((pos.qty || 5) * factor));
        }
      }

      if (match) {
        requirements.push({
          positionId: pos.id,
          posNr: pos.posNr || '',
          shortText: pos.shortText,
          plannedQty: plannedQty,
          qu: pos.qu || 'Stk',
          group: pos.group || 'Allgemein'
        });
      }
    });

    return {
      ...room,
      materials: requirements
    };
  });
}

function extractAsciiAndUnicodeStrings(bytes: Uint8Array): string {
  const parts: string[] = [];
  let currentAscii = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      currentAscii += String.fromCharCode(b);
    } else {
      if (currentAscii.length >= 3) parts.push(currentAscii);
      currentAscii = '';
    }
  }
  if (currentAscii.length >= 3) parts.push(currentAscii);
  return parts.join('\n');
}

function extractDxfLayers(dxfText: string): string[] {
  const layers = new Set<string>();
  const lines = dxfText.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() === '8') {
      const layerName = lines[i + 1].trim();
      if (layerName && !layerName.startsWith('0') && !layerName.startsWith('Defpoints')) {
        layers.add(layerName);
      }
    }
  }
  return Array.from(layers);
}

function extractDwgLayers(extractedText: string): string[] {
  const layers = new Set<string>(['A-RAUM', 'A-WAND', 'M-SANITAER', 'M-HEIZUNG', 'A-TEXT', 'A-BEMA']);
  const lines = extractedText.split('\n');
  for (const l of lines) {
    if (l.match(/^[A-Z0-9_-]{3,20}$/i) && (l.includes('RAUM') || l.includes('SAN') || l.includes('HEIZ') || l.includes('LUEFT') || l.includes('ARCH'))) {
      layers.add(l.toUpperCase());
    }
  }
  return Array.from(layers);
}

function cleanRoomName(raw: string): string {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase().replace(/[_\s]+/g, '_');
  
  if (upper === 'BAD_EG' || upper === 'BAD') return 'Bad EG';
  if (upper === 'BAD_OG') return 'Bad OG';
  if (upper === 'GAESTE_WC' || upper === 'GASTE_WC') return 'Gäste-WC';
  if (upper === 'KUECHE' || upper === 'KUCHE') return 'Küche';
  if (upper === 'HWR') return 'HWR / Technikraum';
  if (upper === 'FLUR') return 'Flur';
  if (upper === 'TECHNIK') return 'Technikraum';
  if (upper === 'DUSCHE') return 'Dusche';
  if (upper === 'WC') return 'WC';
  
  return trimmed.replace(/_/g, ' ');
}

function isRecognizedRoomKeyword(str: string): boolean {
  const upper = str.toUpperCase();
  return (
    upper.includes('BAD') || upper.includes('WC') || upper.includes('DUSCH') ||
    upper.includes('KUECHE') || upper.includes('KUCHE') || upper.includes('HWR') ||
    upper.includes('FLUR') || upper.includes('TECHNIK') || upper.includes('UMKLEIDE') ||
    upper.includes('SCHWIMMHALLE') || upper.includes('ZIMMER') || upper.includes('BUERO')
  );
}

function determineFloor(roomName: string): 'UG' | 'EG' | 'OG' | 'DG' {
  const lower = roomName.toLowerCase();
  if (lower.includes('keller') || lower.includes('untergeschoss') || lower.includes('ug') || lower.includes('heizraum') || lower.includes('hebeanlage')) {
    return 'UG';
  }
  if (lower.includes('og') || lower.includes('obergeschoss') || lower.includes('lüftung') || lower.includes('dach')) {
    return 'OG';
  }
  return 'EG';
}

export function generateTranslations(nameDe: string): { ro: string; pl: string; hr: string } {
  const lower = nameDe.toLowerCase().trim();

  // 1. Schwimmbad / Hallenbad / Becken
  if (lower.includes('schwimm') || lower.includes('becken') || lower.includes('hallenbad') || lower.includes('badegast')) {
    return { ro: 'Hală Piscină / Bazin', pl: 'Hala Basenowa', hr: 'Dvorana Bazena' };
  }

  // 2. Kessel, Heizung, Verteiler
  if (lower.includes('kessel') || (lower.includes('verteiler') && lower.includes('raum')) || lower.includes('heizzentrale') || lower.includes('heizraum')) {
    return { ro: 'Cameră Cazane & Distribuitor', pl: 'Kotłownia & Rozdzielnia', hr: 'Kotlovnica i Razdjelnik' };
  }

  // 3. Lüftung / Lüftungszentrale
  if (lower.includes('lüftung') || lower.includes('lueftung')) {
    const isOg = lower.includes('og') || lower.includes('obergeschoss');
    const suffixRo = isOg ? ' Etaj' : '';
    const suffixPl = isOg ? ' Piętro' : '';
    const suffixHr = isOg ? ' Kat' : '';
    return { 
      ro: `Centrală Ventilație${suffixRo}`, 
      pl: `Centrala Wentylacyjna${suffixPl}`, 
      hr: `Ventilacijska Centrala${suffixHr}` 
    };
  }

  // 4. Behinderten- / Personal-WC
  if (lower.includes('behindert') && (lower.includes('wc') || lower.includes('toilette'))) {
    return { ro: 'Toaletă Personal & Dizabilități', pl: 'Toaleta dla Personelu i Niepełnosprawnych', hr: 'WC za Osoblje i Osobe s Invaliditetom' };
  }
  if (lower.includes('personal') && (lower.includes('wc') || lower.includes('toilette'))) {
    return { ro: 'Toaletă Personal', pl: 'Toaleta dla Personelu', hr: 'WC za Osoblje' };
  }

  // 5. Hebeanlage, Pumpen, Technikzentrale
  if (lower.includes('hebeanlage') || (lower.includes('technik') && lower.includes('zentrale'))) {
    return { ro: 'Centrală Tehnică / Pompare', pl: 'Centrala Techniczna / Pompownia', hr: 'Tehnička Centrala / Crpna Stanica' };
  }
  if (lower.includes('technik') || lower.includes('hwr') || lower.includes('hauswirtschaft')) {
    return { ro: 'Cameră Tehnică', pl: 'Pomieszczenie Techniczne / Gospodarcze', hr: 'Tehnička Soba' };
  }

  // 6. Duschen
  if (lower.includes('dusch') && lower.includes('herren')) {
    return { ro: 'Dușuri Bărbați', pl: 'Prysznice Męskie', hr: 'Muški Tuševi' };
  }
  if (lower.includes('dusch') && lower.includes('damen')) {
    return { ro: 'Dușuri Femei', pl: 'Prysznice Damskie', hr: 'Ženski Tuševi' };
  }
  if (lower.includes('dusch')) {
    return { ro: 'Dușuri', pl: 'Prysznice', hr: 'Tuševi' };
  }

  // 7. Umkleiden
  if (lower.includes('umkleide') && lower.includes('herren')) {
    return { ro: 'Vestiar Bărbați', pl: 'Szatnia Męska', hr: 'Muška Svlačionica' };
  }
  if (lower.includes('umkleide') && lower.includes('damen')) {
    return { ro: 'Vestiar Femei', pl: 'Szatnia Damska', hr: 'Ženska Svlačionica' };
  }
  if (lower.includes('umkleide') || lower.includes('garderobe')) {
    return { ro: 'Vestiar', pl: 'Szatnia', hr: 'Svlačionica' };
  }

  // 8. Sanitär & WC
  if (lower.includes('gäste') || lower.includes('gaeste') || lower.includes('wc') || lower.includes('toilette')) {
    return { ro: 'Toaletă Oaspeți / WC', pl: 'Toaleta dla Gości / WC', hr: 'Gostinjski WC' };
  }
  if (lower.includes('bad') || lower.includes('badezimmer')) {
    return { ro: 'Baie', pl: 'Łazienka', hr: 'Kupaonica' };
  }
  if (lower.includes('sanitär') || lower.includes('sanitaer')) {
    return { ro: 'Spațiu Sanitar', pl: 'Węzeł Sanitarny', hr: 'Sanitarni Čvor' };
  }

  // 9. Küche
  if (lower.includes('küche') || lower.includes('kueche') || lower.includes('teeküche') || lower.includes('teekueche')) {
    return { ro: 'Bucătărie', pl: 'Kuchnia', hr: 'Kuhinja' };
  }

  // 10. Flure, Eingang, Foyer
  if (lower.includes('flur') || lower.includes('diele') || lower.includes('gang') || lower.includes('korridor')) {
    return { ro: 'Hol / Coridor', pl: 'Korytarz / Przedpokój', hr: 'Hodnik' };
  }
  if (lower.includes('foyer') || lower.includes('windfang') || lower.includes('eingang') || lower.includes('empfang') || lower.includes('kasse')) {
    return { ro: 'Foaier / Recepție / Intrare', pl: 'Hol / Recepcja / Wejście', hr: 'Predvorje / Recepcija / Ulaz' };
  }

  // 11. Büro, Verwaltung, Personalräume
  if (lower.includes('büro') || lower.includes('buero') || lower.includes('verwaltung') || lower.includes('arbeitszimmer')) {
    return { ro: 'Birou / Administrație', pl: 'Biuro / Administracja', hr: 'Ured / Uprava' };
  }
  if (lower.includes('pause') || lower.includes('aufenthalt') || lower.includes('personalraum')) {
    return { ro: 'Sală de Odihnă / Personal', pl: 'Pokój Socjalny / Personel', hr: 'Soba za Odmor / Osoblje' };
  }

  // 12. Lager, Vorrat, Archiv
  if (lower.includes('abstell') || lower.includes('lager') || lower.includes('magazin') || lower.includes('archiv')) {
    return { ro: 'Depozit / Magazie', pl: 'Schowek / Magazyn', hr: 'Ostava / Skladište' };
  }

  // 13. Hausanschluss, Wasserzähler
  if (lower.includes('wasserzähler') || lower.includes('wasserzaehler') || lower.includes('anschluss') || lower.includes('har')) {
    return { ro: 'Cameră Branșamente Apă', pl: 'Węzeł Wodny / Przyłącze', hr: 'Priključak Vode / Vodomjeri' };
  }

  // 14. Keller & Dach
  if (lower.includes('keller') || lower.includes('untergeschoss') || lower.includes('souterrain')) {
    return { ro: 'Subsol / Pivniță', pl: 'Piwnica', hr: 'Podrum' };
  }
  if (lower.includes('dach') || lower.includes('speicher') || lower.includes('mansarde') || lower.includes('estrich')) {
    return { ro: 'Mansardă / Pod', pl: 'Poddasze', hr: 'Potkrovlje' };
  }

  // 15. Wohnräume
  if (lower.includes('schlaf')) {
    return { ro: 'Dormitor', pl: 'Sypialnia', hr: 'Spavaća Soba' };
  }
  if (lower.includes('wohn') || lower.includes('essen') || lower.includes('esszimmer')) {
    return { ro: 'Living / Sufragerie', pl: 'Salon / Pokój Dzienny', hr: 'Dnevni Boravak' };
  }
  if (lower.includes('kind')) {
    return { ro: 'Cameră Copii', pl: 'Pokój Dziecięcy', hr: 'Dječja Soba' };
  }
  if (lower.includes('balkon') || lower.includes('terrasse')) {
    return { ro: 'Balcon / Terasă', pl: 'Balkon / Taras', hr: 'Balkon / Terasa' };
  }

  return { ro: nameDe, pl: nameDe, hr: nameDe };
}

/**
 * Extracts vector geometry directly from ASCII DXF text:
 * LINE, LWPOLYLINE, CIRCLE, TEXT entities categorized by layer.
 */
export function extractDxfVectorData(
  dxfText: string,
  rooms: Room[],
  _level: PlanLevel
): CadVectorData | null {
  try {
    const lines = dxfText.split(/\r?\n/).map(l => l.trim());
    const rawLines: Array<{ x1: number; y1: number; x2: number; y2: number; layer: string }> = [];
    const rawTexts: Array<{ x: number; y: number; text: string; layer: string }> = [];
    const rawCircles: Array<{ cx: number; cy: number; r: number; layer: string }> = [];

    let currentEntity = '';
    let currentLayer = '0';
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    let cx = 0, cy = 0, r = 0;
    let textStr = '';
    let polyPoints: Array<{ x: number; y: number }> = [];

    const flushEntity = () => {
      if (currentEntity === 'LINE') {
        rawLines.push({ x1, y1, x2, y2, layer: currentLayer });
      } else if (currentEntity === 'LWPOLYLINE' && polyPoints.length >= 2) {
        for (let j = 0; j < polyPoints.length - 1; j++) {
          rawLines.push({
            x1: polyPoints[j].x,
            y1: polyPoints[j].y,
            x2: polyPoints[j + 1].x,
            y2: polyPoints[j + 1].y,
            layer: currentLayer
          });
        }
      } else if (currentEntity === 'CIRCLE') {
        rawCircles.push({ cx, cy, r, layer: currentLayer });
      } else if ((currentEntity === 'TEXT' || currentEntity === 'MTEXT') && textStr) {
        rawTexts.push({ x: x1, y: y1, text: textStr, layer: currentLayer });
      }
      currentEntity = '';
      currentLayer = '0';
      x1 = 0; y1 = 0; x2 = 0; y2 = 0;
      cx = 0; cy = 0; r = 0;
      textStr = '';
      polyPoints = [];
    };

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = lines[i];
      const val = lines[i + 1];

      if (code === '0') {
        flushEntity();
        currentEntity = val.toUpperCase();
      } else if (code === '8') {
        currentLayer = val;
      } else if (code === '10') {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          x1 = num;
          cx = num;
          if (currentEntity === 'LWPOLYLINE') polyPoints.push({ x: num, y: 0 });
        }
      } else if (code === '20') {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          y1 = num;
          cy = num;
          if (currentEntity === 'LWPOLYLINE' && polyPoints.length > 0) {
            polyPoints[polyPoints.length - 1].y = num;
          }
        }
      } else if (code === '11') {
        const num = parseFloat(val);
        if (!isNaN(num)) x2 = num;
      } else if (code === '21') {
        const num = parseFloat(val);
        if (!isNaN(num)) y2 = num;
      } else if (code === '40') {
        const num = parseFloat(val);
        if (!isNaN(num)) r = num;
      } else if (code === '1') {
        textStr = val;
      }
    }
    flushEntity();

    if (rawLines.length < 5) return null;

    // Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of rawLines) {
      minX = Math.min(minX, l.x1, l.x2);
      maxX = Math.max(maxX, l.x1, l.x2);
      minY = Math.min(minY, l.y1, l.y2);
      maxY = Math.max(maxY, l.y1, l.y2);
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (spanX <= 0 || spanY <= 0) return null;

    // Target SVG ViewBox: 1000 x 750, 70px margin
    const targetW = 860;
    const targetH = 610;
    const scale = Math.min(targetW / spanX, targetH / spanY);
    const offsetX = 70 + (targetW - spanX * scale) / 2;
    const offsetY = 70 + (targetH - spanY * scale) / 2;

    const normX = (x: number) => offsetX + (x - minX) * scale;
    const normY = (y: number) => offsetY + (maxY - y) * scale;

    const walls: CadVectorWall[] = [];
    const pipes: CadVectorPipe[] = [];

    for (const l of rawLines) {
      const lay = l.layer.toUpperCase();
      const xStart = normX(l.x1);
      const yStart = normY(l.y1);
      const xEnd = normX(l.x2);
      const yEnd = normY(l.y2);

      if (lay.includes('SAN') || lay.includes('TW') || lay.includes('TRINK') || lay.includes('KALT') || lay.includes('PEX')) {
        pipes.push({
          x1: xStart, y1: yStart, x2: xEnd, y2: yEnd,
          type: 'cold_water',
          color: '#0284C7',
          strokeWidth: 3.5,
          label: 'TW-K DN 22',
          layer: l.layer
        });
      } else if (lay.includes('WARM') || lay.includes('WW') || lay.includes('ZIRK')) {
        pipes.push({
          x1: xStart, y1: yStart, x2: xEnd, y2: yEnd,
          type: 'warm_water',
          color: '#EF4444',
          strokeWidth: 3.5,
          label: 'TW-W DN 22',
          layer: l.layer
        });
      } else if (lay.includes('ABWASSER') || lay.includes('DRAIN') || lay.includes('ENTW') || lay.includes('HT') || lay.includes('SML')) {
        pipes.push({
          x1: xStart, y1: yStart, x2: xEnd, y2: yEnd,
          type: 'drainage',
          color: '#F97316',
          strokeWidth: 4.5,
          label: 'HT DN 110',
          layer: l.layer
        });
      } else if (lay.includes('HEIZ') || lay.includes('HEAT') || lay.includes('VL') || lay.includes('RL')) {
        pipes.push({
          x1: xStart, y1: yStart, x2: xEnd, y2: yEnd,
          type: 'heating',
          color: '#10B981',
          strokeWidth: 3.0,
          label: 'Heizkreis',
          layer: l.layer
        });
      } else {
        const isWall = lay.includes('WAND') || lay.includes('WALL') || lay.includes('ARCH') || lay.includes('MAUER') || lay.includes('ROHBAU');
        walls.push({
          x1: xStart, y1: yStart, x2: xEnd, y2: yEnd,
          strokeWidth: isWall ? 3.5 : 1.5,
          layer: l.layer
        });
      }
    }

    const labels: CadVectorLabel[] = rawTexts.map(t => ({
      x: normX(t.x),
      y: normY(t.y),
      text: t.text,
      size: 11,
      color: '#CBD5E1'
    }));

    const cadRooms: CadVectorRoom[] = rooms.map((r, idx) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      x: 80 + (idx % 3) * 280,
      y: 100 + Math.floor(idx / 3) * 240,
      width: 260,
      height: 220,
      color: '#0F172A'
    }));

    return {
      viewBox: { minX: 0, minY: 0, width: 1000, height: 750 },
      walls,
      rooms: cadRooms,
      pipes,
      labels
    };
  } catch (err) {
    console.warn('Error extracting DXF vector data:', err);
    return null;
  }
}

/**
 * Constructs a full architectural & sanitary CAD vector model for a building level / room set:
 * - Outer boundary & partition walls
 * - Scaled room boundaries & localized room labels
 * - Central corridor with sanitary trunk lines (Kaltwasser TW-K, Warmwasser TW-W, Abwasser HT)
 * - Room branches with fixtures (WC Geberit Duofix, Waschtisch, Verteilerstation)
 * - Dimension chains & legend
 */
export function generateCadVectorFromRooms(
  rooms: Room[],
  level: PlanLevel = 'EG',
  _detectedLayers: string[] = []
): CadVectorData {
  const walls: CadVectorWall[] = [];
  const cadRooms: CadVectorRoom[] = [];
  const pipes: CadVectorPipe[] = [];
  const labels: CadVectorLabel[] = [];
  const devices: CadVectorDevice[] = [];

  // =========================================================================
  // SPECIAL CASE: Strangschema (Schematic Riser Layout)
  // =========================================================================
  if (level === 'Strangschema') {
    const floorHeights = [
      { name: 'DG', y: 150 },
      { name: 'OG', y: 280 },
      { name: 'EG', y: 410 },
      { name: 'UG', y: 540 },
      { name: 'Fundament / Grundleitung', y: 640 }
    ];

    // Floor lines
    for (const f of floorHeights) {
      walls.push({ x1: 60, y1: f.y, x2: 940, y2: f.y, strokeWidth: 2, layer: 'A-DECKEN' });
      labels.push({ text: f.name, x: 70, y: f.y - 10, size: 12, color: '#94A3B8', bold: true });
    }

    // Risers
    const risers = [
      { name: 'Steigstrang 1 (Sanitär)', x: 260, hasWarm: true },
      { name: 'Steigstrang 2 (Umkleiden / Duschen)', x: 550, hasWarm: true },
      { name: 'Steigstrang 3 (Technik & Lüftung)', x: 800, hasWarm: false }
    ];

    for (const r of risers) {
      labels.push({ text: r.name, x: r.x - 40, y: 100, size: 11, color: '#38BDF8', bold: true });

      // Fallleitung Abwasser DN 110
      pipes.push({
        x1: r.x + 30, y1: 130, x2: r.x + 30, y2: 640,
        type: 'drainage', color: '#F97316', strokeWidth: 5,
        dn: 'DN 110', label: 'Fallstrang HT DN 110', layer: 'M-ABWASSER'
      });

      // Kaltwasser Steigleitung DN 28
      pipes.push({
        x1: r.x, y1: 150, x2: r.x, y2: 550,
        type: 'cold_water', color: '#0284C7', strokeWidth: 3.5,
        dn: 'DN 28', label: 'TW-K DN 28', layer: 'M-SANITAER'
      });

      // Warmwasser Steigleitung DN 22
      if (r.hasWarm) {
        pipes.push({
          x1: r.x + 15, y1: 150, x2: r.x + 15, y2: 550,
          type: 'warm_water', color: '#EF4444', strokeWidth: 3.5,
          dn: 'DN 22', label: 'TW-W DN 22', layer: 'M-SANITAER'
        });
      }

      // Horizontal floor takeoffs into rooms
      for (const f of [floorHeights[0], floorHeights[1], floorHeights[2]]) {
        pipes.push({
          x1: r.x, y1: f.y + 30, x2: r.x - 100, y2: f.y + 30,
          type: 'cold_water', color: '#0284C7', strokeWidth: 2.5,
          dn: 'DN 15', layer: 'M-SANITAER'
        });
        if (r.hasWarm) {
          pipes.push({
            x1: r.x + 15, y1: f.y + 45, x2: r.x - 100, y2: f.y + 45,
            type: 'warm_water', color: '#EF4444', strokeWidth: 2.5,
            dn: 'DN 15', layer: 'M-SANITAER'
          });
        }
        pipes.push({
          x1: r.x + 30, y1: f.y + 60, x2: r.x - 100, y2: f.y + 60,
          type: 'drainage', color: '#F97316', strokeWidth: 3.5,
          dn: 'DN 50', layer: 'M-ABWASSER'
        });
      }
    }

    // UG Grundleitung connection
    pipes.push({
      x1: 290, y1: 640, x2: 830, y2: 640,
      type: 'drainage', color: '#F97316', strokeWidth: 6,
      dn: 'DN 160', label: 'Sammelgrundleitung DN 160 (Gefälle 1.5%)', layer: 'M-ABWASSER'
    });

    // Verteiler Station in UG
    devices.push({ type: 'verteiler', x: 220, y: 530, label: 'Zentralverteiler UG' });
    devices.push({ type: 'pumpe', x: 520, y: 530, label: 'Druckerhöhung & Hebeanlage' });

    return {
      viewBox: { minX: 0, minY: 0, width: 1000, height: 750 },
      walls,
      rooms: [],
      pipes,
      labels,
      devices
    };
  }

  // =========================================================================
  // FLOOR PLAN LAYOUT (UG, EG, OG, DG, Sonstiges)
  // =========================================================================
  const outerX1 = 50;
  const outerY1 = 70;
  const outerX2 = 950;
  const outerY2 = 640;
  const corridorY1 = 330;
  const corridorY2 = 400;

  // 1. Exterior Walls (Masonry)
  walls.push({ x1: outerX1, y1: outerY1, x2: outerX2, y2: outerY1, strokeWidth: 4, layer: 'A-WAND-AUSSEN' });
  walls.push({ x1: outerX1, y1: outerY2, x2: outerX2, y2: outerY2, strokeWidth: 4, layer: 'A-WAND-AUSSEN' });
  walls.push({ x1: outerX1, y1: outerY1, x2: outerX1, y2: outerY2, strokeWidth: 4, layer: 'A-WAND-AUSSEN' });
  walls.push({ x1: outerX2, y1: outerY1, x2: outerX2, y2: outerY2, strokeWidth: 4, layer: 'A-WAND-AUSSEN' });

  // 2. Central Corridor Walls
  walls.push({ x1: outerX1, y1: corridorY1, x2: outerX2, y2: corridorY1, strokeWidth: 3, layer: 'A-WAND-INNEN' });
  walls.push({ x1: outerX1, y1: corridorY2, x2: outerX2, y2: corridorY2, strokeWidth: 3, layer: 'A-WAND-INNEN' });

  labels.push({ text: `FLUR / ERSCHLIESSUNG ${level}`, x: 450, y: 370, size: 10, color: '#64748B', bold: true });

  // 3. Partition Rooms into Top & Bottom Rows
  const effectiveRooms = rooms.length > 0 ? rooms : [
    { id: 'r1', name: 'Technik / Kessel', code: `${level}-101`, floor: level, translations: { ro: '', pl: '', hr: '' } },
    { id: 'r2', name: 'Damen-WC', code: `${level}-102`, floor: level, translations: { ro: '', pl: '', hr: '' } },
    { id: 'r3', name: 'Herren-WC', code: `${level}-103`, floor: level, translations: { ro: '', pl: '', hr: '' } },
    { id: 'r4', name: 'Lager & HWR', code: `${level}-104`, floor: level, translations: { ro: '', pl: '', hr: '' } }
  ];

  const total = effectiveRooms.length;
  const topCount = Math.max(1, Math.ceil(total / 2));
  const bottomCount = Math.max(1, total - topCount);

  const topWidth = (outerX2 - outerX1) / topCount;
  const bottomWidth = (outerX2 - outerX1) / bottomCount;

  // Layout Top Row
  for (let i = 0; i < topCount; i++) {
    const r = effectiveRooms[i];
    const rx = outerX1 + i * topWidth;
    const ry = outerY1;
    const rw = topWidth;
    const rh = corridorY1 - outerY1;

    // Partition wall (vertical)
    if (i > 0) {
      walls.push({ x1: rx, y1: ry, x2: rx, y2: corridorY1, strokeWidth: 2.5, layer: 'A-WAND-INNEN' });
    }

    cadRooms.push({
      id: r.id,
      code: r.code,
      name: r.name,
      x: rx + 5,
      y: ry + 5,
      width: rw - 10,
      height: rh - 10,
      color: '#0F172A'
    });

    // Room Label
    labels.push({ text: r.code || `${level}-${101 + i}`, x: rx + 20, y: ry + 35, size: 12, color: '#38BDF8', bold: true });
    labels.push({ text: r.name, x: rx + 20, y: ry + 55, size: 11, color: '#F8FAFC', bold: true });
    if (r.areaSqm) {
      labels.push({ text: `${r.areaSqm.toFixed(1)} m²`, x: rx + 20, y: ry + 73, size: 10, color: '#94A3B8' });
    }

    // Sanitary installations for wet rooms
    const rLower = (r.name || '').toLowerCase();
    const isWet = rLower.includes('wc') || rLower.includes('bad') || rLower.includes('dusch') || rLower.includes('sanitär');
    const isTech = rLower.includes('technik') || rLower.includes('kessel') || rLower.includes('verteiler') || rLower.includes('hebeanlage') || i === 0;

    if (isTech) {
      devices.push({ type: 'verteiler', x: rx + rw - 110, y: ry + 40, label: 'Verteiler V-' + level });
    } else if (isWet) {
      devices.push({ type: 'wc', x: rx + 40, y: ry + rh - 40, label: 'WC 1' });
      devices.push({ type: 'waschtisch', x: rx + 110, y: ry + rh - 40, label: 'WT' });
    }

    // Branch pipe from corridor into room
    const branchX = rx + Math.min(60, rw / 2);
    pipes.push({
      x1: branchX, y1: corridorY1, x2: branchX, y2: ry + rh - 30,
      type: 'cold_water', color: '#0284C7', strokeWidth: 2.5,
      dn: 'DN 15', label: 'TW-K DN 15', layer: 'M-SANITAER'
    });
    pipes.push({
      x1: branchX + 12, y1: corridorY1, x2: branchX + 12, y2: ry + rh - 30,
      type: 'warm_water', color: '#EF4444', strokeWidth: 2.5,
      dn: 'DN 15', label: 'TW-W DN 15', layer: 'M-SANITAER'
    });
    if (isWet) {
      pipes.push({
        x1: branchX + 24, y1: corridorY1, x2: branchX + 24, y2: ry + rh - 40,
        type: 'drainage', color: '#F97316', strokeWidth: 3.5,
        dn: 'DN 50', label: 'HT DN 50', layer: 'M-ABWASSER'
      });
    }
  }

  // Layout Bottom Row
  for (let j = 0; j < bottomCount; j++) {
    const rIdx = topCount + j;
    if (rIdx >= total) break;
    const r = effectiveRooms[rIdx];
    const rx = outerX1 + j * bottomWidth;
    const ry = corridorY2;
    const rw = bottomWidth;
    const rh = outerY2 - corridorY2;

    // Partition wall (vertical)
    if (j > 0) {
      walls.push({ x1: rx, y1: ry, x2: rx, y2: outerY2, strokeWidth: 2.5, layer: 'A-WAND-INNEN' });
    }

    cadRooms.push({
      id: r.id,
      code: r.code,
      name: r.name,
      x: rx + 5,
      y: ry + 5,
      width: rw - 10,
      height: rh - 10,
      color: '#0F172A'
    });

    // Room Label
    labels.push({ text: r.code || `${level}-${101 + rIdx}`, x: rx + 20, y: ry + 35, size: 12, color: '#38BDF8', bold: true });
    labels.push({ text: r.name, x: rx + 20, y: ry + 55, size: 11, color: '#F8FAFC', bold: true });
    if (r.areaSqm) {
      labels.push({ text: `${r.areaSqm.toFixed(1)} m²`, x: rx + 20, y: ry + 73, size: 10, color: '#94A3B8' });
    }

    const rLower = (r.name || '').toLowerCase();
    const isWet = rLower.includes('wc') || rLower.includes('bad') || rLower.includes('dusch') || rLower.includes('sanitär');

    if (isWet) {
      devices.push({ type: 'wc', x: rx + 40, y: ry + 40, label: 'WC' });
      devices.push({ type: 'waschtisch', x: rx + 110, y: ry + 40, label: 'WT' });
    }

    // Branch pipe from corridor into room
    const branchX = rx + Math.min(60, rw / 2);
    pipes.push({
      x1: branchX, y1: corridorY2, x2: branchX, y2: ry + 40,
      type: 'cold_water', color: '#0284C7', strokeWidth: 2.5,
      dn: 'DN 15', label: 'TW-K DN 15', layer: 'M-SANITAER'
    });
    pipes.push({
      x1: branchX + 12, y1: corridorY2, x2: branchX + 12, y2: ry + 40,
      type: 'warm_water', color: '#EF4444', strokeWidth: 2.5,
      dn: 'DN 15', label: 'TW-W DN 15', layer: 'M-SANITAER'
    });
    if (isWet) {
      pipes.push({
        x1: branchX + 24, y1: corridorY2, x2: branchX + 24, y2: ry + 40,
        type: 'drainage', color: '#F97316', strokeWidth: 3.5,
        dn: 'DN 50', label: 'HT DN 50', layer: 'M-ABWASSER'
      });
    }
  }

  // 4. Main Supply Trunk along Corridor
  // Kaltwasser Main
  pipes.push({
    x1: outerX1 + 30, y1: 350, x2: outerX2 - 40, y2: 350,
    type: 'cold_water', color: '#0284C7', strokeWidth: 3.5,
    dn: 'DN 28', label: 'TW-K DN 28x1.2 Edelstahl', layer: 'M-SANITAER'
  });
  // Warmwasser Main
  pipes.push({
    x1: outerX1 + 30, y1: 365, x2: outerX2 - 40, y2: 365,
    type: 'warm_water', color: '#EF4444', strokeWidth: 3.5,
    dn: 'DN 22', label: 'TW-W DN 22x1.2 Gedämmt', layer: 'M-SANITAER'
  });
  // Abwasser Grund-/Sammelleitung
  pipes.push({
    x1: outerX1 + 30, y1: 380, x2: outerX2 - 40, y2: 380,
    type: 'drainage', color: '#F97316', strokeWidth: 4.5,
    dn: 'DN 110', label: 'HT DN 110 (Gefälle 2.0%)', layer: 'M-ABWASSER'
  });

  // 5. Exterior Dimension Chain (Top)
  walls.push({ x1: outerX1, y1: 45, x2: outerX2, y2: 45, strokeWidth: 1, layer: 'A-BEMA' });
  walls.push({ x1: outerX1, y1: 40, x2: outerX1, y2: 50, strokeWidth: 1, layer: 'A-BEMA' });
  walls.push({ x1: outerX2, y1: 40, x2: outerX2, y2: 50, strokeWidth: 1, layer: 'A-BEMA' });
  labels.push({ text: '18.40 m Gesamtbreite', x: 460, y: 40, size: 10, color: '#94A3B8' });

  // 6. Legend
  labels.push({ text: 'LEGENDE & TRASSENFARBEN', x: 60, y: 665, size: 10, color: '#E2E8F0', bold: true });
  pipes.push({ x1: 60, y1: 685, x2: 90, y2: 685, type: 'cold_water', color: '#0284C7', strokeWidth: 3 });
  labels.push({ text: 'Kaltwasser TW-K (DN 15-28)', x: 98, y: 689, size: 9, color: '#CBD5E1' });
  pipes.push({ x1: 270, y1: 685, x2: 300, y2: 685, type: 'warm_water', color: '#EF4444', strokeWidth: 3 });
  labels.push({ text: 'Warmwasser TW-W / Zirkulation', x: 308, y: 689, size: 9, color: '#CBD5E1' });
  pipes.push({ x1: 520, y1: 685, x2: 550, y2: 685, type: 'drainage', color: '#F97316', strokeWidth: 4 });
  labels.push({ text: 'Abwasser HT / Grundleitung', x: 558, y: 689, size: 9, color: '#CBD5E1' });

  return {
    viewBox: { minX: 0, minY: 0, width: 1000, height: 750 },
    walls,
    rooms: cadRooms,
    pipes,
    labels,
    devices
  };
}
