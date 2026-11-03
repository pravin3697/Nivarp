import { Trade, PlaybookCollection, ChartSpecimen } from '@/types/trade';
import { resolveDirectImageUrl, displaySetupName, parseDateToTimestamp } from '@/lib/parser';

// Sanitize and keep directory names compact to avoid Windows MAX_PATH (260 char) limits
function sanitizeFsName(name: string, maxLen = 35): string {
  if (!name) return 'General';
  const cleaned = name
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLen).trim() || 'General';
}

// Strip repetitive long tags from file names to keep paths short
function cleanChartTitle(rawTitle: string): string {
  if (!rawTitle) return 'Chart';
  return rawTitle
    .replace(/\s*—\s*Execution\s*\(LTF\)/gi, '')
    .replace(/\s*\(Study\)/gi, '')
    .replace(/\s*Execution/gi, '')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25) || 'Chart';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getYearAndMonthFolder(dateStr?: string): { year: string; month: string } {
  const now = new Date();
  if (!dateStr) {
    const y = String(now.getFullYear());
    const m = `${String(now.getMonth() + 1).padStart(2, '0')} - ${MONTH_NAMES[now.getMonth()]}`;
    return { year: y, month: m };
  }

  const ts = parseDateToTimestamp(dateStr);
  const d = ts ? new Date(ts) : now;
  const year = String(d.getFullYear() || now.getFullYear());
  const monthNum = String(d.getMonth() + 1).padStart(2, '0');
  const monthName = MONTH_NAMES[d.getMonth()] || 'General';
  return { year, month: `${monthNum} - ${monthName}` };
}

// Fetch image blob with CORS proxy fallbacks, direct fetch, & base64 support
async function fetchImageBlob(url: string): Promise<Blob | null> {
  const directUrl = resolveDirectImageUrl(url);
  if (!directUrl) return null;

  try {
    if (directUrl.startsWith('data:image')) {
      const res = await fetch(directUrl);
      return await res.blob();
    }

    // Try direct fetch first (many image hosts like Catbox, Cloudinary have open CORS)
    const endpoints = [
      directUrl,
      `https://corsproxy.io/?url=${encodeURIComponent(directUrl)}`,
      `https://wsrv.nl/?url=${encodeURIComponent(directUrl)}&output=png`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout per endpoint

        const res = await fetch(ep, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('text/html')) {
            const b = await res.blob();
            if (b.size > 1500) return b;
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Failed to fetch blob for chart:', url, err);
  }
  return null;
}

// Dynamically loads JSZip if Native Directory Picker is unavailable
async function loadJSZip(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).JSZip) return (window as any).JSZip;

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="jszip"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).JSZip));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip fallback library.'));
    document.head.appendChild(script);
  });
}

export interface ChartBackupItem {
  folderPath: string[]; // e.g. ["Collections", "RETEST STRUCTURES", "1 - Origin Retest", "Resistance"]
  baseFileName: string;
  imageUrl: string;
}

export async function runGlobalChartBackup(
  trades: Trade[],
  collections: PlaybookCollection[],
  studySpecimens: ChartSpecimen[],
  onProgress: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; totalExported: number; error?: string }> {
  const backupQueue: ChartBackupItem[] = [];

  const cleanStr = (s?: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

  // 1. Gather Collections / Codex Specimens (Both Study Charts & Executed Charts belonging to this setup)
  collections.forEach(col => {
    const colClean = cleanStr(col.name);
    const colStripped = cleanStr(displaySetupName(col.name));

    const matchesCol = (rawName?: string) => {
      if (!rawName) return false;
      const c = cleanStr(rawName);
      const s = cleanStr(displaySetupName(rawName));
      return c === colClean || s === colStripped || c === colStripped || s === colClean;
    };

    const targetCategory = sanitizeFsName(col.category || 'GENERAL MODELS', 30);
    const targetSetupName = sanitizeFsName(col.name || 'Setup', 30);

    // Track URLs already added to this specific setup to prevent writing duplicate identical files
    const seenUrlsInSetup = new Set<string>();

    // 1a. Study specimens
    const thisStudies = studySpecimens.filter(s => {
      if (s.collectionId && col.id && s.collectionId === col.id) return true;
      return matchesCol(s.collectionName);
    });

    thisStudies.forEach(s => {
      if (!s.imageUrl) return;
      seenUrlsInSetup.add(s.imageUrl.trim());

      const cleanTitle = cleanChartTitle(s.title || 'Chart');
      const cleanDate = (s.date || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const baseName = `${cleanTitle}_${cleanDate}`.replace(/_+/g, '_').replace(/_$/, '');

      // If tagged, place in variant subfolder. If untagged/General, place directly in the setup root.
      const hasSpecificVariant = s.subtype && s.subtype !== 'General';
      const folderPath = hasSpecificVariant
        ? ['Collections', targetCategory, targetSetupName, sanitizeFsName(s.subtype!, 20)]
        : ['Collections', targetCategory, targetSetupName];

      backupQueue.push({
        folderPath,
        baseFileName: baseName,
        imageUrl: s.imageUrl
      });
    });

    // 1b. Live trade executions in Collections (Included in Collections as well!)
    const thisTrades = trades.filter(t => matchesCol(t.setupType));
    thisTrades.forEach(t => {
      const ltfUrl = t.image2 || t.image1;
      if (!ltfUrl) return;

      const trimmedUrl = ltfUrl.trim();
      // If already queued for this setup from study specimens, avoid writing duplicate file in the same folder
      if (seenUrlsInSetup.has(trimmedUrl)) return;
      seenUrlsInSetup.add(trimmedUrl);

      const cleanSym = cleanChartTitle(t.symbol);
      const cleanDate = (t.tradeDate || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const rStr = t.rMultiple >= 0 ? `+${t.rMultiple}R` : `${t.rMultiple}R`;
      const baseName = `${cleanSym}_${cleanDate}_${rStr}`.replace(/_+/g, '_');

      // If tagged, place in variant subfolder. If untagged/General, place directly in the setup root.
      const hasSpecificVariant = t.setupSubtype && t.setupSubtype !== 'General';
      const folderPath = hasSpecificVariant
        ? ['Collections', targetCategory, targetSetupName, sanitizeFsName(t.setupSubtype!, 20)]
        : ['Collections', targetCategory, targetSetupName];

      backupQueue.push({
        folderPath,
        baseFileName: baseName,
        imageUrl: ltfUrl
      });
    });
  });

  // 2. Gather Executed Trades (ALL live execution charts, organized chronologically by Year / Month)
  trades.forEach(t => {
    const ltfUrl = t.image2 || t.image1;
    if (!ltfUrl) return;

    const { year, month } = getYearAndMonthFolder(t.tradeDate);
    const cleanSym = cleanChartTitle(t.symbol);
    const cleanDate = (t.tradeDate || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const dir = t.direction || 'TRADE';
    const rStr = t.rMultiple >= 0 ? `+${t.rMultiple}R` : `${t.rMultiple}R`;
    const baseName = `${cleanDate}_${cleanSym}_${dir}_${rStr}`.replace(/_+/g, '_');

    backupQueue.push({
      folderPath: ['Executed Trades', sanitizeFsName(year, 10), sanitizeFsName(month, 20)],
      baseFileName: baseName,
      imageUrl: ltfUrl
    });
  });

  const total = backupQueue.length;
  if (total === 0) {
    return { success: true, totalExported: 0 };
  }

  // 3. Native File System Access API
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const rootSelectedHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });

      // Create base folder "Nivarp_Chart_Backup_YYYY-MM-DD"
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const mainBackupDirHandle: any = await rootSelectedHandle.getDirectoryHandle(
        `Nivarp_Chart_Backup_${dateSuffix}`,
        { create: true }
      );

      // Track duplicate names per directory to append (1), (2)...
      const dirMap = new Map<string, any>();
      const usedNames = new Map<string, number>();

      let exportedCount = 0;

      for (let i = 0; i < total; i++) {
        const item = backupQueue[i];
        onProgress(i + 1, total, `Saving ${i + 1} of ${total}: ${item.baseFileName}`);

        try {
          // Resolve or create nested directories
          const dirKey = item.folderPath.join('/');
          let targetDirHandle = dirMap.get(dirKey);

          if (!targetDirHandle) {
            let current = mainBackupDirHandle;
            for (const seg of item.folderPath) {
              current = await current.getDirectoryHandle(sanitizeFsName(seg), { create: true });
            }
            targetDirHandle = current;
            dirMap.set(dirKey, current);
          }

          // Format filename with counter for duplicates
          const nameKey = `${dirKey}/${item.baseFileName}`;
          const count = (usedNames.get(nameKey) || 0) + 1;
          usedNames.set(nameKey, count);
          const finalFilename = count === 1 
            ? `${item.baseFileName}.png` 
            : `${item.baseFileName}_(${count}).png`;

          const blob = await fetchImageBlob(item.imageUrl);
          if (blob && targetDirHandle) {
            const fileHandle = await targetDirHandle.getFileHandle(finalFilename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            exportedCount++;
          }
        } catch (err) {
          console.warn('Error saving specimen file:', err);
        }

        await new Promise(r => setTimeout(r, 40));
      }

      return { success: true, totalExported: exportedCount };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, totalExported: 0, error: 'Export canceled by user.' };
      }
      console.warn('DirectoryPicker failed, falling back to ZIP:', err);
    }
  }

  // 4. Fallback: Structured .ZIP Archive (starts directly at Collections/ and Executed Trades/ to prevent double folder nesting)
  try {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const dateSuffix = new Date().toISOString().slice(0, 10);

    const usedNames = new Map<string, number>();
    let exportedCount = 0;

    for (let i = 0; i < total; i++) {
      const item = backupQueue[i];
      onProgress(i + 1, total, `Packaging ${i + 1} of ${total}: ${item.baseFileName}`);

      try {
        const fullDirPath = item.folderPath.map(seg => sanitizeFsName(seg)).join('/');
        const nameKey = `${fullDirPath}/${item.baseFileName}`;
        const count = (usedNames.get(nameKey) || 0) + 1;
        usedNames.set(nameKey, count);
        const finalFilename = count === 1 
          ? `${item.baseFileName}.png` 
          : `${item.baseFileName}_(${count}).png`;

        const blob = await fetchImageBlob(item.imageUrl);
        if (blob) {
          // Write directly into Collections/... and Executed Trades/... inside the ZIP
          zip.file(`${fullDirPath}/${finalFilename}`, blob);
          exportedCount++;
        }
      } catch {}

      await new Promise(r => setTimeout(r, 30));
    }

    onProgress(total, total, 'Generating ZIP archive download...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Nivarp_Chart_Backup_${dateSuffix}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);

    return { success: true, totalExported: exportedCount };
  } catch (err: any) {
    return { success: false, totalExported: 0, error: err.message };
  }
}