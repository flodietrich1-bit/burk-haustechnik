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
  projectManager?: string; // e.g. "Florian Buck"
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
  materials?: RoomMaterialRequirement[];
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

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'monteur';
  email?: string;
  defaultLanguage?: 'de' | 'ro' | 'pl' | 'hr';
}
