import { db } from './firebaseClient';
import { Trade, PlaybookCollection, ChartSpecimen } from '@/types/trade';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  writeBatch,
  deleteDoc
} from 'firebase/firestore';

export const MASTER_CATEGORY_ORDER = [
  'RETEST STRUCTURES',
  'LIQUIDITY SPRING MODELS',
  'BEAR TO BULL MODELS',
  'BULL TO BEAR MODELS',
  'OVEREXTENDED PIVOT MODELS',
  'BEHAVIOURAL MODELS',
  'EXECUTION STOPPED OUT/ BAD ENTRY'
];

// Direct screenshot uploader using your dedicated ImgBB account API
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

// ------------------- TRADES -------------------

export async function syncTradesToCloud(trades: Trade[]): Promise<{ success: boolean; error?: string }> {
  if (!trades.length) return { success: true };
  try {
    const batch = writeBatch(db);
    trades.forEach(t => {
      const docRef = doc(db, 'trades', String(t.id));
      batch.set(docRef, {
        id: String(t.id),
        symbol: t.symbol,
        tradeDate: t.tradeDate,
        tradeTime: t.tradeTime || null,
        direction: t.direction,
        quantity: t.quantity,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        slPrice: t.slPrice || null,
        rMultiple: t.rMultiple,
        netPnl: t.netPnl,
        fees: t.fees,
        setupType: t.setupType,
        regime: t.regime || 'Bullish',
        behaviorTag: t.behaviorTag || null,
        mae: t.mae || null,
        mfe: t.mfe || null,
        image1: t.image1 || null,
        image2: t.image2 || null,
        notes: t.notes || null,
        updatedAt: Date.now()
      }, { merge: true });
    });

    await batch.commit();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Firestore sync error' };
  }
}

export async function fetchTradesFromCloud(): Promise<Trade[]> {
  try {
    const snapshot = await getDocs(collection(db, 'trades'));
    if (snapshot.empty) return [];

    const trades: Trade[] = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      trades.push({
        id: String(d.id || docSnap.id),
        symbol: d.symbol,
        tradeDate: d.tradeDate,
        tradeTime: d.tradeTime || undefined,
        direction: d.direction as 'LONG' | 'SHORT',
        quantity: Number(d.quantity) || 1,
        entryPrice: Number(d.entryPrice) || 0,
        exitPrice: Number(d.exitPrice) || 0,
        slPrice: d.slPrice ? Number(d.slPrice) : undefined,
        rMultiple: Number(d.rMultiple) || 0,
        netPnl: Number(d.netPnl) || 0,
        fees: Number(d.fees) || 0,
        setupType: d.setupType || 'General Setup',
        regime: d.regime as any,
        behaviorTag: d.behaviorTag as any,
        mae: d.mae || undefined,
        mfe: d.mfe || undefined,
        image1: d.image1 || undefined,
        image2: d.image2 || undefined,
        notes: d.notes || undefined
      });
    });

    return trades;
  } catch {
    return [];
  }
}

// ------------------- COLLECTIONS (SETUPS) -------------------

export async function syncCollectionsToCloud(collections: PlaybookCollection[]): Promise<{ success: boolean; error?: string }> {
  if (!collections.length) return { success: true };
  try {
    const batch = writeBatch(db);
    collections.forEach(c => {
      const docRef = doc(db, 'collections', String(c.id));
      batch.set(docRef, {
        id: String(c.id),
        name: c.name.trim(),
        category: c.category.trim().toUpperCase(),
        description: c.description || ''
      }, { merge: true });
    });

    await batch.commit();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Firestore error' };
  }
}

export async function deleteCollectionFromCloud(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'collections', String(id)));
    return true;
  } catch (err) {
    console.error('Failed to delete setup from cloud:', err);
    return false;
  }
}

export async function fetchCollectionsFromCloud(): Promise<PlaybookCollection[]> {
  try {
    const snapshot = await getDocs(collection(db, 'collections'));
    if (snapshot.empty) return [];

    const mapped: PlaybookCollection[] = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      mapped.push({
        id: String(d.id || docSnap.id),
        name: d.name.trim(),
        category: d.category ? d.category.trim().toUpperCase() : 'GENERAL',
        description: d.description || ''
      });
    });

    return mapped.sort((a, b) => {
      const idxA = MASTER_CATEGORY_ORDER.indexOf(a.category);
      const idxB = MASTER_CATEGORY_ORDER.indexOf(b.category);
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

// ------------------- STUDY SPECIMENS -------------------

export async function syncSpecimensToCloud(specimens: ChartSpecimen[]): Promise<{ success: boolean; error?: string }> {
  if (!specimens.length) return { success: true };
  try {
    const batch = writeBatch(db);
    specimens.forEach(s => {
      const docRef = doc(db, 'study_specimens', String(s.id));
      batch.set(docRef, {
        id: String(s.id),
        collectionName: s.collectionName.trim(),
        type: s.type || 'STUDY_SETUP',
        title: s.title || '',
        date: s.date || '',
        imageUrl: s.imageUrl,
        rMultiple: s.rMultiple || null
      }, { merge: true });
    });

    await batch.commit();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Firestore error' };
  }
}

export async function deleteSpecimenFromCloud(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'study_specimens', String(id)));
    return true;
  } catch (err) {
    console.error('Failed to delete specimen from cloud:', err);
    return false;
  }
}

export async function fetchSpecimensFromCloud(): Promise<ChartSpecimen[]> {
  try {
    const snapshot = await getDocs(collection(db, 'study_specimens'));
    if (snapshot.empty) return [];

    const specimens: ChartSpecimen[] = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      specimens.push({
        id: String(d.id || docSnap.id),
        collectionName: d.collectionName.trim(),
        type: d.type || 'STUDY_SETUP',
        title: d.title || '',
        date: d.date || '',
        imageUrl: d.imageUrl,
        rMultiple: d.rMultiple != null ? Number(d.rMultiple) : undefined
      });
    });

    return specimens;
  } catch {
    return [];
  }
}

// ------------------- FORCE PUSH & PURGE -------------------

export async function forcePushAllToCloud(
  trades: Trade[], 
  collections: PlaybookCollection[], 
  specimens: ChartSpecimen[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await purgeCloudData();

    const [tradesRes, colsRes, specsRes] = await Promise.all([
      syncTradesToCloud(trades),
      syncCollectionsToCloud(collections),
      syncSpecimensToCloud(specimens)
    ]);

    const errors: string[] = [];
    if (!tradesRes.success && tradesRes.error) errors.push(`Trades: ${tradesRes.error}`);
    if (!colsRes.success && colsRes.error) errors.push(`Collections: ${colsRes.error}`);
    if (!specsRes.success && specsRes.error) errors.push(`Study: ${specsRes.error}`);

    if (errors.length > 0) {
      return { success: false, error: errors.join(' | ') };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function purgeCloudData(): Promise<boolean> {
  try {
    const collectionsToPurge = ['trades', 'collections', 'study_specimens'];
    for (const colName of collectionsToPurge) {
      const snapshot = await getDocs(collection(db, colName));
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to purge Firestore data:', err);
    return false;
  }
}