import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_PROJECT_ID } from '../constants/initialData';

const USER_KEY = 'ttapp_active_monteur';

export async function getActiveMonteur() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Error reading active monteur:', e);
    return null;
  }
}

export async function setupMonteurProfile(name, pin) {
  try {
    const cleanPin = String(pin).trim();
    const cleanName = String(name).trim();
    if (cleanPin.length !== 4) {
      throw new Error('PIN muss genau 4 Ziffern enthalten.');
    }
    if (!cleanName) {
      throw new Error('Bitte einen Namen eingeben.');
    }

    const monteur = {
      id: `monteur_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
      name: cleanName,
      pin: cleanPin,
      projectId: DEFAULT_PROJECT_ID,
      role: 'monteur',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    await AsyncStorage.setItem(USER_KEY, JSON.stringify(monteur));
    return monteur;
  } catch (e) {
    console.error('Error saving monteur profile:', e);
    throw e;
  }
}

export async function verifyPin(enteredPin) {
  const monteur = await getActiveMonteur();
  if (!monteur) return false;
  return String(monteur.pin) === String(enteredPin).trim();
}

export async function syncMonteurToFirebase(monteur) {
  if (!monteur || !monteur.id) return;
  try {
    const monteurRef = doc(db, 'projects', monteur.projectId || DEFAULT_PROJECT_ID, 'monteurs', monteur.id);
    await setDoc(monteurRef, {
      ...monteur,
      lastSync: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync monteur to Firebase (offline or permission):', err.message);
  }
}
