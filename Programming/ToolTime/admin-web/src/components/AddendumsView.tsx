import React, { useState, useMemo, useEffect } from 'react';
import type { Addendum, Room, Position, Project, User as AppUser } from '../types';
import { 
  AlertCircle, 
  CheckCircle, 
  User, 
  MapPin, 
  Clock, 
  Package, 
  HelpCircle, 
  Plus, 
  Calendar,
  X,
  CheckCircle2,
  Minus,
  Send,
  AlertTriangle,
  Mail,
  FileText
} from 'lucide-react';
import { 
  updateAddendumStatus, 
  createAddendum, 
  getMaterialActualQty,
  convertAddendumToLvPosition
} from '../services/firestoreService';
import type { Booking } from '../types';
import { api } from '../services/apiClient';
import { getActiveTenantId } from '../services/firestoreService';

interface AddendumsViewProps {
  addendums: Addendum[];
  projectId?: string;
  project?: Project | null;
  rooms?: Room[];
  positions?: Position[];
  bookings?: Booking[];
  currentUser: AppUser;
  focusedItemId?: string | null;
}

/**
 * Determines whether an addendum was created by the Bauleiter via the portal
 * or submitted by an installer (Monteur) with their specific name.
 */
export function getAddendumCreator(item: Addendum): {
  isBauleiter: boolean;
  label: string;
  displayName: string;
} {
  const isBauleiter =
    item.createdByRole === 'bauleiter' ||
    item.deviationSource === 'gaeb_vs_dwg' ||
    Boolean(item.requestedBy && /bauleiter|projektleiter|portal/i.test(item.requestedBy));

  if (isBauleiter) {
    let name = item.requestedBy || 'Bauleiter';
    if (/^(bauleiter|projektleiter)$/i.test(name.trim())) {
      return {
        isBauleiter: true,
        label: 'Bauleiter',
        displayName: 'Bauleiter (Portal)'
      };
    }
    const cleanName = name.replace(/^bauleiter\s*\((.*)\)$/i, '$1').trim();
    return {
      isBauleiter: true,
      label: `Bauleiter (${cleanName})`,
      displayName: `Bauleiter (${cleanName})`
    };
  }

  const monteurName = item.requestedBy && item.requestedBy.trim() ? item.requestedBy.trim() : 'Monteur';
  return {
    isBauleiter: false,
    label: monteurName,
    displayName: `${monteurName} (Monteur)`
  };
}

export const AddendumsView: React.FC<AddendumsViewProps> = ({ 
  addendums, 
  projectId = '', 
  project,
  rooms = [], 
  positions = [],
  bookings = [], currentUser, focusedItemId
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'time' | 'material' | 'unclear'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'requested' | 'approved' | 'rejected' | 'needs_discussion'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  // New Addendum Form State
  const [newType, setNewType] = useState<'material' | 'unklar'>('material');
  const [newTitle, setNewTitle] = useState('');
  const [newPositionId, setNewPositionId] = useState('');
  const [positionSearch, setPositionSearch] = useState('');
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState('Stk');
  const [newRoomId, setNewRoomId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newRequestedBy, setNewRequestedBy] = useState('');

  // Single Material Request Modal State ("Material anfragen")
  const [reorderItem, setReorderItem] = useState<Addendum | null>(null);
  const [reorderQty, setReorderQty] = useState<number>(1);
  const [mailSubject, setMailSubject] = useState<string>('');
  const [mailBody, setMailBody] = useState<string>('');
  const [isProcessingReorder, setIsProcessingReorder] = useState<boolean>(false);
  const [reorderRecipient, setReorderRecipient] = useState<'primary' | 'deputy'>('primary');
  const [reorderError, setReorderError] = useState('');
  const [reorderOrderId, setReorderOrderId] = useState('');

  // Batch Material Request Modal State ("Sammel-Anfrage")
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchRecipient, setBatchRecipient] = useState<string>('');
  const [batchRecipientChoice, setBatchRecipientChoice] = useState<'primary' | 'deputy'>('primary');
  const [batchError, setBatchError] = useState('');
  const [batchOrderId, setBatchOrderId] = useState('');
  const [batchSubject, setBatchSubject] = useState<string>('');
  const [batchBody, setBatchBody] = useState<string>('');
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);

  // Rejection Modal State ("Ablehnen" mit Begründung)
  const [rejectItem, setRejectItem] = useState<Addendum | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string>('');
  const [isProcessingReject, setIsProcessingReject] = useState<boolean>(false);

  // Convert Addendum to LV Position Modal State
  const [convertingItem, setConvertingItem] = useState<Addendum | null>(null);
  const [lvPosNr, setLvPosNr] = useState<string>('');
  const [lvTitle, setLvTitle] = useState<string>('');
  const [lvQty, setLvQty] = useState<string>('');
  const [lvUnit, setLvUnit] = useState<string>('Stk');
  const [lvUnitPrice, setLvUnitPrice] = useState<string>('0');
  const [lvRoomId, setLvRoomId] = useState<string>('');
  const [isProcessingConvert, setIsProcessingConvert] = useState<boolean>(false);
  const [commercialNote, setCommercialNote] = useState<Record<string, string>>({});
  const [commercialBusy, setCommercialBusy] = useState<string | null>(null);
  const [commercialError, setCommercialError] = useState('');
  const [commercialErrorItemId, setCommercialErrorItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedItemId) return;
    setCategoryFilter('all'); setStatusFilter('all');
    const timer = window.setTimeout(() => document.getElementById(`addendum-${focusedItemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    return () => window.clearTimeout(timer);
  }, [focusedItemId, addendums.length]);

  // Auto-generate next Nachtrags-Positionsnummer (e.g. N-01, N-02)
  const nextNachtragNr = useMemo(() => {
    let highest = 0;
    positions.forEach(p => {
      const m = p.posNr?.match(/^N-?(\d+)$/i);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > highest) highest = num;
      }
    });
    const next = highest + 1;
    return `N-${next.toString().padStart(2, '0')}`;
  }, [positions]);

  const handleOpenConvertModal = (item: Addendum) => {
    const rawQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity).replace(',', '.')) || 1;
    const unit = item.qu || (typeof item.quantity === 'string' && item.quantity.includes('m') ? 'm' : 'Stk');

    const matchedRoom = rooms.find(r => 
      (item.roomId && (r.id === item.roomId || r.code === item.roomId)) ||
      (item.roomName && r.name.toLowerCase() === item.roomName.toLowerCase())
    );

    setConvertingItem(item);
    setLvPosNr(item.lvPosNr || item.itemOz || nextNachtragNr);
    setLvTitle(item.title || (item as any).materialName || 'Zusätzliche Leistung / Nachtrag');
    setLvQty(String(rawQty));
    setLvUnit(unit);
    setLvUnitPrice(item.unitPrice ? String(item.unitPrice) : '0');
    setLvRoomId(matchedRoom?.id || item.roomId || rooms[0]?.id || '');
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingItem || !projectId) return;

    try {
      setIsProcessingConvert(true);
      await convertAddendumToLvPosition(projectId, convertingItem, {
        posNr: lvPosNr,
        shortText: lvTitle,
        group: 'Nachträge',
        qty: parseFloat(lvQty.replace(',', '.')) || 1,
        qu: lvUnit,
        unitPrice: parseFloat(lvUnitPrice.replace(',', '.')) || 0,
        roomId: lvRoomId,
        rooms
      });
      setConvertingItem(null);
    } catch (err: any) {
      console.error('Fehler beim Konvertieren des Nachtrags:', err);
      alert('Fehler: ' + (err?.message || err));
    } finally {
      setIsProcessingConvert(false);
    }
  };

  // Fast lookups for positions
  const posMap = useMemo(() => new Map(positions.map(p => [p.posNr, p])), [positions]);
  const posIdMap = useMemo(() => new Map(positions.map(p => [p.id, p])), [positions]);
  const positionSuggestions = useMemo(() => positions.filter(position => !positionSearch.trim() || [position.posNr, position.shortText, position.group].some(value => value?.toLowerCase().includes(positionSearch.toLowerCase()))).slice(0, 30), [positions, positionSearch]);
  const canCommercialDecide = currentUser.role === 'admin' || (currentUser.role === 'kaufmaennisch' && (currentUser.assignedProjectIds?.includes(projectId) || [project?.commercialManagerId, project?.deputyCommercialManagerId, project?.commercialManagerEmail, project?.deputyCommercialManagerEmail].some(value => value && String(value).toLowerCase() === String(value.includes('@') ? currentUser.email : currentUser.id).toLowerCase())));
  const canManageAddendums = currentUser.role === 'admin' || currentUser.role === 'bauleiter';

  // Helper to compute project stock info for any item:
  // "noch verfügbar" vs "laut Projektplanung benötigt"
  const getItemStockInfo = (item: Addendum) => {
    const p = (item.materialId ? posIdMap.get(item.materialId) : undefined) ||
      (item.itemOz ? posMap.get(item.itemOz) : undefined) ||
      positions.find(pos => pos.shortText.trim().toLowerCase() === item.title.trim().toLowerCase());

    const qu = item.qu || p?.qu || 'Stk';

    // 1. Calculate installed & planned across rooms
    let projectInstalledTotal = 0;
    let totalPlannedAcrossRooms = 0;
    rooms.forEach(r => {
      (r.materials || []).forEach(m => {
        if (
          (p && (m.positionId === p.id || m.posNr === p.posNr)) ||
          m.shortText.trim().toLowerCase() === item.title.trim().toLowerCase() ||
          (item.itemOz && m.posNr === item.itemOz)
        ) {
          projectInstalledTotal += getMaterialActualQty(m, r, bookings);
          totalPlannedAcrossRooms += Number(m.plannedQty) || 0;
        }
      });
    });

    // Verfügbarkeit basiert strikt auf der GAEB-Datei (LV-Menge p.qty),
    // zzgl. etwaig manuell/per Nachbestellung erfasster Liefermengen (p.deliveredQty):
    const gaebQty = Number(p?.qty) || 0;
    const initialDelivered = (p && p.deliveredQty !== undefined && p.deliveredQty !== null)
      ? Number(p.deliveredQty)
      : gaebQty;

    // 3. Still needed in unfinished rooms
    let projectNeeded = 0;
    rooms.forEach(r => {
      const isUnlocked = r.isCompleted === false || r.status === 'in_progress';
      const isDone = !isUnlocked && (r.status === 'completed' || r.isCompleted === true || ((r as any).pct === 100));

      if (!isDone) {
        (r.materials || []).forEach(m => {
          if (
            (p && (m.positionId === p.id || m.posNr === p.posNr)) ||
            m.shortText.trim().toLowerCase() === item.title.trim().toLowerCase() ||
            (item.itemOz && m.posNr === item.itemOz)
          ) {
            const pl = Number(m.plannedQty) || 0;
            const act = getMaterialActualQty(m, r, bookings);
            const remaining = Math.max(0, pl - act);
            projectNeeded += remaining;
          }
        });
      }
    });

    const projectAvailable = Math.max(0, initialDelivered - projectInstalledTotal);
    const isSufficient = projectAvailable >= projectNeeded;
    const deficit = Math.max(0, projectNeeded - projectAvailable);

    return {
      projectAvailable,
      projectNeeded,
      isSufficient,
      deficit,
      qu,
      hasPositionMatch: !!p
    };
  };

  const managerName = reorderRecipient === 'deputy' ? project?.deputyCommercialManager : project?.commercialManager;
  const managerEmail = reorderRecipient === 'deputy' ? project?.deputyCommercialManagerEmail : project?.commercialManagerEmail;
  const managerFirstName = (managerName || 'kaufmännische Leitung').trim().split(/\s+/)[0];

  const generateMailContent = (item: Addendum, qty: number, unit: string, recipient: 'primary' | 'deputy' = reorderRecipient) => {
    const pName = project?.name || 'Bauvorhaben';
    const posStr = item.itemOz ? `Pos. ${item.itemOz}: ` : '';
    const creator = getAddendumCreator(item).displayName;
    const reason = item.description || item.note || 'Abweichung GAEB vs. DWG / Mehrbedarf';

    const subj = `Materialanfrage: ${qty} ${unit} ${posStr}${item.title} (Projekt ${pName})`;
    const firstName = (recipient === 'deputy' ? project?.deputyCommercialManager : project?.commercialManager)?.trim().split(/\s+/)[0] || 'kaufmännische Leitung';
    const body = `Hallo ${firstName},

für das Bauvorhaben "${pName}" muss folgendes Material aus einem Nachtrag angefragt und bestellt werden:

• Material: ${posStr}${item.title}
• Menge: ${qty} ${unit}
• Raum: ${item.roomName || item.roomId || 'Baustelle'}
• Begründung: ${reason}
• Erfasst von: ${creator}

Bitte prüfe die kaufmännische Freigabe und veranlasse die Bestellung beim Großhändler.

Viele Grüße,
Bauleitung`;
    return { subj, body };
  };

  // 1. Direct In-Stock Approval: "Material verfügbar - Freigeben"
  const handleApproveInStock = async (item: Addendum) => {
    await updateAddendumStatus(item.id, 'approved', projectId, {
      approvalType: 'in_stock'
    });
  };

  // For Regiestunden / Arbeitszeit
  const handleApproveHours = async (item: Addendum) => {
    await updateAddendumStatus(item.id, 'approved', projectId, {
      approvalType: 'in_stock'
    });
  };

  // 3. Open Reorder / Request Modal for single item
  const handleOpenReorderModal = (item: Addendum) => {
    const rawQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity).replace(',', '.')) || 1;
    const stockInfo = getItemStockInfo(item);
    const initQty = stockInfo.deficit > 0 ? stockInfo.deficit : Math.max(1, rawQty);
    const unit = item.qu || (typeof item.quantity === 'string' && item.quantity.includes('m') ? 'm' : 'Stk');
    const { subj, body } = generateMailContent(item, initQty, unit, 'primary');

    setReorderItem(item);
    setReorderRecipient('primary');
    setReorderError('');
    setReorderOrderId(crypto.randomUUID());
    setReorderQty(initQty);
    setMailSubject(subj);
    setMailBody(body);
  };

  const handleChangeReorderQty = (newQty: number) => {
    const unit = reorderItem?.qu || (typeof reorderItem?.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk');
    const clean = Math.max(1, Math.round(newQty * 10) / 10);
    setReorderQty(clean);

    if (reorderItem) {
      const { subj, body } = generateMailContent(reorderItem, clean, unit);
      setMailSubject(subj);
      setMailBody(body);
    }
  };

  const handleConfirmReorder = async () => {
    if (!reorderItem) return;
    if (!managerEmail) { setReorderError('Für dieses Projekt ist kein kaufmännischer Leiter mit E-Mail-Adresse hinterlegt. Bitte ergänze ihn in den Projekteinstellungen.'); return; }
    setIsProcessingReorder(true);
    setReorderError('');
    try {
      await api(`/tenants/${getActiveTenantId()}/projects/${projectId}/material-orders`, {
        method: 'POST', body: JSON.stringify({ recipient: reorderRecipient, subject: mailSubject, text: mailBody, orderId: reorderOrderId, addendumIds: [reorderItem.id], quantities: { [reorderItem.id]: reorderQty } }),
      });

      setReorderItem(null);
    } catch (err: any) {
      const details = err.details ? ` (${err.details})` : '';
      setReorderError(
        (err.code || err.message) === 'EMAIL_NOT_CONFIGURED' ? 'Der E-Mail-Versand ist noch nicht eingerichtet.' 
        : (err.code || err.message) === 'EMAIL_SEND_FAILED' ? `Die E-Mail konnte nicht gesendet werden${details}. Bitte prüfe die Resend-Konfiguration oder versuche es erneut.` 
        : (err.code || err.message) === 'COMMERCIAL_MANAGER_MISSING' ? 'Der kaufmännische Empfänger fehlt oder ist kein aktiver Benutzer dieser Firma. Bitte prüfe die Projektzuweisung.' 
        : `Bestellung fehlgeschlagen: ${err.details || err.message}`
      );
    } finally {
      setIsProcessingReorder(false);
    }
  };

  // Classify each addendum into 1 of the 3 requested categories:
  // 1. time: 'stunden' | 'zeit' | 'regie' (Mehr Zeit, Regie benötigt)
  // 2. material: 'material' | 'gaeb_vs_dwg' (Mehr Material benötigt / Mehrbedarf)
  // 3. unclear: 'unklar' | 'ausserplanmaessig' | isUnclear | Anderes Material verbaut
  const getItemCategory = (item: Addendum): 'time' | 'material' | 'unclear' => {
    const t = (item.type || '').toLowerCase();
    const note = (item.note || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const reason = ((item as any).reason || item.description || '').toLowerCase();
    const itemOz = (item.itemOz || '').toUpperCase();

    // 1. Time / Regie
    if (t === 'stunden' || t === 'zeit' || t === 'regie' || item.qu === 'h' || item.qu === 'Std') {
      return 'time';
    }

    // Explicit Material / GAEB vs DWG Nachtrag -> MUST be in 'material' (Mehr Material benötigt)
    if (item.deviationSource === 'gaeb_vs_dwg' || t === 'material') {
      return 'material';
    }

    // Explicit overrides for unclear
    if (item.isUnclear === true || t === 'unklar' || t === 'ausserplanmaessig' || t === 'außerplanmäßig' || t === 'anders') {
      return 'unclear';
    }

    // 2. Anderes Material verbaut (Unklar, außerplanmäßig, nicht im Plan, anders verbaut)
    if (
      t === 'unplanned' ||
      itemOz === 'UNKLAR' ||
      itemOz === 'ZUSATZ' ||
      note.includes('nicht im raumplan') ||
      note.includes('nicht im plan') ||
      note.includes('anders verbaut') ||
      note.includes('anderes material') ||
      reason.includes('nicht im raumplan') ||
      reason.includes('anders verbaut') ||
      reason.includes('anderes material') ||
      title.includes('anderes material') ||
      title.includes('anders verbaut')
    ) {
      return 'unclear';
    }

    // 3. Mehr Material benötigt (Default für alle Material-Nachträge & Mehrbedarfe)
    return 'material';
  };

  // Metrics
  const totalCount = addendums.length;
  const timeItems = addendums.filter(a => getItemCategory(a) === 'time');
  const materialItems = addendums.filter(a => getItemCategory(a) === 'material');
  const unclearItems = addendums.filter(a => getItemCategory(a) === 'unclear');

  const unrequestedMaterialItems = materialItems.filter(a => a.status === 'pending');
  const requestedMaterialItems = materialItems.filter(a => a.status === 'requested');

  const openTimeCount = timeItems.filter(a => a.status === 'pending').length;
  const openMaterialCount = unrequestedMaterialItems.length;
  const openUnclearCount = unclearItems.filter(a => a.status === 'pending').length;

  // 4. Batch Request Modal handlers
  const handleOpenBatchRequestModal = () => {
    if (unrequestedMaterialItems.length === 0) return;
    const pName = project?.name || 'Bauvorhaben';
    const subj = `Materialanfrage / Nachträge: ${unrequestedMaterialItems.length} Positionen (Projekt ${pName})`;

    const itemsList = unrequestedMaterialItems.map((item, idx) => {
      const posStr = item.itemOz ? `Pos. ${item.itemOz}: ` : '';
      const creator = getAddendumCreator(item).displayName;
      const reason = item.description || item.note || 'Abweichung GAEB vs. DWG / Mehrbedarf';
      return `${idx + 1}. ${posStr}${item.title}
   • Menge: ${item.quantity} ${item.qu || 'Stk'}
   • Raum: ${item.roomName || item.roomId || 'Baustelle'}
   • Begründung: ${reason}
   • Erfasst von: ${creator}`;
    }).join('\n\n');

    const body = `Hallo ${(project?.commercialManager || 'kaufmännische Leitung').trim().split(/\s+/)[0]},

für das Bauvorhaben "${pName}" müssen folgende ${unrequestedMaterialItems.length} Materialien aus Nachträgen und Planungsabweichungen angefragt und bestellt werden:

${itemsList}

Bitte prüfe die kaufmännische Freigabe und veranlasse die Bestellung beim Großhändler.

Viele Grüße,
Bauleitung`;

    setBatchRecipient(managerEmail || '');
    setBatchRecipientChoice('primary');
    setBatchError('');
    setBatchOrderId(crypto.randomUUID());
    setBatchSubject(subj);
    setBatchBody(body);
    setIsBatchModalOpen(true);
  };

  const handleConfirmBatchRequest = async () => {
    if (!batchRecipient) { setBatchError('Für dieses Projekt ist kein kaufmännischer Leiter mit E-Mail-Adresse hinterlegt.'); return; }
    setIsProcessingBatch(true);
    setBatchError('');
    try {
      const ids = unrequestedMaterialItems.map(i => i.id);
      await api(`/tenants/${getActiveTenantId()}/projects/${projectId}/material-orders`, {
        method: 'POST', body: JSON.stringify({ recipient: batchRecipientChoice, subject: batchSubject, text: batchBody, orderId: batchOrderId, addendumIds: ids }),
      });

      setIsBatchModalOpen(false);
    } catch (err: any) {
      console.warn('Error confirming batch request:', err.message);
      const details = err.details ? ` (${err.details})` : '';
      setBatchError(
        (err.code || err.message) === 'EMAIL_NOT_CONFIGURED' ? 'Der E-Mail-Versand ist noch nicht eingerichtet.' 
        : (err.code || err.message) === 'EMAIL_SEND_FAILED' ? `Die E-Mail konnte nicht gesendet werden${details}. Bitte prüfe die Resend-Konfiguration oder versuche es erneut.` 
        : (err.code || err.message) === 'COMMERCIAL_MANAGER_MISSING' ? 'Der kaufmännische Empfänger fehlt oder ist kein aktiver Benutzer dieser Firma. Bitte prüfe die Projektzuweisung.' 
        : `Sammelanfrage fehlgeschlagen: ${err.details || err.message}`
      );
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Mark requested item as ordered / approved
  const handleCommercialDecision = async (item: Addendum, decision: 'approved' | 'needs_discussion') => {
    try {
      setCommercialBusy(item.id); setCommercialError(''); setCommercialErrorItemId(null);
      await api(`/tenants/${getActiveTenantId()}/projects/${projectId}/addendums/${item.id}/commercial-decision`, { method: 'POST', body: JSON.stringify({ decision, note: commercialNote[item.id] || '' }) });
    } catch (err: any) {
      setCommercialError(err.message || 'Entscheidung konnte nicht gespeichert werden.'); setCommercialErrorItemId(item.id);
    } finally { setCommercialBusy(null); }
  };

  // 3. Confirm Rejection: "Ablehnen" mit Begründung
  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    if (!rejectReason.trim()) {
      setRejectError('Bitte geben Sie einen Grund für die Ablehnung an.');
      return;
    }

    setIsProcessingReject(true);
    try {
      // Nach Klick "abgelehnt", verfügbare Menge ändert sich nicht
      await updateAddendumStatus(rejectItem.id, 'rejected', projectId, {
        rejectionReason: rejectReason.trim(),
      });
      setRejectItem(null);
      setRejectReason('');
      setRejectError('');
    } catch (err: any) {
      console.warn('Error rejecting addendum:', err.message);
    } finally {
      setIsProcessingReject(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPosition = positions.find(position => position.id === newPositionId);
    if (newType === 'material' && !selectedPosition) { setCreateError('Bitte wähle eine bestehende LV-Position aus.'); return; }
    if (newType === 'unklar' && !newTitle.trim()) { setCreateError('Bitte gib eine Materialbezeichnung ein.'); return; }
    if (!Number.isFinite(Number(newQty.replace(',', '.'))) || Number(newQty.replace(',', '.')) <= 0) { setCreateError('Bitte gib eine gültige Menge ein.'); return; }

    const selectedRoom = rooms.find(r => r.id === newRoomId);
    const creatorLabel = newRequestedBy.trim() ? `Bauleiter (${newRequestedBy.trim()})` : 'Bauleiter';
    setCreateBusy(true); setCreateError('');
    try { await createAddendum(projectId, {
      type: newType,
      title: newType === 'material' ? selectedPosition!.shortText : newTitle.trim(),
      quantity: Number(newQty.replace(',', '.')),
      qu: newType === 'material' ? selectedPosition!.qu : newUnit,
      materialId: selectedPosition?.id || '',
      itemOz: selectedPosition?.posNr || '',
      unitPrice: selectedPosition?.unitPrice || 0,
      isNewMaterial: newType === 'unklar',
      roomId: newRoomId || 'allgemein',
      roomName: selectedRoom ? selectedRoom.name : 'Baustelle allgemein',
      note: [newType === 'unklar' && newManufacturer.trim() ? `Hersteller: ${newManufacturer.trim()}` : '', newNote.trim()].filter(Boolean).join('\n'),
      requestedBy: creatorLabel,
      createdByRole: 'bauleiter',
      deviationSource: 'manual',
      status: 'pending',
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewPositionId(''); setPositionSearch(''); setNewManufacturer('');
    setNewQty('');
    setNewNote('');
    setNewRequestedBy('');
    } catch (error) { setCreateError(error instanceof Error ? error.message : 'Mehrbedarf konnte nicht gespeichert werden.'); }
    finally { setCreateBusy(false); }
  };

  // Bauleiter direct category switcher
  const handleSwitchCategory = async (item: Addendum, newCat: 'material' | 'unclear') => {
    try {
      const cleanStatus = (item.status === 'approved' || item.status === 'rejected') ? item.status : 'pending';
      await updateAddendumStatus(item.id, cleanStatus, projectId, {
        type: newCat === 'unclear' ? 'unklar' : 'material',
        isUnclear: newCat === 'unclear',
      });
    } catch (err: any) {
      console.warn('Error switching category:', err.message);
    }
  };

  // Filtered List
  const displayedList = addendums.filter(item => {
    const cat = getItemCategory(item);
    if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Nachträge
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Baustellen-Mehraufwände: Mehrstunden/Regie, zusätzliches Material und ungeplant verbaute Bauteile
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {canManageAddendums && unrequestedMaterialItems.length > 0 && (
            <button
              onClick={handleOpenBatchRequestModal}
              className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title={`${unrequestedMaterialItems.length} offene Material-Nachträge gesammelt per E-Mail an ${managerFirstName} anfragen`}
            >
              <Mail className="w-4 h-4" />
              <span>Material anfragen ({unrequestedMaterialItems.length})</span>
            </button>
          )}

          {canManageAddendums && <button
            onClick={() => { setCreateError(''); setIsCreateModalOpen(true); }}
            className="inline-flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Mehrbedarf erfassen</span>
          </button>}
        </div>
      </div>

      {/* KPI Cards: The 3 Core Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category 1: Time / Hours */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'time' ? 'all' : 'time')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-amber-400 ${
            categoryFilter === 'time' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Mehr Zeit, Regie benötigt</span>
                <span className="text-[10px] text-slate-400">Verzögerung, Mehraufwand</span>
              </div>
            </div>
            <span className="text-xl font-black text-amber-600">
              {openTimeCount}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
              openTimeCount > 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-100'
            }`}>
              {openTimeCount} ausstehend
            </span>
          </div>
        </div>

        {/* Category 2: Additional Material */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'material' ? 'all' : 'material')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-blue-400 flex flex-col justify-between ${
            categoryFilter === 'material' ? 'ring-2 ring-[#3B82C4] border-[#3B82C4]' : 'border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Mehr Material benötigt</span>
                  <span className="text-[10px] text-slate-400">Zusatzmaterial, Mehrbedarf</span>
                </div>
              </div>
              <span className="text-xl font-black text-[#3B82C4]">
                {openMaterialCount}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
              <div className="flex items-center space-x-1.5">
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  openMaterialCount > 0 ? 'text-blue-700 bg-blue-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {openMaterialCount} ausstehend
                </span>
                {requestedMaterialItems.length > 0 && (
                  <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full text-[10px]">
                    {requestedMaterialItems.length} angefragt
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action button inside card */}
          {canManageAddendums && unrequestedMaterialItems.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={handleOpenBatchRequestModal}
                className="w-full flex items-center justify-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                title={`${unrequestedMaterialItems.length} offene Positionen gesammelt per E-Mail bei ${managerFirstName} anfragen`}
              >
                <Mail className="w-4 h-4" />
                <span>Material anfragen ({unrequestedMaterialItems.length})</span>
              </button>
            </div>
          ) : requestedMaterialItems.length > 0 ? (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-center space-x-1.5 text-[11px] text-indigo-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Alle offenen Posten bei {managerFirstName} angefragt</span>
            </div>
          ) : null}
        </div>

        {/* Category 3: Unplanned Material Installed */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'unclear' ? 'all' : 'unclear')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-purple-400 ${
            categoryFilter === 'unclear' ? 'ring-2 ring-purple-500 border-purple-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Anderes Material verbaut</span>
                <span className="text-[10px] text-slate-400">Planabweichung, nicht im Plan</span>
              </div>
            </div>
            <span className="text-xl font-black text-purple-600">
              {openUnclearCount}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
              openUnclearCount > 0 ? 'text-purple-700 bg-purple-50' : 'text-slate-500 bg-slate-100'
            }`}>
              {openUnclearCount} ausstehend
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all' as const, label: `Alle Meldungen (${totalCount})` },
            { id: 'time' as const, label: `⏱ Mehr Zeit, Regie (${timeItems.length})` },
            { id: 'material' as const, label: `📦 Mehr Material benötigt (${materialItems.length})` },
            { id: 'unclear' as const, label: `❓ Anderes Material (${unclearItems.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                categoryFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'all' as const, label: 'Alle Status' },
            { id: 'pending' as const, label: `To-Do / Offen (${openTimeCount + openMaterialCount + openUnclearCount})` },
            { id: 'requested' as const, label: `Angefragt (${requestedMaterialItems.length})` },
            { id: 'needs_discussion' as const, label: 'Rücksprache' },
            { id: 'approved' as const, label: 'Freigegeben' },
            { id: 'rejected' as const, label: 'Abgelehnt' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s.id
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid: Kacheln */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Keine Einträge für diese Filterauswahl</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aktuell liegen für diesen Filter keine Mehrbedarfe oder unklaren Positionen vor. Alle Leistungen verlaufen planmäßig.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedList.map(item => {
            const cat = getItemCategory(item);
            const isPending = item.status === 'pending';
            const isRequested = item.status === 'requested';
            const needsDiscussion = item.status === 'needs_discussion';
            const isApproved = item.status === 'approved';
            const isRejected = item.status === 'rejected';
            const stockInfo = (cat === 'material' || cat === 'unclear') ? getItemStockInfo(item) : null;
            const hasExistingPosition = item.deviationSource === 'gaeb_vs_dwg' || !!(item.materialId && posIdMap.has(item.materialId)) || !!(item.itemOz && posMap.has(item.itemOz)) || positions.some(position => position.shortText.trim().toLowerCase() === item.title.trim().toLowerCase());
            const canCreateLv = cat !== 'time' && !item.isLvPosition && !item.lvPosNr && !hasExistingPosition;

            // Styling based on category
            const theme = cat === 'time' ? {
              badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
              icon: Clock,
              iconColor: 'text-amber-600',
              label: '⏱ Mehr Zeit, Regie benötigt',
              tagBg: 'bg-amber-50 text-amber-700',
            } : cat === 'unclear' ? {
              badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
              icon: HelpCircle,
              iconColor: 'text-purple-600',
              label: '❓ Anderes Material verbaut',
              tagBg: 'bg-purple-50 text-purple-700',
            } : {
              badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
              icon: Package,
              iconColor: 'text-[#3B82C4]',
              label: '📦 Mehr Material benötigt',
              tagBg: 'bg-blue-50 text-[#3B82C4]',
            };

            const IconComp = theme.icon;

            return (
              <div 
                key={item.id} id={`addendum-${item.id}`}
                className={`bg-white rounded-2xl border shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 ${focusedItemId === item.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'}`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Category Badge + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${theme.badgeBg}`}>
                        <IconComp className={`w-3.5 h-3.5 ${theme.iconColor}`} />
                        <span>{theme.label}</span>
                      </span>

                      {/* Bauleiter category toggle for pending material items */}
                      {canManageAddendums && cat !== 'time' && isPending && (
                        <button
                          type="button"
                          onClick={() => handleSwitchCategory(item, cat === 'material' ? 'unclear' : 'material')}
                          className="text-[10px] text-slate-400 hover:text-slate-700 hover:underline transition-colors"
                          title={cat === 'material' ? "Als 'Anderes Material verbaut' einstufen" : "Als 'Mehr Material benötigt' einstufen"}
                        >
                          {cat === 'material' ? "→ Zu 'Anderes Material' wechseln" : "→ Zu 'Mehr Material benötigt' wechseln"}
                        </button>
                      )}
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      isRejected ? 'bg-red-100 text-red-800 border border-red-200' :
                      needsDiscussion ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                      isRequested ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                      'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {isApproved 
                        ? (item.approvalType === 'reordered' 
                            ? `Freigegeben (Nachbestellt: ${item.reorderedQty || item.quantity})` 
                            : (cat === 'unclear' ? 'Geprüft & Hinweis geschlossen' : 'Freigegeben (Lagerbestand)')) 
                        : isRejected ? 'Abgelehnt' : needsDiscussion ? 'Rücksprache erforderlich'
                        : isRequested ? (item.requestedTo ? `Angefragt bei ${item.requestedTo}` : 'Angefragt')
                        : 'Ausstehend'}
                    </span>
                  </div>

                  {/* Title & Quantity Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base leading-snug">
                        {item.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg block">
                        {item.quantity} {item.qu && !String(item.quantity).includes(item.qu) ? item.qu : ''}
                      </span>
                    </div>
                  </div>

                  {/* Room & Submitter Meta Info */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 pt-1">
                    {item.roomId && item.roomId !== 'allgemein' && item.roomName !== 'Baustelle' && <div className="flex items-center space-x-1 text-[#3B82C4] font-medium bg-blue-50/60 px-2 py-0.5 rounded-md">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{item.roomName || item.roomId || 'Baustelle'}</span>
                    </div>}

                    {/* Submitter: Bauleiter (Portal) vs. Monteurname */}
                    {(() => {
                      const creator = getAddendumCreator(item);
                      return (
                        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          creator.isBauleiter
                            ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          <User className={`w-3.5 h-3.5 ${creator.isBauleiter ? 'text-amber-600' : 'text-slate-500'}`} />
                          <span className="text-slate-500 font-normal">Eingestellt von:</span>
                          <span className="font-bold">{creator.displayName}</span>
                        </div>
                      );
                    })()}


                    <div className="flex items-center space-x-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('de-DE') : '-'}</span>
                    </div>
                  </div>

                  {/* Info-Banner if status is requested */}
                  {isRequested && (
                    <div className="p-3 rounded-xl bg-blue-50/90 border border-blue-200 text-xs text-blue-900 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold">Bei kfm. Leitung ({item.requestedTo || managerFirstName}) angefragt</span>
                            <span className="text-[10px] bg-blue-200/80 text-blue-800 font-semibold px-1.5 py-0.2 rounded-full">
                              Offene Anfrage
                            </span>
                          </div>
                          {item.requestedAt && (
                            <span className="text-[11px] text-blue-700 block mt-0.5">
                              Versendet am: {new Date(item.requestedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Begründung / Notiz / Raumverteilung */}
                  {(item.description || item.note) && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block">
                        {item.deviationSource === 'gaeb_vs_dwg'
                          ? 'Begründung & Raumverteilung (Bauleitung / GAEB vs. DWG):'
                          : 'Begründung / Notiz:'}
                      </span>
                      <p className="leading-relaxed italic whitespace-pre-wrap">„{item.description || item.note}“</p>
                    </div>
                  )}

                  {/* Special indicator for unclear items */}
                  {cat === 'unclear' && (
                    <div className="flex items-center space-x-2 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
                      <HelpCircle className="w-4 h-4 shrink-0 text-purple-600" />
                      <span>
                        {item.isOrdered
                          ? `Teil ist bereits im Materialstamm vorhanden (Pos. ${item.itemOz || '–'}), war aber nicht diesem Raum zugeordnet.`
                          : 'Neues/Alternatives Fabrikat verbaut, das zuvor nicht in der Planung hinterlegt war.'}
                      </span>
                    </div>
                  )}

                  {/* Projektweiter Materialbestand & Bedarfsampel (Entscheidungshilfe für Bauleitung) */}
                  {stockInfo && !stockInfo.hasPositionMatch && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Neues Material: Ein LV-Bestand ist noch nicht erfasst.</div>}
                  {stockInfo?.hasPositionMatch && (
                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span className="flex items-center space-x-1">
                          <Package className="w-3.5 h-3.5 text-[#3B82C4]" />
                          <span>Projektweiter Materialbestand</span>
                        </span>
                        {stockInfo.isSufficient ? (
                          <span className="inline-flex items-center space-x-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Bestand reicht für Restprojekt aus</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10.5px] font-bold text-red-800 bg-red-100/90 px-2 py-0.5 rounded-full border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>Fehlmenge: {stockInfo.deficit} {stockInfo.qu}</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Noch verfügbar</span>
                          <span className={`text-sm font-black block mt-0.5 ${stockInfo.isSufficient ? 'text-emerald-700' : 'text-red-600'}`}>
                            {stockInfo.projectAvailable} {stockInfo.qu}
                          </span>
                          <span className="text-[9px] text-slate-400 block">Lager / Projektbestand</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Laut Planung benötigt</span>
                          <span className="text-sm font-black text-slate-800 block mt-0.5">
                            {stockInfo.projectNeeded} {stockInfo.qu}
                          </span>
                          <span className="text-[9px] text-slate-400 block">in weiteren Räumen</span>
                        </div>
                      </div>

                      {!stockInfo.isSufficient && (
                        <p className="text-[10.5px] text-red-700 font-medium bg-red-50/80 p-1.5 rounded-md text-center">
                          Achtung: Der verbleibende Bestand reicht nicht für alle weiteren Räume aus! Bitte nachbestellen.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Rejection reason notice if rejected */}
                  {isRejected && item.rejectionReason && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                      <span className="font-bold text-[10.5px] text-red-600 uppercase tracking-wider flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        <span>Begründung der Ablehnung:</span>
                      </span>
                      <p className="leading-relaxed font-medium italic">„{item.rejectionReason}“</p>
                    </div>
                  )}

                </div>

                {/* LV Position Confirmation Badge */}
                {(item.isLvPosition || item.lvPosNr) && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 shadow-2xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-emerald-900">Echte LV-Position {item.lvPosNr}</span>
                          <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded shrink-0">
                            Aufmessbar
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-700 block truncate mt-0.5">
                          {item.targetRoomName ? `In Raum „${item.targetRoomName}“ hinterlegt` : 'Im Projekt hinterlegt'} • Für Monteure in der App aufmessbar
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenConvertModal(item)}
                      className="text-[11px] font-semibold text-[#3B82C4] hover:underline shrink-0 ml-2"
                    >
                      Anpassen
                    </button>
                  </div>
                )}

                {/* Entscheidungen zum Materialbedarf */}
                {(isRequested || needsDiscussion) && item.commercialNote && <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">Rücksprache: {item.commercialNote}</p>}
                {needsDiscussion && canManageAddendums && <button type="button" onClick={() => handleOpenReorderModal(item)} className="self-start rounded-xl bg-[#3B82C4] px-4 py-2 text-xs font-bold text-white">Anfrage überarbeitet erneut senden</button>}
                {(isRequested || needsDiscussion) && canCommercialDecide && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <label className="block text-xs font-semibold text-slate-700">Notiz für die Bauleitung
                      <textarea value={commercialNote[item.id] || ''} onChange={event => setCommercialNote(previous => ({ ...previous, [item.id]: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="Optional bei Freigabe, erforderlich für Rücksprache" />
                    </label>
                    {commercialError && commercialErrorItemId === item.id && <p role="alert" className="text-xs text-red-700">{commercialError}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={!!commercialBusy} onClick={() => void handleCommercialDecision(item, 'approved')} className="rounded-xl bg-[#2FA36B] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Bestellt / Freigeben</button>
                      <button type="button" disabled={!!commercialBusy || !commercialNote[item.id]?.trim()} onClick={() => void handleCommercialDecision(item, 'needs_discussion')} className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-900 disabled:opacity-50">Rücksprache erforderlich</button>
                    </div>
                  </div>
                )}
                {isPending && canManageAddendums && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {cat === 'time' ? <button type="button" onClick={() => void handleApproveHours(item)} className="rounded-xl bg-[#2FA36B] px-3.5 py-2 text-xs font-bold text-white">Regiestunden freigeben</button> : <>
                      <button type="button" onClick={() => void handleApproveInStock(item)} className="rounded-xl bg-[#2FA36B] px-3.5 py-2 text-xs font-bold text-white">verfügbar - freigeben</button>
                      <button type="button" onClick={() => handleOpenReorderModal(item)} className="rounded-xl bg-[#3B82C4] px-3.5 py-2 text-xs font-bold text-white">nicht verfügbar - anfragen</button>
                      {canCreateLv && <button type="button" onClick={() => handleOpenConvertModal(item)} className="rounded-xl border border-amber-300 bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900">Als neue LV-Position anlegen</button>}
                    </>}
                    <button type="button" onClick={() => { setRejectItem(item); setRejectReason(''); setRejectError(''); }} className="rounded-xl border border-red-300 px-3.5 py-2 text-xs font-bold text-red-700">Ablehnen</button>
                  </div>
                )}
                {isApproved && canCreateLv && <button type="button" onClick={() => handleOpenConvertModal(item)} className="self-start rounded-xl border border-amber-300 bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900">Als neue LV-Position anlegen</button>}

              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Mehrbedarf manuell erfassen */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-7 sm:p-9 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-[#3B82C4]" />
                <span>Mehrbedarf erfassen</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-5 text-sm">
              <div>
                <label className="mb-2 block font-bold text-slate-700">Art des Mehrbedarfs *</label>
                <div className="grid grid-cols-2 gap-3">
                  {([{ id: 'material' as const, label: 'Mengenmehrung', sub: 'Bestehende LV-Position' }, { id: 'unklar' as const, label: 'Neues Material', sub: 'Noch nicht im LV enthalten' }]).map(option => <button type="button" key={option.id} onClick={() => { setNewType(option.id); setNewPositionId(''); setPositionSearch(''); setNewTitle(''); }} className={`rounded-xl border p-4 text-left ${newType === option.id ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200'}`}><span className="block font-bold">{option.label}</span><span className="text-xs text-slate-500">{option.sub}</span></button>)}
                </div>
              </div>
              {newType === 'material' ? <div>
                <label className="mb-2 block font-bold text-slate-700">LV-Position suchen *</label>
                <input type="search" value={positionSearch} onChange={event => { setPositionSearch(event.target.value); setNewPositionId(''); }} placeholder="Positionsnummer, Material oder Gewerk" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
                <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200">{positionSuggestions.map(position => <button type="button" key={position.id} onClick={() => { setNewPositionId(position.id); setPositionSearch(`${position.posNr} · ${position.shortText}`); setNewUnit(position.qu); }} className={`block w-full border-b border-slate-100 px-4 py-2 text-left hover:bg-blue-50 ${newPositionId === position.id ? 'bg-blue-50 font-bold' : ''}`}><span className="font-mono">{position.posNr}</span> · {position.shortText} <span className="text-slate-500">({position.group || 'Ohne Gewerk'})</span></button>)}{positionSuggestions.length === 0 && <p className="p-3 text-slate-500">Keine passende LV-Position gefunden.</p>}</div>
                {newPositionId && (() => { const position = positions.find(entry => entry.id === newPositionId); return position && <p className="mt-2 rounded-lg bg-slate-50 p-3">GAEB-Sollmenge: {position.qty} {position.qu} · Einzelpreis: {(position.unitPrice || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>; })()}
              </div> : <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-bold text-slate-700">Material- oder Bauteilbezeichnung *<input required value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="z. B. Filter DN 25" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                <label className="font-bold text-slate-700">Hersteller (optional)<input value={newManufacturer} onChange={event => setNewManufacturer(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <label className="font-bold text-slate-700">Zusätzliche Menge *<input type="number" min="0.01" step="any" required value={newQty} onChange={event => setNewQty(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                <label className="font-bold text-slate-700">Einheit{newType === 'material' ? <input readOnly value={positions.find(position => position.id === newPositionId)?.qu || 'LV-Position wählen'} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3" /> : <select value={newUnit} onChange={event => setNewUnit(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"><option value="Stk">Stück (Stk)</option><option value="m">Meter (m)</option><option value="m²">Quadratmeter (m²)</option><option value="kg">Kilogramm (kg)</option><option value="Psch">Pauschal</option></select>}</label>
              </div>

              {/* Room Assignment */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Zugehöriger Raum</label>
                <select
                  value={newRoomId}
                  onChange={e => setNewRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                >
                  <option value="">Baustelle allgemein</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code || 'Raum'}) - {r.floor}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note / Details */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Begründung / Zusätzliche Notiz</label>
                <textarea
                  rows={2}
                  placeholder="Details zur Ursache, Baustellenbedingungen oder Notwendigkeit..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Requested By */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Eingestellt von</label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-2 rounded-xl whitespace-nowrap">
                    Bauleiter (Portal)
                  </span>
                  <input
                    type="text"
                    placeholder="Name des Bauleiters (optional, z. B. Florian Burk)"
                    value={newRequestedBy}
                    onChange={e => setNewRequestedBy(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs"
                  />
                </div>
              </div>

              {createError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{createError}</p>}
              {/* Action Buttons */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="px-5 py-2 rounded-xl bg-[#3B82C4] hover:bg-[#2B6EB0] text-white font-bold shadow-sm transition-all"
                >
                  {createBusy ? 'Wird gespeichert …' : 'Mehrbedarf anlegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Material Nachbestellen mit Stepper & E-Mail-Entwurf */}
      {reorderItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-7 sm:p-9 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-[#3B82C4]" />
                <h3 className="font-bold text-base text-slate-900">
                  Material-Nachbestellung an Kfm. Leitung
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReorderItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-sm">
              {/* Top Box: Stepper [-] QTY [+] and Product Details */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-blue-950 text-sm">
                      {reorderItem.title}
                    </h4>
                    <span className="text-blue-700 text-xs">
                      Raum: <strong>{reorderItem.roomName || reorderItem.roomId || 'Baustelle'}</strong>
                    </span>
                  </div>

                  {/* Stepper: [-]  QTY  [+] */}
                  <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-blue-300 shadow-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => handleChangeReorderQty(reorderQty - 1)}
                      className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center justify-center transition-colors"
                      title="Menge verringern"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min={1}
                      value={reorderQty}
                      onChange={e => handleChangeReorderQty(parseFloat(e.target.value) || 1)}
                      className="w-16 px-1.5 py-1 text-center font-black text-sm bg-white rounded-lg text-blue-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() => handleChangeReorderQty(reorderQty + 1)}
                      className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center justify-center transition-colors"
                      title="Menge erhöhen"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="font-bold text-blue-800 px-2 text-xs">
                      {reorderItem.qu || (typeof reorderItem.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk')}
                    </span>
                  </div>
                </div>

                {reorderItem.note && (
                  <div className="pt-2 border-t border-blue-200/70 text-[11px] text-blue-900 italic">
                    Notiz vom Monteur: „{reorderItem.note}“
                  </div>
                )}
              </div>

              {/* Recipient */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Empfänger (Kaufmännische Leitung / Einkauf) *
                </label>
                {!project?.commercialManagerEmail && <p role="alert" className="mb-2 rounded-lg bg-red-50 p-3 text-red-700">Kein kaufmännischer Leiter mit E-Mail-Adresse hinterlegt. Bitte ergänze ihn in den Projekteinstellungen.</p>}
                <select
                  value={reorderRecipient}
                  onChange={event => {
                    const recipient = event.target.value as 'primary' | 'deputy';
                    setReorderRecipient(recipient);
                    setReorderError('');
                    if (reorderItem) {
                      const unit = reorderItem.qu || (typeof reorderItem.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk');
                      const { body } = generateMailContent(reorderItem, reorderQty, unit, recipient);
                      setMailBody(body);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800"
                >
                  <option value="primary">{project?.commercialManager || 'Kaufmännische Leitung'} · {project?.commercialManagerEmail || 'E-Mail fehlt'}</option>
                  {project?.deputyCommercialManagerEmail && <option value="deputy">Vertretung: {project.deputyCommercialManager || 'Kaufmännische Leitung'} · {project.deputyCommercialManagerEmail}</option>}
                </select>
                {managerEmail && <p className="mt-1 text-xs text-slate-600">Die E-Mail wird an {managerName || 'Kaufmännische Leitung'} &lt;{managerEmail}&gt; gesendet.</p>}
              </div>

              {/* Subject */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Betreffzeile *</label>
                <input
                  type="text"
                  value={mailSubject}
                  onChange={e => setMailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Body */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nachrichtentext (Anrede mit Vorname: {managerFirstName}) *
                </label>
                <textarea
                  rows={12}
                  value={mailBody}
                  onChange={e => setMailBody(e.target.value)}
                  className="w-full min-h-72 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {reorderError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{reorderError}</p>}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReorderItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  disabled={isProcessingReorder || !managerEmail || !mailSubject.trim() || !mailBody.trim()}
                  onClick={handleConfirmReorder}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#3B82C4] hover:bg-[#2B6EB0] text-white font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Bestellung absenden &amp; freigeben ({reorderQty} {reorderItem.qu || (typeof reorderItem.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk')})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mehrbedarf Ablehnen mit Pflicht-Begründung */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Mehrbedarf ablehnen
                  </h3>
                  <p className="text-xs text-slate-500">
                    Begründung für Monteur &amp; Bauakte erfassen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Item Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Betroffener Mehrbedarf:</span>
              <p className="font-bold text-sm text-slate-900">{rejectItem.title}</p>
              <div className="flex items-center justify-between text-slate-600 pt-0.5">
                <span>Menge: <strong>{rejectItem.quantity} {rejectItem.qu || ''}</strong></span>
                <span>Raum: <strong>{rejectItem.roomName || rejectItem.roomId || 'Baustelle'}</strong></span>
              </div>
            </div>

            {/* Rejection Reason Form */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 text-xs block">
                Grund für die Ablehnung *
              </label>
              <textarea
                rows={4}
                placeholder="z. B. Material nicht erforderlich / VOB-Planungsfehler / bereits im Vorfeld geliefert..."
                value={rejectReason}
                onChange={e => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError('');
                }}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  rejectError 
                    ? 'border-red-400 ring-2 ring-red-300/40 bg-red-50/20' 
                    : 'border-slate-200 focus:ring-[#3B82C4]/30'
                }`}
              />
              {rejectError && (
                <p className="text-[11px] font-semibold text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{rejectError}</span>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isProcessingReject}
                onClick={handleConfirmReject}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20 transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                Endgültig ablehnen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sammelanfrage Material an kaufmännische Leitung (Andreas) */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#3B82C4]">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Sammelanfrage Material an kaufmännische Leitung
                  </h3>
                  <p className="text-xs text-slate-500">
                    {unrequestedMaterialItems.length} offene Position(en) werden an {managerFirstName} übermittelt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 text-xs pr-1">
              {/* Info banner */}
              <div className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl text-blue-900 text-xs flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="leading-relaxed">
                  Nach dem Klick auf Absenden wird die E-Mail an <strong>{batchRecipient || 'die kaufmännische Leitung'}</strong> versendet.
                  Erst danach werden die {unrequestedMaterialItems.length} Positionen als <strong>„angefragt“</strong> markiert.
                </div>
              </div>

              {/* Items Summary Table / List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 flex justify-between">
                  <span>Enthaltene Positionen ({unrequestedMaterialItems.length})</span>
                  <span>Menge / Raum</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto bg-white">
                  {unrequestedMaterialItems.map((item, idx) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="pr-3">
                        <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                          <span className="text-slate-400 font-mono text-[11px]">{idx + 1}.</span>
                          {(() => {
                            const creator = getAddendumCreator(item);
                            return (
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                creator.isBauleiter
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {creator.isBauleiter ? 'Bauleiter (Portal)' : creator.displayName}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                          Grund: {item.description || item.note || 'Abweichung GAEB vs. DWG'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900">{item.quantity} {item.qu || 'Stk'}</span>
                        <span className="block text-[10px] text-slate-400">{item.roomName || item.roomId || 'Baustelle'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Empfänger (Kaufmännische Leitung) *</label>
                {!project?.commercialManagerEmail && <p role="alert" className="mb-2 rounded-lg bg-red-50 p-3 text-red-700">Kein kaufmännischer Leiter mit E-Mail-Adresse hinterlegt. Bitte ergänze ihn in den Projekteinstellungen.</p>}
                <select value={batchRecipientChoice} onChange={e => {
                  const choice = e.target.value as 'primary' | 'deputy';
                  setBatchRecipientChoice(choice);
                  setBatchRecipient(choice === 'deputy' ? project?.deputyCommercialManagerEmail || '' : project?.commercialManagerEmail || '');
                  const firstName = (choice === 'deputy' ? project?.deputyCommercialManager : project?.commercialManager)?.trim().split(/\s+/)[0] || 'kaufmännische Leitung';
                  setBatchBody(previous => previous.replace(/^Hallo [^,]+,/, `Hallo ${firstName},`));
                }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm">
                  <option value="primary">{project?.commercialManager || 'Kaufmännische Leitung'} · {project?.commercialManagerEmail || 'E-Mail fehlt'}</option>
                  {project?.deputyCommercialManagerEmail && <option value="deputy">Vertretung: {project.deputyCommercialManager || 'Kaufmännische Leitung'} · {project.deputyCommercialManagerEmail}</option>}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Betreffzeile *</label>
                <input
                  type="text"
                  value={batchSubject}
                  onChange={e => setBatchSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs font-semibold"
                />
              </div>

              {/* Body */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  E-Mail Nachrichtentext (Persönliche Anrede: Hallo {managerFirstName}) *
                </label>
                <textarea
                  rows={7}
                  value={batchBody}
                  onChange={e => setBatchBody(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>
            </div>

            {/* Actions */}
            {batchError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{batchError}</p>}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
              >
                Abbrechen
              </button>

              <button
                type="button"
                disabled={isProcessingBatch || unrequestedMaterialItems.length === 0 || !batchRecipient || !batchSubject.trim() || !batchBody.trim()}
                onClick={handleConfirmBatchRequest}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#3B82C4] hover:bg-[#2B6EB0] text-white font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01] disabled:opacity-50 text-xs cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Bestellung absenden &amp; als angefragt markieren ({unrequestedMaterialItems.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Als echte LV-Position ins Aufmaß & Raum übernehmen */}
      {convertingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <span>Nachtrag als echte LV-Position anlegen</span>
              </h3>
              <button 
                type="button"
                onClick={() => setConvertingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Erstellt eine offizielle LV-Position im Projekt und hinterlegt sie im Raum, damit Monteure diese Position in der App direkt aufmessen können.
            </p>

            <form onSubmit={handleConvertSubmit} className="space-y-4 text-xs">
              {/* Positionsnummer & Einheitspreis */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nachtrags-Pos-Nr. *</label>
                  <input
                    type="text"
                    required
                    value={lvPosNr}
                    onChange={e => setLvPosNr(e.target.value)}
                    placeholder="z. B. N-01 oder 01.05.0010.N1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Einheitspreis (€ netto)</label>
                  <input
                    type="text"
                    value={lvUnitPrice}
                    onChange={e => setLvUnitPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs"
                  />
                </div>
              </div>

              {/* Leistungsbezeichnung (Kurztext) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Leistungsbezeichnung (Kurztext) *</label>
                <input
                  type="text"
                  required
                  value={lvTitle}
                  onChange={e => setLvTitle(e.target.value)}
                  placeholder="z. B. Zusätzliche Brandschottung DN 110"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs"
                />
              </div>

              {/* Nachtragsmenge & Einheit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nachtragsmenge (Plan) *</label>
                  <input
                    type="text"
                    required
                    value={lvQty}
                    onChange={e => setLvQty(e.target.value)}
                    placeholder="z. B. 10"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Einheit (qu) *</label>
                  <select
                    value={lvUnit}
                    onChange={e => setLvUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs font-semibold"
                  >
                    <option value="Stk">Stk (Stück)</option>
                    <option value="m">m (Meter)</option>
                    <option value="qm">qm (Quadratmeter)</option>
                    <option value="kg">kg (Kilogramm)</option>
                    <option value="Std">Std (Stunden)</option>
                    <option value="Psch">Psch (Pauschal)</option>
                  </select>
                </div>
              </div>

              {/* Raum-Zuordnung */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Betroffener Raum (Zuweisung) *</label>
                <select
                  required
                  value={lvRoomId}
                  onChange={e => setLvRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30 text-xs font-semibold"
                >
                  <option value="">-- Raum auswählen --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code || 'Raum'}) {r.floor ? `• ${r.floor}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  In diesem Raum wird das Material als Planmenge hinterlegt und erscheint sofort in der Monteur-App.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setConvertingItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isProcessingConvert}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#2FA36B] hover:bg-[#258757] text-white font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01] disabled:opacity-50 text-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isProcessingConvert ? 'Wird angelegt...' : '✓ Als LV-Position im Raum anlegen & freigeben'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
