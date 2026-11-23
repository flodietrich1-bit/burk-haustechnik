/**
 * Helper to determine whether a project operates in LV-based or Room-based measurement mode.
 */
export function isLvProject(project) {
  if (!project) return false;
  const mode = String(project.measurementMode || '').trim().toUpperCase();
  if (mode === 'LV_BASED') return true;
  if (mode === 'ROOM_BASED') return false;

  // Intelligent fallback: if measurementMode was not explicitly persisted
  // Projects without DWG/CAD plans and with LV positions are treated as LV-based.
  const hasNoDwg = project.hasDwg === false || !project.dwgFileName;
  const hasNoPlans = (project.plansCount === 0 || !project.plans || project.plans.length === 0);
  const hasPositions = Number(project.totalPositions) > 0;
  const hasNoRooms = !project.rooms || project.rooms.length === 0;

  if (hasNoDwg && hasNoPlans && hasPositions && hasNoRooms) {
    return true;
  }

  return false;
}
