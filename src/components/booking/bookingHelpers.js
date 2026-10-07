import { GLOSSARY } from '../../locales/i18n';

export const formatQty = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  return num % 1 === 0 ? String(num) : num.toFixed(1);
};

export const getRoomDisplayName = (room, currentLang = 'de') => {
  if (!room) return '';
  if (currentLang && currentLang !== 'de' && room.translations?.[currentLang]) {
    return `${room.name} (${room.translations[currentLang]})`;
  }
  return room.name || '';
};

export const getRoomPlannedItem = (matId, room) => {
  if (!room) return null;
  if (room.plannedItems && room.plannedItems[matId]) {
    return room.plannedItems[matId];
  }
  if (Array.isArray(room.materials)) {
    const found = room.materials.find(
      (m) => (m.positionId || m.id) === matId || m.posNr === matId
    );
    if (found) {
      return {
        plannedQty: Number(found.plannedQty || 0),
        installedQty: Number(found.installedQty || 0),
        shortText: found.shortText || found.name || '',
        name: found.shortText || found.name || '',
        cleanName: found.shortText || found.cleanName || found.name || '',
        posNr: found.posNr || '',
        group: found.group || '',
        qu: found.qu || 'Stk',
        isUnplanned: found.isUnplanned,
      };
    }
  }
  return null;
};

export const getMaterialDisplayName = (mat, roomPlan = null) => {
  if (mat?.cleanName && mat.cleanName !== 'Neues Material') {
    return mat.cleanName;
  }
  if (mat?.shortText && mat.shortText !== 'Neues Material') {
    return mat.shortText;
  }
  if (roomPlan?.shortText && roomPlan.shortText !== 'Neues Material') {
    return roomPlan.shortText;
  }
  if (mat?.name && mat.name !== 'Neues Material') {
    return mat.name;
  }
  if (roomPlan?.cleanName && roomPlan.cleanName !== 'Neues Material') {
    return roomPlan.cleanName;
  }
  if (roomPlan?.name && roomPlan.name !== 'Neues Material') {
    return roomPlan.name;
  }
  if (mat?.longText) {
    return mat.longText;
  }
  if (mat?.pos || roomPlan?.posNr) {
    return `Pos ${mat?.pos || roomPlan?.posNr}`;
  }
  return 'Material';
};

export const getForeignGloss = (mat, currentLang) => {
  if (!mat || currentLang === 'de') return '';
  const text = (
    (mat.name || '') + ' ' +
    (mat.cleanName || '') + ' ' +
    (mat.shortText || '') + ' ' +
    (mat.group || '')
  ).toLowerCase();

  // Explicit keywords matching
  if (text.includes('armatur') || text.includes('mischer') || text.includes('brause') || text.includes('thermostat')) {
    return GLOSSARY.armatur?.[currentLang] || '';
  }
  if (text.includes('kugelhahn') || text.includes('hahn')) {
    return GLOSSARY.kugelhahn?.[currentLang] || GLOSSARY.ventil?.[currentLang] || '';
  }
  if (text.includes('ventil') || text.includes('absperr') || text.includes('schieber')) {
    return GLOSSARY.ventil?.[currentLang] || '';
  }
  if (text.includes('verteiler')) {
    return GLOSSARY.verteiler?.[currentLang] || '';
  }
  if (text.includes('bogen') || text.includes('winkel')) {
    return GLOSSARY.bogen?.[currentLang] || '';
  }
  if (text.includes('t-stück') || text.includes('abzweig') || text.includes('t-stk')) {
    return GLOSSARY.abzweig?.[currentLang] || '';
  }
  if (text.includes('reduzier')) {
    return GLOSSARY.reduzierung?.[currentLang] || '';
  }
  if (text.includes('schelle')) {
    return GLOSSARY.schelle?.[currentLang] || '';
  }
  if (text.includes('muffe')) {
    return GLOSSARY.muffe?.[currentLang] || '';
  }
  if (text.includes('isolier') || text.includes('dämmung') || text.includes('schale')) {
    return GLOSSARY.isolierung?.[currentLang] || '';
  }
  if (text.includes('wc') || text.includes('waschtisch') || text.includes('becken') || text.includes('urinal') || text.includes('spülkasten')) {
    return GLOSSARY.sanitaer?.[currentLang] || '';
  }
  if (text.includes('rohr') || mat.qu === 'm') {
    return GLOSSARY.rohr?.[currentLang] || '';
  }

  // Fallback by icon if specified
  if (mat.icon === 'bend') return GLOSSARY.bogen?.[currentLang] || '';
  if (mat.icon === 'valve') return GLOSSARY.ventil?.[currentLang] || '';
  if (mat.icon === 'clamp') return GLOSSARY.schelle?.[currentLang] || '';
  if (mat.icon === 'pipe') return GLOSSARY.rohr?.[currentLang] || '';

  // Do not falsely default to pipe
  return '';
};

export const getMatIconSymbol = (icon) => {
  switch (icon) {
    case 'bend':
      return '↪';
    case 'valve':
      return '⨂';
    case 'clamp':
      return '◯';
    case 'tee':
      return '┬';
    default:
      return '━';
  }
};

export const resolveMat = (matId, materials = [], room = null) => {
  let mat = Array.isArray(materials)
    ? materials.find((m) => m.id === matId || m.pos === matId || m.posNr === matId)
    : null;
  const roomPlan = room ? getRoomPlannedItem(matId, room) : null;
  if (!mat && roomPlan) {
    mat = {
      id: matId,
      pos: roomPlan.posNr || matId,
      name: roomPlan.shortText || roomPlan.name || 'Material',
      cleanName: roomPlan.shortText || roomPlan.cleanName || roomPlan.name || 'Material',
      shortText: roomPlan.shortText || '',
      group: roomPlan.group || 'Allgemein',
      qu: roomPlan.qu || 'Stk',
      deliveredQty: Number(roomPlan.plannedQty || 0),
      installedQty: Number(roomPlan.installedQty || 0),
      isUnplanned: roomPlan.isUnplanned,
    };
  }
  return { mat, roomPlan };
};
