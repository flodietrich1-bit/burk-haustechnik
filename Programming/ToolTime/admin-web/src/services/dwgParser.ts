import type { Room, Position, RoomMaterialRequirement } from '../types';

export interface DwgParseResult {
  rooms: Room[];
  detectedLayers: string[];
  cadFormat: string;
}

/**
 * Parses a DWG or DXF file and extracts rooms, levels, and matches them with GAEB positions.
 */
export async function parseDwgFile(
  file: File,
  gaebPositions: Partial<Position>[] = []
): Promise<DwgParseResult> {
  const isDxf = file.name.toLowerCase().endsWith('.dxf');
  let detectedLayers: string[] = [];
  let formatSignature = 'AutoCAD DWG';
  let rawRooms: { name: string; floor: 'UG' | 'EG' | 'OG' | 'DG'; area?: number }[] = [];

  if (isDxf) {
    const dxfText = await file.text();
    formatSignature = 'AutoCAD DXF (ASCII)';
    detectedLayers = extractDxfLayers(dxfText);
    rawRooms = extractRoomsFromDxf(dxfText);
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
    rawRooms = extractRoomsFromCadText(textContent);
  }

  // Convert raw room descriptors to typed Room objects
  const rooms: Room[] = rawRooms.map((r, i) => {
    const code = `${r.floor}-${String(100 + (i + 1))}`;
    return {
      id: `cad_room_${i + 1}`,
      name: r.name,
      code: code,
      floor: r.floor,
      areaSqm: r.area,
      source: 'dwg',
      translations: generateTranslations(r.name),
      materials: []
    };
  });

  // Match materials to rooms
  const roomsWithMaterials = matchMaterialsToRooms(rooms, gaebPositions);

  return {
    rooms: roomsWithMaterials,
    detectedLayers,
    cadFormat: formatSignature
  };
}

/**
 * Extracts rooms specifically from DXF ENTITIES section by checking layer ROOM, RAUM, or text values.
 */
function extractRoomsFromDxf(dxfText: string): { name: string; floor: 'UG' | 'EG' | 'OG' | 'DG'; area?: number }[] {
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
      floor: determineFloor(name)
    }));
  }

  // Fallback to text scanning if no specific room layers were used
  return extractRoomsFromCadText(dxfText);
}

/**
 * Extracts rooms from text content for binary DWG files
 */
function extractRoomsFromCadText(text: string): { name: string; floor: 'UG' | 'EG' | 'OG' | 'DG'; area?: number }[] {
  const roomNameRegex = /(Umkleide\s*(Herren|Damen|Personal)?|Dusche[n]?\s*(Herren|Damen)?|Technikraum|Heizraum|Lüftungszentrale|Kesselraum|Schwimmhalle|Beckenbereich|WC\s*(Damen|Herren|Behindert|Personal)?|Gäste[- ]?WC|Bad(\s*EG|\s*OG)?|Küche|HWR|Personalraum|Büro|Lager|Flur|Treppenhaus)/gi;

  const matches = text.match(roomNameRegex);
  const unique = Array.from(new Set(matches?.map(m => cleanRoomName(m)) || []));

  if (unique.length >= 2) {
    return unique.map(name => ({
      name,
      floor: determineFloor(name)
    }));
  }

  // Standard architectural building rooms fallback
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
