import { useMemo } from 'react';
import type { Position, Booking, Room } from '../../types';
import { getMaterialActualQty } from '../../services/firestoreService';

export interface PositionMetrics {
  planned: number;
  installed: number;
  delta: number;
  rest: number;
  stock: number;
  deviationType: 'over' | 'under' | 'exact';
  percent: number;
  isCompleted: boolean;
  isPartial: boolean;
  isOpen: boolean;
}

export function useMaterialMetrics(rooms: Room[] = [], bookings: Booking[] = []) {
  return useMemo(() => {
    return (pos: Position): PositionMetrics => {
      let roomInstalled = 0;
      let totalPlannedInRooms = 0;
      let remainingNeeded = 0;
      let hasRoomMatches = false;

      let confirmedOverconsumption = 0;
      let confirmedUnderconsumption = 0;
      let allRoomsCompleted = true;
      let matchedRoomsCount = 0;

      rooms.forEach(r => {
        const isUnlocked = r.isCompleted === false || r.status === 'in_progress';
        const isDone = !isUnlocked && (r.status === 'completed' || r.isCompleted === true || ((r as any).pct === 100));

        (r.materials || []).forEach(m => {
          const isMatch = 
            (m.positionId && m.positionId === pos.id) ||
            (m.posNr && m.posNr === pos.posNr) ||
            (m.shortText && pos.shortText && m.shortText.trim().toLowerCase() === pos.shortText.trim().toLowerCase());

          if (isMatch) {
            hasRoomMatches = true;
            matchedRoomsCount++;
            if (!isDone) {
              allRoomsCompleted = false;
            }

            const pl = Number(m.plannedQty) || 0;
            const act = getMaterialActualQty(m, r, bookings);
            roomInstalled += act;
            totalPlannedInRooms += pl;

            const roomDiff = act - pl;
            if (roomDiff > 0) {
              confirmedOverconsumption += roomDiff;
            } else if (roomDiff < 0) {
              if (isDone) {
                confirmedUnderconsumption += Math.abs(roomDiff);
              } else {
                remainingNeeded += Math.abs(roomDiff);
              }
            }
          }
        });
      });

      let standaloneBookingQty = 0;
      if (!hasRoomMatches && bookings.length > 0) {
        bookings.forEach(b => {
          const posId = b.positionId || (b as any).itemId;
          const posNr = b.positionNr || (b as any).itemOz;
          if (posId === pos.id || (posNr && posNr === pos.posNr)) {
            standaloneBookingQty += Number(b.quantity) || 0;
          }
        });
      }

      const installed = hasRoomMatches ? roomInstalled : Math.max(Number(pos.installedQty) || 0, standaloneBookingQty);
      const planned = (hasRoomMatches && totalPlannedInRooms > 0) ? totalPlannedInRooms : (Number(pos.qty) || 0);
      const rest = hasRoomMatches ? remainingNeeded : Math.max(0, planned - installed);
      
      const gaebQty = Number(pos.qty) || 0;
      const initialStock = (pos.deliveredQty !== undefined && pos.deliveredQty !== null)
        ? Number(pos.deliveredQty)
        : gaebQty;
      const stock = Math.max(0, initialStock - installed);
      
      const netConfirmedDelta = confirmedOverconsumption - confirmedUnderconsumption;
      let delta = 0;
      let deviationType: 'over' | 'under' | 'exact' = 'exact';

      if (hasRoomMatches) {
        if (confirmedOverconsumption > 0) {
          delta = netConfirmedDelta;
          deviationType = netConfirmedDelta > 0 ? 'over' : (netConfirmedDelta < 0 ? 'under' : 'exact');
        } else if (confirmedUnderconsumption > 0) {
          delta = -confirmedUnderconsumption;
          deviationType = 'under';
        } else {
          delta = 0;
          deviationType = 'exact';
        }
      } else {
        const rawDiff = installed - planned;
        if (rawDiff > 0) {
          delta = rawDiff;
          deviationType = 'over';
        } else if (rawDiff < 0 && (pos as any).isCompleted) {
          delta = rawDiff;
          deviationType = 'under';
        } else {
          delta = 0;
          deviationType = 'exact';
        }
      }

      const percent = planned > 0 
        ? Math.min(100, Math.max(0, Math.round((installed / planned) * 100))) 
        : (installed > 0 ? 100 : 0);

      const isCompleted = (hasRoomMatches && matchedRoomsCount > 0 && allRoomsCompleted && rest === 0) ||
        (!hasRoomMatches && planned > 0 && installed >= planned);
      const isPartial = installed > 0 && !isCompleted;
      const isOpen = installed === 0;

      return {
        planned,
        installed,
        delta,
        rest,
        stock,
        deviationType,
        percent,
        isCompleted,
        isPartial,
        isOpen
      };
    };
  }, [rooms, bookings]);
}
