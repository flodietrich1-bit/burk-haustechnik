import { 
  collection, doc, onSnapshot, setDoc, updateDoc 
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { getActiveTenantId, cleanForFirestore } from './firestoreService';
import type { MeasurementSection } from '../types';

const sectionSubscribers = new Map<string, Set<(sections: MeasurementSection[]) => void>>();
const sectionsCache = new Map<string, MeasurementSection[]>();

function getCacheKey(projectId: string): string {
  const tenantId = getActiveTenantId();
  return `tooltime_${tenantId}_sections_${projectId}`;
}

export function getLocalMeasurementSections(projectId: string): MeasurementSection[] {
  if (sectionsCache.has(projectId)) {
    return sectionsCache.get(projectId)!;
  }
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getCacheKey(projectId)) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        sectionsCache.set(projectId, parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse local measurement sections:', err);
  }
  return [];
}

export function saveLocalMeasurementSections(projectId: string, sections: MeasurementSection[]): void {
  sectionsCache.set(projectId, sections);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getCacheKey(projectId), JSON.stringify(sections));
    }
  } catch (err) {
    console.warn('Failed to cache measurement sections:', err);
  }
  notifySubscribers(projectId, sections);
}

function notifySubscribers(projectId: string, sections: MeasurementSection[]): void {
  const subs = sectionSubscribers.get(projectId);
  if (subs) {
    subs.forEach(cb => {
      try {
        cb(sections);
      } catch (e) {
        console.warn('Error in measurement sections subscriber:', e);
      }
    });
  }
}

export function subscribeMeasurementSections(
  projectId: string, 
  callback: (sections: MeasurementSection[]) => void
): () => void {
  if (!sectionSubscribers.has(projectId)) {
    sectionSubscribers.set(projectId, new Set());
  }
  const set = sectionSubscribers.get(projectId)!;
  set.add(callback);

  // Return cached immediately
  callback(getLocalMeasurementSections(projectId));

  let unsubscribeFirestore = () => {};
  try {
    const tenantId = getActiveTenantId();
    const colRef = collection(db, 'tenants', tenantId, 'projects', projectId, 'measurement_sections');
    
    unsubscribeFirestore = onSnapshot(colRef, (snapshot) => {
      const list: MeasurementSection[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      saveLocalMeasurementSections(projectId, list);
    }, (err) => {
      console.warn('Firestore measurement_sections snapshot error:', err);
    });
  } catch (err) {
    console.warn('Could not subscribe to measurement_sections:', err);
  }

  return () => {
    set.delete(callback);
    unsubscribeFirestore();
  };
}

export async function saveMeasurementSection(
  projectId: string, 
  section: MeasurementSection
): Promise<void> {
  const current = getLocalMeasurementSections(projectId);
  const updated = [section, ...current.filter(s => s.id !== section.id)];
  saveLocalMeasurementSections(projectId, updated);

  try {
    const tenantId = getActiveTenantId();
    const docRef = doc(db, 'tenants', tenantId, 'projects', projectId, 'measurement_sections', section.id);
    await setDoc(docRef, cleanForFirestore(section), { merge: true });
  } catch (err: any) {
    console.warn('Failed to save measurement section to Firestore:', err.message);
  }
}

export async function approveMeasurementSection(
  projectId: string, 
  sectionId: string, 
  approvedBy: string
): Promise<void> {
  const current = getLocalMeasurementSections(projectId);
  const updated = current.map(s => {
    if (s.id === sectionId) {
      return {
        ...s,
        status: 'APPROVED' as const,
        approvedAt: new Date().toISOString(),
        approvedBy
      };
    }
    return s;
  });
  saveLocalMeasurementSections(projectId, updated);

  try {
    const tenantId = getActiveTenantId();
    const docRef = doc(db, 'tenants', tenantId, 'projects', projectId, 'measurement_sections', sectionId);
    await updateDoc(docRef, {
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedBy
    });
  } catch (err: any) {
    console.warn('Failed to approve measurement section in Firestore:', err.message);
  }
}

export async function uploadSectionPhoto(
  projectId: string,
  sectionId: string,
  file: File
): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage ist nicht konfiguriert.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `tenants/${getActiveTenantId()}/projects/${projectId}/sections/${sectionId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      'state_changed',
      () => {},
      reject,
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}
