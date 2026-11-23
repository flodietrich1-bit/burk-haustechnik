import { 
  collection, doc, getDocs, setDoc, query, limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { getActiveTenantId, cleanForFirestore } from './firestoreService';
import type { CatalogArticle } from '../types';

const DEFAULT_ARTICLES: CatalogArticle[] = [
  {
    id: 'art_geberit_wc_wand',
    title: 'Wandtiefspül-WC Geberit Renova Nr. 1',
    aliasTitle: 'Wandtiefspül-WC Geberit inkl. Schallschutz',
    monteurInfo: 'Inklusive Schallschutzmatte und Befestigungssatz montieren',
    tradeCategory: 'Sanitärobjekte & Armaturen',
    qu: 'Stk',
    defaultUnitPriceVK: 245.0,
    usageCount: 12
  },
  {
    id: 'art_hansgrohe_focus_wt',
    title: 'Waschtisch-Einhebelmischer Hansgrohe Focus 100',
    aliasTitle: 'WT-Armatur Hansgrohe Focus 100 verchromt',
    monteurInfo: 'Anschlussschläuche 3/8" mit Quetschverschraubung',
    tradeCategory: 'Sanitärobjekte & Armaturen',
    qu: 'Stk',
    defaultUnitPriceVK: 115.0,
    usageCount: 9
  },
  {
    id: 'art_viega_sanpress_22',
    title: 'Viega Sanpress Rohr 1.4401 22x1,2 mm',
    aliasTitle: 'Sanpress Edelstahlrohr d22',
    monteurInfo: 'Sanpress Edelstahl, Schellen sind in Position enthalten',
    tradeCategory: 'Rohrleitungen & Entwässerung',
    qu: 'm',
    defaultUnitPriceVK: 18.5,
    usageCount: 25
  },
  {
    id: 'art_geberit_mapress_28',
    title: 'Geberit Mapress Kupferrohr 28x1,5 mm',
    aliasTitle: 'Mapress Kupfer d28',
    monteurInfo: 'Vor Pressung Einstecktiefe markieren',
    tradeCategory: 'Rohrleitungen & Entwässerung',
    qu: 'm',
    defaultUnitPriceVK: 22.0,
    usageCount: 14
  },
  {
    id: 'art_kugelhahn_dn25',
    title: 'Kugelhahn DN 25 Messing mit Entleerung',
    aliasTitle: 'Absperrhahn DN25 mit Entleerung',
    monteurInfo: 'Griffrichtung in Fließrichtung ausrichten',
    tradeCategory: 'Verteiler & Armaturen',
    qu: 'Stk',
    defaultUnitPriceVK: 48.0,
    usageCount: 18
  }
];

function getCacheKey(): string {
  try {
    return `tooltime_${getActiveTenantId()}_catalog_articles`;
  } catch {
    return 'tooltime_catalog_articles';
  }
}

export function getLocalCatalogArticles(): CatalogArticle[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(getCacheKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading catalog articles cache:', err);
  }
  return DEFAULT_ARTICLES;
}

export function saveLocalCatalogArticles(articles: CatalogArticle[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getCacheKey(), JSON.stringify(articles));
    }
  } catch (err) {
    console.warn('Error saving catalog articles cache:', err);
  }
}

export async function fetchCatalogArticles(): Promise<CatalogArticle[]> {
  const local = getLocalCatalogArticles();
  try {
    const tenantId = getActiveTenantId();
    const colRef = collection(db, 'tenants', tenantId, 'catalog_articles');
    const snap = await getDocs(query(colRef, limit(100)));
    if (!snap.empty) {
      const remote: CatalogArticle[] = [];
      snap.forEach(docSnap => {
        remote.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      // Merge with default seed
      const map = new Map<string, CatalogArticle>();
      DEFAULT_ARTICLES.forEach(a => map.set(a.title.toLowerCase(), a));
      remote.forEach(a => map.set(a.title.toLowerCase(), a));
      const merged = Array.from(map.values());
      saveLocalCatalogArticles(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Failed to fetch catalog articles from Firestore:', err);
  }
  return local;
}

export async function recordCatalogArticle(article: {
  title: string;
  aliasTitle?: string | null;
  monteurInfo?: string | null;
  tradeCategory?: string;
  qu?: string;
  defaultUnitPriceVK?: number;
}): Promise<CatalogArticle> {
  const trimmedTitle = article.title.trim();
  if (!trimmedTitle) throw new Error('Artikeltitel darf nicht leer sein');

  const current = getLocalCatalogArticles();
  const existingIdx = current.findIndex(a => a.title.toLowerCase() === trimmedTitle.toLowerCase());

  let updatedArticle: CatalogArticle;
  let newList: CatalogArticle[];

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    updatedArticle = {
      ...existing,
      aliasTitle: article.aliasTitle !== undefined ? article.aliasTitle : existing.aliasTitle,
      monteurInfo: article.monteurInfo !== undefined ? article.monteurInfo : existing.monteurInfo,
      tradeCategory: article.tradeCategory || existing.tradeCategory,
      qu: article.qu || existing.qu,
      defaultUnitPriceVK: article.defaultUnitPriceVK !== undefined ? article.defaultUnitPriceVK : existing.defaultUnitPriceVK,
      usageCount: (existing.usageCount || 0) + 1,
      lastUsedAt: new Date().toISOString()
    };
    newList = [...current];
    newList[existingIdx] = updatedArticle;
  } else {
    updatedArticle = {
      id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: trimmedTitle,
      aliasTitle: article.aliasTitle || null,
      monteurInfo: article.monteurInfo || null,
      tradeCategory: article.tradeCategory || 'Allgemein',
      qu: article.qu || 'Stk',
      defaultUnitPriceVK: article.defaultUnitPriceVK || 0,
      usageCount: 1,
      lastUsedAt: new Date().toISOString()
    };
    newList = [updatedArticle, ...current];
  }

  saveLocalCatalogArticles(newList);

  try {
    const tenantId = getActiveTenantId();
    const docRef = doc(db, 'tenants', tenantId, 'catalog_articles', updatedArticle.id);
    await setDoc(docRef, cleanForFirestore(updatedArticle), { merge: true });
  } catch (err: any) {
    console.warn('Could not persist catalog article to Firestore:', err.message);
  }

  return updatedArticle;
}

export function searchCatalogArticles(term: string, articles: CatalogArticle[]): CatalogArticle[] {
  if (!term || !term.trim()) return articles.slice(0, 10);
  const q = term.trim().toLowerCase();
  return articles
    .filter(a => {
      return (
        a.title.toLowerCase().includes(q) ||
        (a.aliasTitle && a.aliasTitle.toLowerCase().includes(q)) ||
        (a.tradeCategory && a.tradeCategory.toLowerCase().includes(q)) ||
        (a.monteurInfo && a.monteurInfo.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 10);
}
