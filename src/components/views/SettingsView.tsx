'use client';

import React, { useState, useMemo } from 'react';
import { CustomNumberInput } from '@/components/ui/CustomControls';
import { User } from 'firebase/auth';
import { Trade, ChartSpecimen, PlaybookCollection } from '@/types/trade';
import { uploadScreenshotToCloud } from '@/lib/cloudSync';
import { displaySetupName } from '@/lib/parser';
import { 
  Sliders, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Cloud, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  Shield, 
  KeyRound, 
  Eye, 
  EyeOff,
  AlertTriangle,
  X,
  ArrowRightLeft,
  FileWarning,
  Pencil,
  Copy,
  Loader2,
  FolderArchive,
  HardDrive
} from 'lucide-react';

export interface UnmigratedChartItem {
  id: string;
  type: 'trade-image1' | 'trade-image2' | 'specimen';
  title: string;
  setupName: string;
  date: string;
  oldUrl: string;
  trade?: Trade;
  specimen?: ChartSpecimen;
}

interface SettingsViewProps {
  defaultRisk: number;
  currentUser: User | null;
  securityPin: string;
  isLockEnabled: boolean;
  trades?: Trade[];
  studySpecimens?: ChartSpecimen[];
  collections?: PlaybookCollection[];
  onUpdateMigratedData?: (updatedTrades: Trade[], updatedSpecimens: ChartSpecimen[]) => void;
  onOpenEditSpecimen?: (specimen: ChartSpecimen) => void;
  onOpenDebrief?: (trade: Trade) => void;
  onUpdateSecurityPin: (newPin: string, enabled: boolean) => void;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onChangeDefaultRisk: (val: number) => void;
  onExport: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onForceSync: () => Promise<void>;
}

const cleanStr = (s?: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

// Dynamically loads JSZip on-demand without bloating initial bundle
async function getJSZip(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).JSZip) return (window as any).JSZip;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip archiver'));
    document.head.appendChild(script);
  });
}

// Converts any image blob into a clean, authentic native PNG that Windows Explorer thumbnails
async function convertBlobToValidPng(rawBlob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(rawBlob);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(rawBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (pngBlob) => resolve(pngBlob),
          'image/png'
        );
      } else {
        resolve(rawBlob);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
}

// Multi-fallback CORS Resolver with 4 bridges to ensure 100% download rate
async function fetchChartBlob(url: string): Promise<Blob | null> {
  if (!url) return null;

  if (url.startsWith('data:image')) {
    const res = await fetch(url).catch(() => null);
    const b = res ? await res.blob() : null;
    return b ? await convertBlobToValidPng(b) : null;
  }

  const endpoints = [
    url,
    `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`,
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint).catch(() => null);
      if (res && res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html')) {
          const blob = await res.blob();
          if (blob.size > 1500) {
            const png = await convertBlobToValidPng(blob);
            if (png) return png;
          }
        }
      }
    } catch {
      // Continue to next endpoint
    }
  }

  return null;
}

export function SettingsView({
  defaultRisk,
  currentUser,
  securityPin,
  isLockEnabled,
  trades = [],
  studySpecimens = [],
  collections = [],
  onUpdateMigratedData,
  onOpenEditSpecimen,
  onOpenDebrief,
  onUpdateSecurityPin,
  onGoogleLogin,
  onLogout,
  onChangeDefaultRisk,
  onExport,
  onRestore,
  onReset,
  onForceSync
}: SettingsViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pinInput, setPinInput] = useState(securityPin || '');
  const [showPin, setShowPin] = useState(false);
  const [enabledToggle, setEnabledToggle] = useState(isLockEnabled);
  const [pinSavedFeedback, setPinSavedFeedback] = useState(false);

  // Red Warning Wipe Modal State
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipePasswordInput, setWipePasswordInput] = useState('');
  const [wipeError, setWipeError] = useState('');

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [migrationSuccessCount, setMigrationSuccessCount] = useState<number | null>(null);
  const [unmigratedList, setUnmigratedList] = useState<UnmigratedChartItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Offline Zip Export State
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgressText, setZipProgressText] = useState<string>('');

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onForceSync();
    setIsSyncing(false);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSecurityPin(pinInput.trim(), enabledToggle);
    setPinSavedFeedback(true);
    setTimeout(() => setPinSavedFeedback(false), 3000);
  };

  const handleConfirmWipe = (e: React.FormEvent) => {
    e.preventDefault();
    setWipeError('');

    if (securityPin && securityPin.trim() !== '') {
      if (wipePasswordInput.trim() !== securityPin.trim()) {
        setWipeError('Incorrect security password / PIN.');
        return;
      }
    } else {
      if (wipePasswordInput.trim().toUpperCase() !== 'DELETE') {
        setWipeError('Please type DELETE to confirm.');
        return;
      }
    }

    setIsWipeModalOpen(false);
    setWipePasswordInput('');
    setWipeError('');
    onReset();
  };

  // Detect count of charts still hosted on legacy ImgBB or temporary data URLs
  const legacyChartStats = useMemo(() => {
    let legacyCount = 0;
    const isLegacy = (url?: string) => !!(url && (url.includes('ibb.co') || url.startsWith('data:image')));

    trades.forEach(t => {
      if (isLegacy(t.image1)) legacyCount++;
      if (isLegacy(t.image2)) legacyCount++;
    });

    studySpecimens.forEach(s => {
      if (isLegacy(s.imageUrl)) legacyCount++;
    });

    return { legacyCount };
  }, [trades, studySpecimens]);

  // Automated Migration Engine
  const handleStartMigration = async () => {
    if (isMigrating) return;
    setIsMigrating(true);
    setUnmigratedList([]);
    setMigrationSuccessCount(null);

    const isLegacy = (url?: string) => !!(url && (url.includes('ibb.co') || url.startsWith('data:image')));

    interface MigrationTask {
      type: 'trade-image1' | 'trade-image2' | 'specimen';
      id: string;
      title: string;
      setupName: string;
      date: string;
      url: string;
      trade?: Trade;
      specimen?: ChartSpecimen;
    }

    const tasks: MigrationTask[] = [];

    trades.forEach(t => {
      if (isLegacy(t.image1)) {
        tasks.push({
          type: 'trade-image1',
          id: t.id,
          title: `${t.symbol} — Context (HTF)`,
          setupName: t.setupType || 'General',
          date: t.tradeDate,
          url: t.image1!,
          trade: t
        });
      }
      if (isLegacy(t.image2)) {
        tasks.push({
          type: 'trade-image2',
          id: t.id,
          title: `${t.symbol} — Execution (LTF)`,
          setupName: t.setupType || 'General',
          date: t.tradeDate,
          url: t.image2!,
          trade: t
        });
      }
    });

    studySpecimens.forEach(s => {
      if (isLegacy(s.imageUrl)) {
        tasks.push({
          type: 'specimen',
          id: s.id,
          title: s.title || 'Study Chart',
          setupName: s.collectionName || 'General',
          date: s.date,
          url: s.imageUrl,
          specimen: s
        });
      }
    });

    setMigrationProgress({ current: 0, total: tasks.length });

    if (tasks.length === 0) {
      setIsMigrating(false);
      setMigrationSuccessCount(0);
      return;
    }

    const updatedTrades = [...trades];
    const updatedSpecimens = [...studySpecimens];
    const failedItems: UnmigratedChartItem[] = [];
    let successfulMigrations = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setMigrationProgress({ current: i + 1, total: tasks.length });

      try {
        const imageBlob = await fetchChartBlob(task.url);

        if (!imageBlob || imageBlob.size < 100) {
          throw new Error('Image expired or removed by host');
        }

        const newPermanentUrl = await uploadScreenshotToCloud(imageBlob);

        if (newPermanentUrl && (newPermanentUrl.startsWith('http') || newPermanentUrl.startsWith('data:image'))) {
          successfulMigrations++;

          if (task.type === 'trade-image1') {
            const idx = updatedTrades.findIndex(t => t.id === task.id);
            if (idx !== -1) updatedTrades[idx] = { ...updatedTrades[idx], image1: newPermanentUrl };
          } else if (task.type === 'trade-image2') {
            const idx = updatedTrades.findIndex(t => t.id === task.id);
            if (idx !== -1) updatedTrades[idx] = { ...updatedTrades[idx], image2: newPermanentUrl };
          } else if (task.type === 'specimen') {
            const idx = updatedSpecimens.findIndex(s => s.id === task.id);
            if (idx !== -1) updatedSpecimens[idx] = { ...updatedSpecimens[idx], imageUrl: newPermanentUrl };
          }
        } else {
          throw new Error('Upload to permanent cloud failed');
        }
      } catch {
        failedItems.push({
          id: task.id,
          type: task.type,
          title: task.title,
          setupName: task.setupName,
          date: task.date,
          oldUrl: task.url,
          trade: task.trade,
          specimen: task.specimen
        });
      }

      await new Promise(r => setTimeout(r, 40));
    }

    if (onUpdateMigratedData && successfulMigrations > 0) {
      onUpdateMigratedData(updatedTrades, updatedSpecimens);
    }

    setIsMigrating(false);
    setMigrationSuccessCount(successfulMigrations);
    setUnmigratedList(failedItems);
  };

  // FULL OFFLINE ZIP DOWNLOAD WITH CANONICAL FOLDER RESOLUTION & UNIQUE COLLISION-SAFE NAMES
  const handleDownloadOfflineZip = async () => {
    if (isZipping) return;
    setIsZipping(true);
    setZipProgressText('Scanning all charts in database...');

    try {
      const JSZipLib = await getJSZip();
      if (!JSZipLib) throw new Error('Could not initialize ZIP engine');

      const zip = new JSZipLib();

      // 1. Save Complete JSON Backup in zip root
      zip.file('nivarp_journal_data.json', JSON.stringify({
        trades,
        collections,
        studySpecimens,
        defaultRiskPerTrade: defaultRisk,
        exportedAt: new Date().toISOString()
      }, null, 2));

      // Canonical Folder Resolver: Unifies "Liquidity Spring" and "1 - Liquidity Spring" into the exact same folder
      const getCanonicalFolderName = (rawName?: string): string => {
        if (!rawName) return 'General';
        const clean = cleanStr(rawName);
        const cleanStripped = cleanStr(displaySetupName(rawName));

        const matched = collections.find(c => {
          const colClean = cleanStr(c.name);
          const colCleanStripped = cleanStr(displaySetupName(c.name));
          return colClean === clean || colCleanStripped === cleanStripped || colClean === cleanStripped || colCleanStripped === clean;
        });

        const finalName = matched ? matched.name : rawName;
        return finalName.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'General';
      };

      const usedFilenamesInFolder = new Map<string, number>();
      const seenUrlInFolder = new Set<string>();

      interface DownloadTask {
        folder: string;
        filename: string;
        url: string;
      }

      const tasks: DownloadTask[] = [];

      const queueChart = (folderName: string, rawTitle: string, rawDate: string, url?: string, suffix?: string) => {
        if (!url || !url.trim()) return;
        const cleanUrl = url.trim();
        const folder = getCanonicalFolderName(folderName);
        
        // Prevent duplicate downloads of the same image in the same folder
        const folderUrlKey = `${folder}::${cleanUrl}`;
        if (seenUrlInFolder.has(folderUrlKey)) return;
        seenUrlInFolder.add(folderUrlKey);

        const cleanTitle = (rawTitle || 'Chart').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const cleanDate = (rawDate || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const cleanSuffix = suffix ? `_${suffix}` : '';
        const baseName = `${cleanTitle}_${cleanDate}${cleanSuffix}`.replace(/_+/g, '_').replace(/_$/, '');

        // Generate guaranteed unique filename so NO chart overwrites another
        const countKey = `${folder}::${baseName}`;
        const count = (usedFilenamesInFolder.get(countKey) || 0) + 1;
        usedFilenamesInFolder.set(countKey, count);

        const finalFilename = count === 1 ? `${baseName}.png` : `${baseName}_(${count}).png`;

        tasks.push({
          folder,
          filename: finalFilename,
          url: cleanUrl
        });
      };

      // 1. Add all Study Specimens
      studySpecimens.forEach((s) => {
        queueChart(s.collectionName || 'General', s.title || 'Study', s.date || '', s.imageUrl);
      });

      // 2. Add all Live Trade Context & Execution Charts
      trades.forEach((t) => {
        const setup = t.setupType || 'General';
        const sym = t.symbol || 'Trade';
        const dt = t.tradeDate || '';

        if (t.image1) {
          queueChart(setup, `${sym}_HTF`, dt, t.image1, 'Context');
        }
        if (t.image2) {
          queueChart(setup, `${sym}_LTF`, dt, t.image2, 'Execution');
        }
      });

      // Download each image and place into its setup folder with throttled queue
      let savedCount = 0;
      for (let i = 0; i < tasks.length; i++) {
        const item = tasks[i];
        setZipProgressText(`Saving chart ${i + 1} of ${tasks.length} [${savedCount} saved]...`);

        try {
          const verifiedBlob = await fetchChartBlob(item.url);
          if (verifiedBlob && verifiedBlob.size > 1500) {
            zip.folder(item.folder)?.file(item.filename, verifiedBlob);
            savedCount++;
          }
        } catch {
          // Continue saving remaining images
        }

        await new Promise(r => setTimeout(r, 40));
      }

      setZipProgressText('Packaging into final ZIP archive...');

      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata: any) => {
        setZipProgressText(`Packaging ZIP: ${Math.round(metadata.percent)}%`);
      });

      // Trigger browser file download to local drive
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Nivarp_Offline_Vault_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setZipProgressText('');
      setIsZipping(false);
    } catch (err: any) {
      alert(`Export notice: ${err.message}`);
      setIsZipping(false);
      setZipProgressText('');
    }
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 1500);
  };

  // Only show migration panel if legacy charts still exist or migration/results are active
  const shouldShowMigration = legacyChartStats.legacyCount > 0 || isMigrating || unmigratedList.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* 1. PERMANENT CHART MIGRATION TOOL (AUTO-HIDES ONCE 0 LEGACY CHARTS REMAIN) */}
      {shouldShowMigration && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Permanent Cloud Chart Migration</span>
                  {legacyChartStats.legacyCount > 0 ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {legacyChartStats.legacyCount} Legacy Charts Found
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      All Charts Up-to-date
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Transfers remaining temporary links to permanent free cloud storage. This panel auto-hides once done.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartMigration}
              disabled={isMigrating || legacyChartStats.legacyCount === 0}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-mono font-bold text-xs transition-all shadow-md shadow-cyan-500/20 shrink-0"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Migrating ({migrationProgress.current}/{migrationProgress.total})...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Migrate All Charts</span>
                </>
              )}
            </button>
          </div>

          {/* MIGRATION PROGRESS BAR */}
          {isMigrating && (
            <div className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] font-mono text-xs">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  <span>Re-uploading and verifying chart images...</span>
                </span>
                <span className="text-cyan-300 font-bold">
                  {migrationProgress.current} / {migrationProgress.total} ({Math.round((migrationProgress.current / (migrationProgress.total || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-white/[0.04] h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all duration-200 rounded-full"
                  style={{ width: `${Math.round((migrationProgress.current / (migrationProgress.total || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* SUCCESS SUMMARY */}
          {migrationSuccessCount !== null && !isMigrating && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Successfully secured <strong>{migrationSuccessCount}</strong> chart(s) to permanent cloud storage.</span>
              </span>
            </div>
          )}

          {/* UNMIGRATED / EXPIRED CHARTS LIST */}
          {unmigratedList.length > 0 && (
            <div className="space-y-3 p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 font-mono text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileWarning className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h4 className="font-bold text-amber-300 text-xs sm:text-sm">
                      {unmigratedList.length} Unmigrated / Expired Chart(s)
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      The free host (ImgBB) already wiped these files. Use the details below to find your original chart on TradingView and click <strong>Replace</strong> to paste the new link:
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/[0.06] border border-white/10 rounded-xl bg-black/50 overflow-hidden">
                {unmigratedList.map((item, idx) => (
                  <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs">{item.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-cyan-300 border border-white/5">
                          {item.setupName}
                        </span>
                        <span className="text-[10px] text-zinc-500">({item.date})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 truncate">
                        <span className="text-rose-400 font-bold shrink-0">Expired link:</span>
                        <span className="truncate max-w-[280px] text-zinc-400">{item.oldUrl}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item.oldUrl)}
                          className="text-zinc-400 hover:text-white p-0.5 transition-colors"
                          title="Copy broken link"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {copiedUrl === item.oldUrl && (
                          <span className="text-emerald-400 text-[9px]">Copied!</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.specimen && onOpenEditSpecimen && (
                        <button
                          type="button"
                          onClick={() => onOpenEditSpecimen(item.specimen!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Replace Link</span>
                        </button>
                      )}

                      {item.trade && onOpenDebrief && (
                        <button
                          type="button"
                          onClick={() => onOpenDebrief(item.trade!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Replace Link</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. COMPLETE OFFLINE DRIVE VAULT & DATABASE PORTABILITY */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Local Drive Vault & Offline Backup</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                100% Offline
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Download every chart screenshot sorted into folders by playbook setup directly onto your computer hard drive.
            </p>
          </div>
        </div>

        {/* 1-CLICK ZIP VAULT DOWNLOAD BUTTON */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-bold text-white text-xs flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-purple-400" />
              <span>Download Complete Offline Vault (.ZIP)</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Creates folders for each collection with verified PNGs, full thumbnails, and no corrupted files.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadOfflineZip}
            disabled={isZipping}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-mono font-bold text-xs transition-all shadow-lg shadow-purple-600/20 shrink-0"
          >
            {isZipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{zipProgressText || 'Packaging ZIP...'}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Local Vault (.ZIP)</span>
              </>
            )}
          </button>
        </div>

        {/* STANDARD JSON BACKUP & RESTORE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={onExport}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors border border-white/5"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" /><span>Download JSON Data Backup</span>
          </button>
          <label className="cursor-pointer p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors border border-white/5">
            <Upload className="w-3.5 h-3.5 text-emerald-400" /><span>Upload & Restore Backup</span>
            <input type="file" accept=".json" onChange={onRestore} className="hidden" />
          </label>
        </div>
      </div>

      {/* 3. GOOGLE ACCOUNT & CLOUD SYNC SECTION */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-xl object-cover border border-cyan-400/40 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                <Cloud className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">
                  {currentUser ? (currentUser.displayName || 'Google Account') : 'Multi-Device Cloud Account'}
                </h3>
                {currentUser && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Signed In
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {currentUser 
                  ? `${currentUser.email} • Private cloud storage active`
                  : 'Sign in to access your journal privately from phone and desktop.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <button
                onClick={onLogout}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-mono text-xs transition-all w-full sm:w-auto"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch</span>
              </button>
            ) : (
              <button
                onClick={onGoogleLogin}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs transition-all shadow-md w-full sm:w-auto"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </button>
            )}

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all w-full sm:w-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Force Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. TERMINAL SECURITY LOCK PANEL */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0 border border-cyan-500/20">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Terminal Security & PIN Lock</span>
              {enabledToggle && pinInput && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500">
              Locks the journal behind a master PIN whenever you step away.
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePin} className="space-y-3 pt-2 border-t border-white/[0.04]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 font-mono text-xs">
            <div className="relative flex-1">
              <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPin ? 'text' : 'password'}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Set password or PIN"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-9 py-2 text-white outline-none focus:border-cyan-400 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPin(prev => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEnabledToggle(prev => !prev)}
                className={`px-3 py-2 rounded-xl font-bold transition-all border text-xs ${
                  enabledToggle
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'bg-zinc-900 text-zinc-500 border-white/10 hover:text-white'
                }`}
              >
                {enabledToggle ? 'Enabled' : 'Disabled'}
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-all text-xs"
              >
                Save PIN
              </button>
            </div>
          </div>

          {pinSavedFeedback && (
            <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle className="w-3 h-3" />
              <span>Security PIN updated successfully.</span>
            </div>
          )}
        </form>
      </div>

      {/* 5. 1R Capital Benchmark Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">1R Capital Benchmark</h3>
              <p className="text-xs text-zinc-500">
                Risk denominator used for position sizing & converting Kotak net P&L into R.
              </p>
            </div>
          </div>

          <div className="w-full sm:w-44 shrink-0">
            <CustomNumberInput 
              value={defaultRisk} 
              onChange={onChangeDefaultRisk} 
              step={50} 
              textColor="text-emerald-400" 
            />
          </div>
        </div>
      </div>

      {/* 6. Danger Zone */}
      <div className="p-4 rounded-2xl bg-rose-950/10 border border-rose-900/30 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-xs text-rose-300">Purge Complete Journal & Codex</h4>
          <p className="text-[11px] text-zinc-500">Permanently clears trades, playbook setups, and chart specimens.</p>
        </div>
        <button 
          onClick={() => {
            setWipePasswordInput('');
            setWipeError('');
            setIsWipeModalOpen(true);
          }} 
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-800 text-rose-400 hover:bg-rose-900 text-xs font-mono transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Wipe Clean</span>
        </button>
      </div>

      {/* RED DANGER WARNING POPUP MODAL WITH PASSWORD CHECK */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0D0507] border-2 border-rose-600/80 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-[0_0_50px_rgba(225,29,72,0.35)] animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/40">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-300 font-mono">
                    Permanent Purge Warning
                  </h3>
                  <span className="text-[10px] font-mono text-rose-400/80 uppercase tracking-widest font-bold">
                    Irreversible Action
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setIsWipeModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/30 text-rose-200/90 text-xs font-mono space-y-1.5">
              <p className="font-bold text-rose-300">
                Are you absolutely sure you want to wipe all records?
              </p>
              <p className="text-[11px] text-rose-200/70 leading-relaxed">
                This will irreversibly delete all executed trades, custom playbook collections, chart studies, and local database cache.
              </p>
            </div>

            <form onSubmit={handleConfirmWipe} className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-zinc-300 block mb-1 text-[11px]">
                  {securityPin ? 'Enter Master Security PIN / Password to authorize:' : 'Type DELETE in capital letters to confirm:'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoFocus
                    value={wipePasswordInput}
                    onChange={(e) => setWipePasswordInput(e.target.value)}
                    placeholder={securityPin ? 'Enter Security PIN' : 'Type DELETE'}
                    className="w-full bg-[#18080C] border border-rose-600/50 focus:border-rose-500 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none font-bold text-xs"
                  />
                </div>
                {wipeError && (
                  <p className="text-rose-400 text-[11px] mt-1.5 font-bold animate-in fade-in">
                    ⚠️ {wipeError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWipeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition-colors shadow-lg shadow-rose-600/30 flex items-center gap-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Authorize & Wipe Everything</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}