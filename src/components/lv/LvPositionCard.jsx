import React from 'react';
import MaterialBookingCard from '../booking/MaterialBookingCard';

export default function LvPositionCard({
  position,
  cartQty = 0,
  onQuantityChange,
  currentLang = 'de',
  onDragStateChange,
}) {
  const plannedQty = Number(position.qty || 0);
  const installedBefore = Number(position.installedQty || 0);

  // In LV mode, roomPlan models the planned and already installed quantities from the bill of quantities
  const roomPlan = {
    plannedQty,
    installedQty: installedBefore,
    qu: position.qu || 'Stk',
    group: position.tradeCategory || position.group || 'Allgemein',
    aliasTitle: position.aliasTitle,
    officialTitle: position.officialTitle,
    shortText: position.officialTitle || position.shortText || position.name,
    monteurInfo: position.monteurInfo,
    translations: position.translations,
    isUnplanned: position.isUnplannedMaterial,
  };

  const handleStep = (matId, step) => {
    const nextDelta = Math.max(0, (Number(cartQty) || 0) + step);
    onQuantityChange && onQuantityChange(position, nextDelta);
  };

  const handleSetDelta = (matId, nextDelta) => {
    const safe = Math.max(0, Number(nextDelta) || 0);
    onQuantityChange && onQuantityChange(position, safe);
  };

  return (
    <MaterialBookingCard
      mat={position}
      roomPlan={roomPlan}
      delta={cartQty}
      room={null}
      currentLang={currentLang}
      onStep={handleStep}
      onSetDelta={handleSetDelta}
      onDragStateChange={onDragStateChange}
    />
  );
}
