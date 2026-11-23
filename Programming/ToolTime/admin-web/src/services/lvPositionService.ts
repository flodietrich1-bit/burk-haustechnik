import type { Position } from '../types';
import { savePositionsBatch } from './firestoreService';
import { recordCatalogArticle } from './catalogArticleService';

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
