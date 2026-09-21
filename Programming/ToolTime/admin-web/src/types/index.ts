export interface Project {
  id: string;
  name: string;
  projectNumber: string;
  client: string;
  location: string;
  address?: string;
  startDate?: string;
  endDate?: string;
  trade?: string; // e.g. "Sanitär", "Heizung", "Lüftung"
  projectManagerId?: string;
  projectManager?: string; // e.g. "Florian Buck"
  projectManagerEmail?: string;
  commercialManagerId?: string;
  commercialManager?: string; // e.g. "Sabine Müller"
  commercialManagerEmail?: string;
  assignedMonteurIds?: string[]; // IDs of assigned installers
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  currency: string;
  totalPositions: number;
  totalDeliveredPercentage?: number;
  hasDwg?: boolean;
  dwgFileName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Position {
  id: string;
  posNr: string;
  group: string;
  shortText: string;
  longText?: string;
  qty: number;
  qu: string; // unit e.g. 'm', 'Stk', 'qm', 'Paar'
  deliveredQty: number;
  unitPrice?: number;
  isCutMaterial?: boolean;
  status?: 'open' | 'partial' | 'completed' | 'overdelivered';
  assignedRoomNames?: string[];
  updatedAt?: string;
}

export interface RoomMaterialRequirement {
  positionId: string;
  posNr: string;
  shortText: string;
  plannedQty: number;
  actualQty?: number; // tatsächlich verbaute Menge
  unitPrice?: number; // Einheitspreis aus GAEB-LV für Kosten-Delta
  qu: string;
  group?: string;
  notes?: string;
}

export interface RoomTranslations {
  ro?: string;
  pl?: string;
  hr?: string;
  [key: string]: string | undefined;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  floor: 'UG' | 'EG' | 'OG' | 'DG' | string;
  areaSqm?: number;
  translations: RoomTranslations;
  source?: 'dwg' | 'manual';
  status?: 'planned' | 'in_progress' | 'completed';
  progressPercent?: number; // 0 bis 100%
  completedAt?: string;
  completedBy?: string;
  materials?: RoomMaterialRequirement[];
}

export interface Alert {
  id: string;
  projectId?: string;
  roomId: string;
  roomName: string;
  materialId?: string;
  materialPos: string;
  materialName: string;
  plannedQty: number;
  requestedTotal: number;
  exceededBy: number;
  qu: string;
  reason: string;
  monteurName: string;
  status: 'open' | 'reordered' | 'billed' | 'acknowledged';
  needsReorder?: boolean;
  reorderedAt?: string;
  reorderEmailSentTo?: string;
  createdAt: string;
  updatedAt?: string;
  actionNote?: string;
}

export interface Booking {
  id: string;
  projectId: string;
  roomId: string;
  positionId: string;
  positionNr?: string;
  positionName?: string;
  quantity: number;
  qu?: string;
  note?: string;
  photoUrls?: string[];
  signatureUrl?: string;
  createdBy: string; // installer name or ID
  createdAt: string;
  calendarWeek?: number;
}

export interface Addendum {
  id: string;
  projectId: string;
  roomId: string;
  roomName?: string;
  title: string;
  description: string;
  quantity: number;
  qu: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  signatureUrl?: string;
  photoUrls?: string[];
  createdAt: string;
}

export type UserRole = 'admin' | 'bauleiter' | 'kaufmaennisch' | 'monteur';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  password?: string;
  phone?: string;
  pin?: string; // 4-digit PIN for installer app
  assignedProjectIds?: string[];
  defaultLanguage?: 'de' | 'ro' | 'pl' | 'hr';
  status?: 'active' | 'inactive';
  createdAt?: string;
}
