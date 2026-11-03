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

/**
 * Ultra-High-Fidelity chart preservation.
 * Keeps resolution up to 2560px (2K / Retina) and 95% WebP quality
 * so 1px candle wicks, text, and price scales stay razor-sharp.
 */
async function compressImageToWebP(fileOrBlob: File | Blob, maxWidth = 2560, quality = 0.95): Promise<Blob> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(fileOrBlob);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => resolve(blob || fileOrBlob),
          'image/webp',
          quality
        );
      } else {
        resolve(fileOrBlob);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(fileOrBlob);
    };

    img.src = objectUrl;
  });
}

/**
 * Permanent 100% Free Cloud Upload Pipeline.
 * 1. FreeImage.host (Permanent, never deletes)
 * 2. Catbox.moe (Permanent, never expires)
 * 3. Fail-safe: Direct compressed WebP Base64 stored in your own Firebase/IndexedDB
 */
export async function uploadScreenshotToCloud(fileOrBlob: File | Blob): Promise<string | null> {
  try {
    const compressedBlob = await compressImageToWebP(fileOrBlob);

    // 1. Try FreeImage.host (Permanent, never deletes)
    try {
      const formData = new FormData();
      formData.append('key', '6d207e02198a847423850aa0091c5215');
      formData.append('action', 'upload');
      formData.append('source', compressedBlob, 'chart.webp');
      formData.append('format', 'json');

      const res = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data?.image?.url) {
        return data.image.url;
      }
    } catch {
      // Fall through to Catbox
    }

    // 2. Try Catbox.moe (Permanent, files kept forever)
    try {
      const catboxData = new FormData();
      catboxData.append('reqtype', 'fileupload');
      catboxData.append('fileToUpload', compressedBlob, 'chart.webp');

      const catboxRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: catboxData
      });

      const catboxUrl = await catboxRes.text();
      if (catboxUrl && catboxUrl.startsWith('http')) {
        return catboxUrl.trim();
      }
    } catch {
      // Fall through to Base64
    }

    // 3. Fail-safe: Save compressed WebP directly in your Firebase & IndexedDB
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(compressedBlob);
    });

  } catch (err) {
    console.warn('Screenshot upload notice:', err);
    return null;
  }
}

// ------------------- USER-ISOLATED SEGMENTED FIRESTORE STORAGE -------------------

function sanitizeForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }));
}

export async function syncMasterToCloud(
  payload: {
    trades: Trade[];
    collections: PlaybookCollection[];
    studySpecimens: ChartSpecimen[];
    categoryOrder: string[];
    defaultRiskPerTrade: number;
    tradingCapital?: number;
    securityPin?: string;
    isLockEnabled?: boolean;
    engineWatchlist?: Record<string, { high: string; low: string }>;
    gatekeeperConfig?: any;
  },
  userId: string = 'master'
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = userId || 'master';

    // 1. Save Meta, Collections & Gatekeeper Rules
    await setDoc(doc(db, `users_${scope}`, 'meta'), sanitizeForFirestore({
      collections: payload.collections,
      categoryOrder: payload.categoryOrder,
      defaultRiskPerTrade: payload.defaultRiskPerTrade,
      tradingCapital: payload.tradingCapital,
      securityPin: payload.securityPin,
      isLockEnabled: payload.isLockEnabled,
      engineWatchlist: payload.engineWatchlist,
      gatekeeperConfig: payload.gatekeeperConfig,
      updatedAt: Date.now()
    }), { merge: true });

    // 2. Save Trades CHUNKED in buckets of 15
    const tradeChunkSize = 15;
    const totalTradeChunks = Math.ceil(payload.trades.length / tradeChunkSize) || 1;

    for (let i = 0; i < totalTradeChunks; i++) {
      const slice = payload.trades.slice(i * tradeChunkSize, (i + 1) * tradeChunkSize);
      await setDoc(doc(db, `users_${scope}`, `trades_${i}`), sanitizeForFirestore({
        items: slice,
        updatedAt: Date.now()
      }));
    }

    await setDoc(doc(db, `users_${scope}`, 'trades_meta'), {
      totalChunks: totalTradeChunks,
      updatedAt: Date.now()
    });

    // 3. Chunk Specimens into buckets of 25
    const chunkSize = 25;
    const totalChunks = Math.ceil(payload.studySpecimens.length / chunkSize) || 1;

    for (let i = 0; i < totalChunks; i++) {
      const slice = payload.studySpecimens.slice(i * chunkSize, (i + 1) * chunkSize);
      await setDoc(doc(db, `users_${scope}`, `specimens_${i}`), sanitizeForFirestore({
        items: slice,
        updatedAt: Date.now()
      }));
    }

    await setDoc(doc(db, `users_${scope}`, 'specimens_meta'), {
      totalChunks,
      updatedAt: Date.now()
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Cloud sync notice:', err?.message);
    return { success: false, error: err?.message };
  }
}

export async function fetchMasterFromCloud(userId: string = 'master'): Promise<{
  trades: Trade[];
  collections: PlaybookCollection[];
  studySpecimens: ChartSpecimen[];
  categoryOrder: string[];
  defaultRiskPerTrade?: number;
  tradingCapital?: number;
  securityPin?: string;
  isLockEnabled?: boolean;
  engineWatchlist?: Record<string, { high: string; low: string }>;
  gatekeeperConfig?: any;
} | null> {
  try {
    const scope = userId || 'master';

    let metaSnap = await getDoc(doc(db, `users_${scope}`, 'meta'));
    if (!metaSnap.exists() && scope === 'master') {
      metaSnap = await getDoc(doc(db, 'journal', 'meta'));
    }
    const metaData = metaSnap.exists() ? metaSnap.data() : {};

    // 1. Fetch Chunked Trades
    let tradesMetaSnap = await getDoc(doc(db, `users_${scope}`, 'trades_meta'));
    let allTrades: Trade[] = [];

    if (tradesMetaSnap.exists()) {
      const totalTradeChunks = tradesMetaSnap.data()?.totalChunks || 1;
      for (let i = 0; i < totalTradeChunks; i++) {
        let chunkSnap = await getDoc(doc(db, `users_${scope}`, `trades_${i}`));
        if (chunkSnap.exists() && Array.isArray(chunkSnap.data()?.items)) {
          allTrades.push(...chunkSnap.data().items);
        }
      }
    } else {
      let legacyTradesSnap = await getDoc(doc(db, `users_${scope}`, 'trades'));
      if (!legacyTradesSnap.exists() && scope === 'master') {
        legacyTradesSnap = await getDoc(doc(db, 'journal', 'trades'));
      }
      if (legacyTradesSnap.exists() && Array.isArray(legacyTradesSnap.data()?.trades)) {
        allTrades = legacyTradesSnap.data()?.trades;
      }
    }

    // 2. Fetch Chunked Specimens
    let specMetaSnap = await getDoc(doc(db, `users_${scope}`, 'specimens_meta'));
    if (!specMetaSnap.exists() && scope === 'master') {
      specMetaSnap = await getDoc(doc(db, 'journal', 'specimens_meta'));
    }
    const totalChunks = specMetaSnap.exists() ? (specMetaSnap.data()?.totalChunks || 1) : 1;

    const allSpecimens: ChartSpecimen[] = [];
    for (let i = 0; i < totalChunks; i++) {
      let chunkSnap = await getDoc(doc(db, `users_${scope}`, `specimens_${i}`));
      if (!chunkSnap.exists() && scope === 'master') {
        chunkSnap = await getDoc(doc(db, 'journal', `specimens_${i}`));
      }
      if (chunkSnap.exists() && Array.isArray(chunkSnap.data()?.items)) {
        allSpecimens.push(...chunkSnap.data().items);
      }
    }

    const uniqueSpecimensMap = new Map<string, ChartSpecimen>();
    allSpecimens.forEach(s => {
      if (s && s.id) uniqueSpecimensMap.set(String(s.id), s);
    });

    return {
      trades: allTrades,
      collections: Array.isArray(metaData.collections) ? metaData.collections : [],
      studySpecimens: Array.from(uniqueSpecimensMap.values()),
      categoryOrder: Array.isArray(metaData.categoryOrder) ? metaData.categoryOrder : MASTER_CATEGORY_ORDER,
      defaultRiskPerTrade: metaData.defaultRiskPerTrade || 600,
      tradingCapital: metaData.tradingCapital || 70000,
      securityPin: metaData.securityPin || '',
      isLockEnabled: !!metaData.isLockEnabled,
      engineWatchlist: metaData.engineWatchlist || undefined,
      gatekeeperConfig: metaData.gatekeeperConfig || undefined
    };
  } catch (err) {
    console.warn('Failed to fetch from Firebase:', err);
    return null;
  }
}

export async function forcePushAllToCloud(
  trades: Trade[], 
  collections: PlaybookCollection[], 
  studySpecimens: ChartSpecimen[],
  userId: string = 'master'
): Promise<{ success: boolean; error?: string }> {
  return await syncMasterToCloud({
    trades,
    collections,
    studySpecimens,
    categoryOrder: MASTER_CATEGORY_ORDER,
    defaultRiskPerTrade: 600
  }, userId);
}

export async function purgeCloudData(userId: string = 'master'): Promise<boolean> {
  try {
    const scope = userId || 'master';
    await deleteDoc(doc(db, `users_${scope}`, 'meta'));
    await deleteDoc(doc(db, `users_${scope}`, 'trades_meta'));
    await deleteDoc(doc(db, `users_${scope}`, 'specimens_meta'));
    return true;
  } catch (err) {
    return false;
  }
}