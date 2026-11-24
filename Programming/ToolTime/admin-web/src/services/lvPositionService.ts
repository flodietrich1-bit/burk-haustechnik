import type { Position } from '../types';
import { savePositionsBatch } from './firestoreService';
import { recordCatalogArticle } from './catalogArticleService';

export function normalizeExcelPosNr(raw: string): string {
  const clean = String(raw).trim();
  const match = clean.match(/^(\d+)\.0*(\d+)(\.\d+)?$/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const ext = match[3] || '';
    return `${String(major).padStart(2, '0')}.${String(minor).padStart(2, '0')}${ext}`;
  }
  const stdMatch = clean.match(/^(\d+)\.(\d+)(\.\d+)?$/);
  if (stdMatch) {
    const major = parseInt(stdMatch[1], 10);
    const minor = parseInt(stdMatch[2], 10);
    const ext = stdMatch[3] || '';
    return `${String(major).padStart(2, '0')}.${String(minor).padStart(2, '0')}${ext}`;
  }
  return clean;
}

export function comparePositionCodes(a: Position, b: Position): number {
  const codeA = (a.displayCode || a.posNr || '').trim();
  const codeB = (b.displayCode || b.posNr || '').trim();
  if (codeA && codeB) {
    const cmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
  }
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

export function generateNextCode(basePosNr: string, existingCodes: string[]): string {
  const cleanBase = basePosNr.trim();
  // Check if base has sub-position pattern like 04.07 or 04.07.1
  const prefix = cleanBase;
  let subIndex = 1;
  let candidate = `${prefix}.${subIndex}`;

  while (existingCodes.includes(candidate)) {
    subIndex++;
    candidate = `${prefix}.${subIndex}`;
  }
  return candidate;
}

export function generateNextCodeForTrade(tradeCategory: string, existingPositions: Position[]): string {
  const cleanTrade = (tradeCategory || '').trim().toLowerCase();
  const tradePositions = existingPositions.filter(p => {
    const t = (p.tradeCategory || p.group || '').trim().toLowerCase();
    return cleanTrade && t === cleanTrade;
  });

  if (tradePositions.length === 0) {
    const prefixes = existingPositions
      .map(p => (p.displayCode || p.posNr || '').match(/^(\d+)\./))
      .filter(Boolean)
      .map(m => parseInt(m![1], 10));
    const nextPrefix = prefixes.length > 0 ? Math.max(...prefixes) + 1 : 1;
    return `${String(nextPrefix).padStart(2, '0')}.01`;
  }

  // Find max incremental number matching standard patterns e.g. 02.20
  let maxSubNumber = 0;
  let detectedPrefix = '';
  let subDigits = 2;

  tradePositions.forEach(p => {
    const code = (p.displayCode || p.posNr || '').trim();
    const match = code.match(/^(\d+)\.(\d+)$/);
    if (match) {
      const num = parseInt(match[2], 10);
      if (num > maxSubNumber) {
        maxSubNumber = num;
        detectedPrefix = match[1];
        subDigits = match[2].length;
      }
    }
  });

  if (detectedPrefix && maxSubNumber > 0) {
    const nextSub = maxSubNumber + 1;
    return `${detectedPrefix}.${String(nextSub).padStart(Math.max(subDigits, 2), '0')}`;
  }

  // Fallback to last position in this trade
  const lastPos = tradePositions[tradePositions.length - 1];
  const lastCode = (lastPos.displayCode || lastPos.posNr || '').trim();
  const allCodes = existingPositions.map(p => p.displayCode || p.posNr);
  return generateNextCode(lastCode, allCodes);
}

export function suggestUnitForTrade(tradeName?: string, title?: string): 'Stk' | 'LFM' {
  const text = `${tradeName || ''} ${title || ''}`.toLowerCase();
  if (
    text.includes('rohr') ||
    text.includes('leitung') ||
    text.includes('kanal') ||
    text.includes('trasse') ||
    text.includes('kabel') ||
    text.includes('dämmung') ||
    text.includes('isolier') ||
    text.includes('schiebe') ||
    text.includes('lfm') ||
    text.includes('meter')
  ) {
    return 'LFM';
  }
  return 'Stk';
}

export async function addCustomPosition(
  projectId: string,
  existingPositions: Position[],
  newPosData: {
    officialTitle: string;
    aliasTitle?: string | null;
    monteurInfo?: string | null;
    displayCode?: string;
    tradeCategory: string;
    qty: number;
    qu: string;
    unitPriceVK?: number | null;
    orderStatus?: 'OPEN' | 'ORDERED' | 'DELIVERED';
  },
  insertAfterPosition?: Position
): Promise<Position> {
  const existingCodes = existingPositions.map(p => p.displayCode || p.posNr);
  
  let targetCode = newPosData.displayCode?.trim();
  if (!targetCode) {
    if (insertAfterPosition) {
      targetCode = generateNextCode(insertAfterPosition.displayCode || insertAfterPosition.posNr, existingCodes);
    } else if (newPosData.tradeCategory) {
      targetCode = generateNextCodeForTrade(newPosData.tradeCategory, existingPositions);
    } else {
      targetCode = `99.${String(existingPositions.length + 1).padStart(2, '0')}`;
    }
  }

  // Calculate sortOrder
  let sortOrder = 1000;
  const positionsToUpdate: Partial<Position>[] = [];

  if (insertAfterPosition) {
    const afterOrder = insertAfterPosition.sortOrder ?? 100;
    sortOrder = afterOrder + 1;
    // Shift any subsequent positions if sortOrder collision
    existingPositions.forEach(p => {
      if ((p.sortOrder ?? 0) >= sortOrder) {
        positionsToUpdate.push({
          ...p,
          sortOrder: (p.sortOrder ?? 0) + 10
        });
      }
    });
  } else {
    const maxOrder = existingPositions.reduce((max, p) => Math.max(max, p.sortOrder ?? 0), 0);
    sortOrder = maxOrder + 10;
  }

  const posId = `pos_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const title = newPosData.officialTitle.trim();
  const alias = newPosData.aliasTitle?.trim() || null;
  const info = newPosData.monteurInfo?.trim() || null;

  const newPosition: Position = {
    id: posId,
    projectId,
    posNr: targetCode,
    displayCode: targetCode,
    originalCode: targetCode,
    sortOrder,
    sourceType: 'CUSTOM_ADDED',
    officialTitle: title,
    aliasTitle: alias,
    monteurInfo: info,
    group: newPosData.tradeCategory,
    tradeCategory: newPosData.tradeCategory,
    shortText: alias || title,
    longText: title,
    qty: Number(newPosData.qty) || 1,
    qu: newPosData.qu || 'Stk',
    deliveredQty: Number(newPosData.qty) || 1,
    unitPrice: Number(newPosData.unitPriceVK) || 0,
    unitPriceVK: Number(newPosData.unitPriceVK) || 0,
    orderStatus: newPosData.orderStatus || 'OPEN',
    status: 'open',
    updatedAt: new Date().toISOString()
  };

  // Record into cross-project catalog for autocomplete
  try {
    await recordCatalogArticle({
      title,
      aliasTitle: alias,
      monteurInfo: info,
      tradeCategory: newPosData.tradeCategory,
      qu: newPosData.qu,
      defaultUnitPriceVK: Number(newPosData.unitPriceVK) || 0
    });
  } catch (err) {
    console.warn('Could not record article in catalog:', err);
  }

  // Save new position + any shifted sortOrders
  await savePositionsBatch(projectId, [newPosition, ...positionsToUpdate]);

  return newPosition;
}

export async function updatePositionFields(
  projectId: string,
  positionId: string,
  currentPositions: Position[],
  updates: Partial<Position>
): Promise<void> {
  const existing = currentPositions.find(p => p.id === positionId);
  if (!existing) return;

  const merged: Position = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Keep dual properties synced
  if (updates.displayCode) merged.posNr = updates.displayCode;
  if (updates.tradeCategory) merged.group = updates.tradeCategory;
  if (updates.unitPriceVK !== undefined) merged.unitPrice = Number(updates.unitPriceVK) || 0;
  if (updates.officialTitle) {
    if (!merged.aliasTitle) merged.shortText = updates.officialTitle;
  }
  if (updates.aliasTitle !== undefined) {
    merged.shortText = updates.aliasTitle || merged.officialTitle || merged.shortText;
  }

  await savePositionsBatch(projectId, [merged]);
}

export async function togglePositionCancelled(
  projectId: string,
  positionId: string,
  currentPositions: Position[]
): Promise<void> {
  const existing = currentPositions.find(p => p.id === positionId);
  if (!existing) return;

  const willBeCancelled = !(existing.isCancelled || existing.status === 'cancelled');

  await updatePositionFields(projectId, positionId, currentPositions, {
    isCancelled: willBeCancelled,
    status: willBeCancelled ? 'cancelled' : 'open',
    cancelledAt: willBeCancelled ? new Date().toISOString() : null
  });
}

export async function togglePositionMonteurVisibility(
  projectId: string,
  positionId: string,
  currentPositions: Position[]
): Promise<void> {
  const existing = currentPositions.find(p => p.id === positionId);
  if (!existing) return;

  await updatePositionFields(projectId, positionId, currentPositions, {
    hiddenForMonteur: !existing.hiddenForMonteur
  });
}
