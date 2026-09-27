import { db } from './firebaseClient';
import { Trade, PlaybookCollection, ChartSpecimen } from '@/types/trade';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export const MASTER_CATEGORY_ORDER = [
  'RETEST STRUCTURES',
  'LIQUIDITY SPRING MODELS',
  'BEAR TO BULL MODELS',
  'BULL TO BEAR MODELS',
  'OVEREXTENDED PIVOT MODELS',
  'BEHAVIOURAL MODELS',
  'EXECUTION STOPPED OUT/ BAD ENTRY'
];

export async function uploadScreenshotToCloud(fileOrBlob: File | Blob): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('image', fileOrBlob);

    const IMGBB_KEY = 'ef3caf5880f01c4c57d0ebc97cdaac10';

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data && data.data && data.data.url) {
      return data.data.url;
    }
    return null;
  } catch (err) {
    console.warn('Screenshot upload error:', err);
    return null;
  }
}

// ------------------- SAFE SEGMENTED FIRESTORE STORAGE (< 1MB PER DOC) -------------------

function sanitizeForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }));
}

export async function syncMasterToCloud(payload: {
  trades: Trade[];
  collections: PlaybookCollection[];
  studySpecimens: ChartSpecimen[];
  categoryOrder: string[];
  defaultRiskPerTrade: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Save Settings & Collections (Tiny < 10KB)
    await setDoc(doc(db, 'journal', 'meta'), sanitizeForFirestore({
      collections: payload.collections,
      categoryOrder: payload.categoryOrder,
      defaultRiskPerTrade: payload.defaultRiskPerTrade,
      updatedAt: Date.now()
    }), { merge: true });

    // 2. Save Trades (< 200KB)
    await setDoc(doc(db, 'journal', 'trades'), sanitizeForFirestore({
      trades: payload.trades,
      updatedAt: Date.now()
    }), { merge: true });

    // 3. Chunk Specimens into buckets of 30 items so no single document ever hits 1MB
    const chunkSize = 30;
    const totalChunks = Math.ceil(payload.studySpecimens.length / chunkSize) || 1;

    for (let i = 0; i < totalChunks; i++) {
      const slice = payload.studySpecimens.slice(i * chunkSize, (i + 1) * chunkSize);
      await setDoc(doc(db, 'journal', `specimens_${i}`), sanitizeForFirestore({
        items: slice,
        updatedAt: Date.now()
      }));
    }

    // Record total chunk count
    await setDoc(doc(db, 'journal', 'specimens_meta'), {
      totalChunks,
      updatedAt: Date.now()
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Cloud sync notice:', err?.message);
    return { success: false, error: err?.message };
  }
}

export async function fetchMasterFromCloud(): Promise<{
  trades: Trade[];
  collections: PlaybookCollection[];
  studySpecimens: ChartSpecimen[];
  categoryOrder: string[];
  defaultRiskPerTrade?: number;
} | null> {
  try {
    // 1. Fetch Meta & Collections
    const metaSnap = await getDoc(doc(db, 'journal', 'meta'));
    const metaData = metaSnap.exists() ? metaSnap.data() : {};

    // 2. Fetch Trades
    const tradesSnap = await getDoc(doc(db, 'journal', 'trades'));
    const tradesData = tradesSnap.exists() ? tradesSnap.data() : {};

    // 3. Fetch Chunked Specimens
    const specMetaSnap = await getDoc(doc(db, 'journal', 'specimens_meta'));
    const totalChunks = specMetaSnap.exists() ? (specMetaSnap.data()?.totalChunks || 1) : 1;

    const allSpecimens: ChartSpecimen[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkSnap = await getDoc(doc(db, 'journal', `specimens_${i}`));
      if (chunkSnap.exists() && Array.isArray(chunkSnap.data()?.items)) {
        allSpecimens.push(...chunkSnap.data().items);
      }
    }

    // Deduplicate specimens by id
    const uniqueSpecimensMap = new Map<string, ChartSpecimen>();
    allSpecimens.forEach(s => {
      if (s && s.id) uniqueSpecimensMap.set(String(s.id), s);
    });

    return {
      trades: Array.isArray(tradesData.trades) ? tradesData.trades : [],
      collections: Array.isArray(metaData.collections) ? metaData.collections : [],
      studySpecimens: Array.from(uniqueSpecimensMap.values()),
      categoryOrder: Array.isArray(metaData.categoryOrder) ? metaData.categoryOrder : MASTER_CATEGORY_ORDER,
      defaultRiskPerTrade: metaData.defaultRiskPerTrade || 600
    };
  } catch (err) {
    console.warn('Failed to fetch from Firebase:', err);
    return null;
  }
}

// Master Force Sync
export async function forcePushAllToCloud(
  trades: Trade[], 
  collections: PlaybookCollection[], 
  studySpecimens: ChartSpecimen[]
): Promise<{ success: boolean; error?: string }> {
  return await syncMasterToCloud({
    trades,
    collections,
    studySpecimens,
    categoryOrder: MASTER_CATEGORY_ORDER,
    defaultRiskPerTrade: 600
  });
}

// Permanent Purge
export async function purgeCloudData(): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'journal', 'meta'));
    await deleteDoc(doc(db, 'journal', 'trades'));
    await deleteDoc(doc(db, 'journal', 'specimens_meta'));
    return true;
  } catch (err) {
    return false;
  }
}