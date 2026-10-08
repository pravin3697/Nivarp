'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Trade, PlaybookCollection, ChartSpecimen } from '@/types/trade';
import { parseKotakNeoCsv, parseDateToTimestamp, cleanSecurityName } from '@/lib/parser';
import { 
  syncMasterToCloud,
  fetchMasterFromCloud,
  forcePushAllToCloud, 
  purgeCloudData,
  MASTER_CATEGORY_ORDER
} from '@/lib/cloudSync';
import { auth, loginWithGoogle, logoutUser } from '@/lib/firebaseClient';
import { onAuthStateChanged, User } from 'firebase/auth';
import { idbGet, idbSet, idbClear } from '@/lib/storage';
import { NivarpLogo } from '@/components/ui/NivarpLogo';
import { ChartInspector, ChartGalleryItem } from '@/components/modals/ChartInspector';
import { CsvImportStudio } from '@/components/modals/CsvImportStudio';
import { EditDebriefModal, EditCollectionModal, AddStudyModal } from '@/components/modals/TradeModals';
import { PulseView } from '@/components/views/PulseView';
import { CodexView, sortSetupsSmartly } from '@/components/views/CodexView';
import { MatrixView } from '@/components/views/MatrixView';
import { HeatmapView } from '@/components/views/HeatmapView';
import { SettingsView } from '@/components/views/SettingsView';
import { 
  Compass, 
  BookMarked, 
  Binary, 
  Flame, 
  Settings as SettingsIcon, 
  UploadCloud, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  X
} from 'lucide-react';

const STORAGE_KEY = 'NIVARP_MASTER_STORAGE';
const STUDY_STORAGE_KEY = 'NIVARP_STUDY_SPECIMENS';
const CATEGORY_ORDER_KEY = 'NIVARP_CATEGORY_ORDER';

interface ToastState {
  message: string;
  type: 'success' | 'info' | 'error';
}

const cleanStr = (s?: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

// Ensure existing trades standardize TATA to TATAMOTORS on initial hydration
const sanitizeTrades = (tradesList: Trade[]): Trade[] => {
  return (tradesList || []).map(t => ({
    ...t,
    symbol: cleanSecurityName(t.symbol)
  }));
};

export default function NivarpOS() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [collections, setCollections] = useState<PlaybookCollection[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(MASTER_CATEGORY_ORDER);
  const [studySpecimens, setStudySpecimens] = useState<ChartSpecimen[]>([]);
  const [defaultRiskPerTrade, setDefaultRiskPerTrade] = useState<number>(600);
  const [activeTab, setActiveTab] = useState<'pulse' | 'codex' | 'matrix' | 'heatmap' | 'settings'>('pulse');
  const [selectedCollection, setSelectedCollection] = useState<PlaybookCollection | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Modals state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDebriefModalOpen, setIsDebriefModalOpen] = useState(false);
  const [isAddCollectionOpen, setIsAddCollectionOpen] = useState(false);
  const [isEditCollectionOpen, setIsEditCollectionOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<PlaybookCollection | null>(null);
  const [isAddStudyChartOpen, setIsAddStudyChartOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const [inspectorChart, setInspectorChart] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    htf: string;
    ltf: string;
    items: ChartGalleryItem[];
    initialIndex: number;
  }>({ 
    isOpen: false, 
    url: '', 
    title: '', 
    htf: '', 
    ltf: '',
    items: [],
    initialIndex: 0
  });

  const [csvPreview, setCsvPreview] = useState<Trade[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [colName, setColName] = useState('');
  const [colCategory, setColCategory] = useState('');
  const [colDesc, setColDesc] = useState('');

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleTabChange = (tab: 'pulse' | 'codex' | 'matrix' | 'heatmap' | 'settings') => {
    setActiveTab(tab);
    setSelectedCollection(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        showToast(`Signed in: ${user.email}`, 'success');
        const cloudData = await fetchMasterFromCloud(user.uid);
        if (cloudData && (cloudData.trades.length > 0 || cloudData.collections.length > 0)) {
          setTrades(sanitizeTrades(cloudData.trades || []));
          setCollections(cloudData.collections || []);
          setStudySpecimens(cloudData.studySpecimens || []);
          setCategoryOrder(cloudData.categoryOrder || MASTER_CATEGORY_ORDER);
          if (cloudData.defaultRiskPerTrade) setDefaultRiskPerTrade(cloudData.defaultRiskPerTrade);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const user = await loginWithGoogle();
    if (user) {
      showToast("Signed in with Google successfully.", "success");
    } else {
      showToast("Google sign-in canceled.", "info");
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    showToast("Signed out. Ready for another account.", "info");
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const deduplicatedCollections = useMemo(() => {
    const seen = new Set<string>();
    return collections.filter(c => {
      const key = cleanStr(c.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [collections]);

  const uniqueCategories = useMemo(() => {
    const catSet = new Set<string>();
    deduplicatedCollections.forEach(c => {
      const formatted = c.category.trim().toUpperCase();
      if (formatted) catSet.add(formatted);
    });

    const categories = Array.from(catSet);
    const activeOrder = (categoryOrder.length ? categoryOrder : MASTER_CATEGORY_ORDER).map(c => c.trim().toUpperCase());

    return categories.sort((a, b) => {
      const idxA = activeOrder.indexOf(a);
      const idxB = activeOrder.indexOf(b);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [deduplicatedCollections, categoryOrder]);

  const playbookOrderedCollections = useMemo(() => {
    return [...deduplicatedCollections].sort((a, b) => {
      const catA = a.category.trim().toUpperCase();
      const catB = b.category.trim().toUpperCase();

      const activeOrder = (categoryOrder.length ? categoryOrder : MASTER_CATEGORY_ORDER).map(c => c.trim().toUpperCase());
      const idxA = activeOrder.indexOf(catA);
      const idxB = activeOrder.indexOf(catB);

      const rankA = idxA === -1 ? 9999 : idxA;
      const rankB = idxB === -1 ? 9999 : idxB;

      if (rankA !== rankB) return rankA - rankB;
      return sortSetupsSmartly(a, b);
    });
  }, [deduplicatedCollections, categoryOrder]);

  // Initial Load: IndexedDB First, then Cloud
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [idbMaster, idbStudy, idbCatOrder] = await Promise.all([
          idbGet<any>(STORAGE_KEY),
          idbGet<ChartSpecimen[]>(STUDY_STORAGE_KEY),
          idbGet<string[]>(CATEGORY_ORDER_KEY)
        ]);

        if (idbMaster) {
          if (idbMaster.trades?.length) setTrades(sanitizeTrades(idbMaster.trades));
          if (idbMaster.collections?.length) setCollections(idbMaster.collections);
          if (idbMaster.defaultRiskPerTrade) setDefaultRiskPerTrade(idbMaster.defaultRiskPerTrade);
        }

        if (idbStudy && Array.isArray(idbStudy)) {
          setStudySpecimens(idbStudy);
        }

        if (idbCatOrder && Array.isArray(idbCatOrder) && idbCatOrder.length > 0) {
          setCategoryOrder(idbCatOrder.map(c => c.trim().toUpperCase()));
        }

        const cloudData = await fetchMasterFromCloud(currentUser?.uid || 'master');
        if (isMounted && cloudData && (cloudData.trades.length > 0 || cloudData.collections.length > 0)) {
          setTrades(sanitizeTrades(cloudData.trades));
          setCollections(cloudData.collections);
          setStudySpecimens(cloudData.studySpecimens);
          setCategoryOrder(cloudData.categoryOrder);
        }
      } catch (err) {
        console.warn('Storage sync notice:', err);
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Auto-Sync
  useEffect(() => {
    if (!isLoaded) return;

    idbSet(STORAGE_KEY, {
      trades, 
      collections: deduplicatedCollections, 
      categoryOrder,
      defaultRiskPerTrade
    });
    idbSet(STUDY_STORAGE_KEY, studySpecimens);
    idbSet(CATEGORY_ORDER_KEY, categoryOrder);

    const timer = setTimeout(async () => {
      await syncMasterToCloud({
        trades,
        collections: deduplicatedCollections,
        studySpecimens,
        categoryOrder,
        defaultRiskPerTrade
      }, currentUser?.uid || 'master');
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoaded, trades, deduplicatedCollections, categoryOrder, studySpecimens, defaultRiskPerTrade, currentUser]);

  const handleExportBackup = () => {
    try {
      const payload = {
        trades,
        collections: deduplicatedCollections,
        categoryOrder,
        studySpecimens,
        defaultRiskPerTrade,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nivarp_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("JSON backup downloaded successfully.", "success");
    } catch {
      showToast("Failed to create download backup.", "error");
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        const restoredTrades = sanitizeTrades(Array.isArray(d.trades) ? d.trades : []);
        const restoredCols = Array.isArray(d.collections) ? d.collections : [];
        const restoredCats = Array.isArray(d.categoryOrder) 
          ? d.categoryOrder.map((c: string) => c.trim().toUpperCase()) 
          : MASTER_CATEGORY_ORDER;
        const restoredStudy = Array.isArray(d.studySpecimens) ? d.studySpecimens : [];

        setTrades(restoredTrades);
        setCollections(restoredCols);
        setCategoryOrder(restoredCats);
        setStudySpecimens(restoredStudy);
        if (d.defaultRiskPerTrade) setDefaultRiskPerTrade(d.defaultRiskPerTrade);

        await Promise.all([
          idbSet(STORAGE_KEY, {
            trades: restoredTrades,
            collections: restoredCols,
            categoryOrder: restoredCats,
            defaultRiskPerTrade: d.defaultRiskPerTrade || 600
          }),
          idbSet(STUDY_STORAGE_KEY, restoredStudy),
          idbSet(CATEGORY_ORDER_KEY, restoredCats)
        ]);

        showToast("Restoring backup...", "info");
        await syncMasterToCloud({
          trades: restoredTrades,
          collections: restoredCols,
          studySpecimens: restoredStudy,
          categoryOrder: restoredCats,
          defaultRiskPerTrade: d.defaultRiskPerTrade || 600
        }, currentUser?.uid || 'master');

        showToast(`Restored & synced: ${restoredTrades.length} trades, ${restoredCols.length} setups.`, "success");
      } catch (err: any) {
        showToast(`Failed to parse backup: ${err.message}`, "error");
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  const handleForceSync = async () => {
    const res = await forcePushAllToCloud(trades, deduplicatedCollections, studySpecimens, currentUser?.uid || 'master');
    if (res.success) {
      showToast(`Cloud live: ${trades.length} trades, ${deduplicatedCollections.length} setups synced.`, "success");
    } else {
      showToast(`Sync issue: ${res.error}.`, "error");
    }
  };

  const handleReorderCategories = (newOrder: string[]) => {
    const cleanOrder = newOrder.map(c => c.trim().toUpperCase());
    setCategoryOrder(cleanOrder);
    idbSet(CATEGORY_ORDER_KEY, cleanOrder);
    showToast("Category order saved.", "info");
  };

  const handleUpdateCollection = (updated: PlaybookCollection) => {
    const oldCol = collections.find(c => c.id === updated.id);
    const oldName = oldCol?.name || updated.name;
    const oldNameClean = cleanStr(oldName);

    setCollections(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selectedCollection?.id === updated.id) {
      setSelectedCollection(updated);
    }

    setTrades(prev => prev.map(t => 
      cleanStr(t.setupType) === oldNameClean ? { ...t, setupType: updated.name } : t
    ));

    setStudySpecimens(prev => {
      const updatedSpecimens = prev.map(s => {
        const matchById = s.collectionId && updated.id && s.collectionId === updated.id;
        const matchByName = cleanStr(s.collectionName) === oldNameClean;

        if (matchById || matchByName) {
          return {
            ...s,
            collectionId: updated.id,
            collectionName: updated.name
          };
        }
        return s;
      });

      idbSet(STUDY_STORAGE_KEY, updatedSpecimens);
      return updatedSpecimens;
    });

    setIsEditCollectionOpen(false);
    setEditingCollection(null);
    showToast(`Setup collection "${updated.name}" updated.`, "success");
  };

  const handleReorderSpecimens = (reordered: ChartSpecimen[]) => {
    if (!selectedCollection) return;
    const targetColId = selectedCollection.id;
    const targetNameClean = cleanStr(selectedCollection.name);

    const orderMap = new Map<string, number>();
    reordered.forEach((item, index) => {
      orderMap.set(String(item.id), index);
    });

    setStudySpecimens(prev => {
      const thisCol = prev.filter(s => {
        if (s.collectionId && targetColId && s.collectionId === targetColId) return true;
        return cleanStr(s.collectionName) === targetNameClean;
      });

      const otherCols = prev.filter(s => {
        if (s.collectionId && targetColId && s.collectionId === targetColId) return false;
        return cleanStr(s.collectionName) !== targetNameClean;
      });

      thisCol.sort((a, b) => {
        const orderA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 9999;
        const orderB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 9999;
        return orderA - orderB;
      });

      const updated = [...thisCol, ...otherCols];
      idbSet(STUDY_STORAGE_KEY, updated);
      return updated;
    });

    showToast("Chart order saved.", "info");
  };

  const handlePurgeAll = async () => {
    if (!confirm("Are you sure you want to completely erase all trades and collections? This cannot be undone.")) {
      return;
    }

    setTrades([]);
    setCollections([]);
    setCategoryOrder(MASTER_CATEGORY_ORDER);
    setStudySpecimens([]);
    setSelectedCollection(null);

    await Promise.all([
      idbClear(),
      purgeCloudData(currentUser?.uid || 'master')
    ]);

    if (typeof window !== 'undefined') {
      localStorage.clear();
    }

    showToast("All journal data wiped clean.", "info");
  };

  const stats = useMemo(() => {
    const total = trades.length;
    if (!total) return { total: 0, netR: 0, winRate: 0, longs: 0, shorts: 0, maxDD: 0, athR: 0, profitFactor: 0, totalPnl: 0 };
    const wins = trades.filter(t => t.rMultiple > 0);
    const losses = trades.filter(t => t.rMultiple <= 0);
    const netR = Number(trades.reduce((acc, t) => acc + t.rMultiple, 0).toFixed(2));
    const winRate = Math.round((wins.length / total) * 100);
    const longs = trades.filter(t => t.direction === 'LONG').length;
    const shorts = trades.filter(t => t.direction === 'SHORT').length;
    const totalPnl = trades.reduce((acc, t) => acc + (t.netPnl || 0), 0);
    let runR = 0, peak = 0, maxDD = 0;
    trades.forEach(t => { runR += t.rMultiple; if (runR > peak) peak = runR; const dd = peak - runR; if (dd > maxDD) maxDD = dd; });
    const pf = losses.length ? Number((wins.reduce((a, b) => a + b.rMultiple, 0) / Math.abs(losses.reduce((a, b) => a + b.rMultiple, 0))).toFixed(2)) : 0;
    return { total, netR, winRate, longs, shorts, maxDD: Number(maxDD.toFixed(2)), athR: Number(peak.toFixed(2)), profitFactor: pf, totalPnl };
  }, [trades]);

  const growthCurve = useMemo(() => {
    const chronological = [...trades].sort((a, b) => parseDateToTimestamp(a.tradeDate) - parseDateToTimestamp(b.tradeDate));
    let cumR = 0;
    return chronological.map((t, idx) => { 
      cumR += t.rMultiple; 
      return { point: `#${idx + 1}`, r: Number(cumR.toFixed(2)) }; 
    });
  }, [trades]);

  const activeCollectionSpecimens = useMemo(() => {
    if (!selectedCollection) return [];
    const specs: ChartSpecimen[] = [];
    const targetColId = selectedCollection.id;
    const targetNameClean = cleanStr(selectedCollection.name);

    trades.filter(t => cleanStr(t.setupType) === targetNameClean).forEach(t => {
      const ltf = t.image2 || t.image1;
      if (ltf) specs.push({ 
        id: `ltf-${t.id}`, 
        collectionId: targetColId,
        collectionName: t.setupType, 
        type: 'LIVE_TRADE', 
        title: `${t.symbol} — Execution (LTF)`, 
        date: t.tradeDate, 
        imageUrl: ltf, 
        rMultiple: t.rMultiple 
      });
    });

    studySpecimens.filter(s => {
      if (s.collectionId && targetColId && s.collectionId === targetColId) return true;
      return cleanStr(s.collectionName) === targetNameClean;
    }).forEach(s => specs.push(s));

    return specs;
  }, [selectedCollection, trades, studySpecimens]);

  return (
    <div className="min-h-screen bg-[#050608] text-zinc-100 font-sans selection:bg-emerald-500/20 antialiased pb-20 md:pb-6">
      {/* FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:right-6 z-[120] flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0B0D14]/95 border border-white/15 text-white shadow-2xl backdrop-blur-2xl animate-in fade-in duration-200 font-mono text-xs max-w-md">
          <div className={`p-1.5 rounded-xl shrink-0 ${
            toast.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 
            toast.type === 'info' ? 'bg-cyan-500/20 text-cyan-400' : 
            'bg-emerald-500/20 text-emerald-400'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : 
             toast.type === 'info' ? <Info className="w-4 h-4" /> : 
             <CheckCircle2 className="w-4 h-4" />}
          </div>
          <span className="font-semibold text-zinc-100 flex-1 leading-snug">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-zinc-500 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="border-b border-white/[0.06] bg-[#08090D]/90 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <NivarpLogo size="md" />

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            {(['pulse', 'codex', 'matrix', 'heatmap', 'settings'] as const).map(tab => (
              <button 
                key={tab} 
                onClick={() => handleTabChange(tab)} 
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  activeTab === tab ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab === 'pulse' && <Compass className="w-3.5 h-3.5 text-emerald-400" />}
                {tab === 'codex' && <BookMarked className="w-3.5 h-3.5 text-cyan-400" />}
                {tab === 'matrix' && <Binary className="w-3.5 h-3.5 text-purple-400" />}
                {tab === 'heatmap' && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                {tab === 'settings' && <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{tab}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right side: Clean Import Button */}
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => setIsCsvModalOpen(true)} 
            className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.18)]"
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Import Kotak Neo CSV</span>
            <span className="sm:hidden">Import</span>
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION DOCK */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#08090D]/95 backdrop-blur-2xl border-t border-white/[0.08] px-3 py-2 flex items-center justify-around safe-bottom-padding shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
        {(['pulse', 'codex', 'matrix', 'heatmap', 'settings'] as const).map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-zinc-800 scale-110' : ''}`}>
                {tab === 'pulse' && <Compass className={`w-4 h-4 ${isActive ? 'text-emerald-400' : ''}`} />}
                {tab === 'codex' && <BookMarked className={`w-4 h-4 ${isActive ? 'text-cyan-400' : ''}`} />}
                {tab === 'matrix' && <Binary className={`w-4 h-4 ${isActive ? 'text-purple-400' : ''}`} />}
                {tab === 'heatmap' && <Flame className={`w-4 h-4 ${isActive ? 'text-amber-400' : ''}`} />}
                {tab === 'settings' && <SettingsIcon className={`w-4 h-4 ${isActive ? 'text-zinc-300' : ''}`} />}
              </div>
              <span className="text-[10px] font-mono capitalize tracking-wide">{tab}</span>
            </button>
          );
        })}
      </nav>

      {/* MAIN VIEWPORT */}
      <main className="max-w-[1600px] mx-auto px-3.5 sm:px-6 py-4 md:py-6 space-y-6 flex-1">
        {activeTab === 'pulse' && (
          <PulseView
            trades={trades} stats={stats} growthCurve={growthCurve} defaultRisk={defaultRiskPerTrade}
            onOpenInspector={(url: string, title: string, htfUrl?: string, ltfUrl?: string) => setInspectorChart({ 
              isOpen: true, 
              url, 
              title, 
              htf: htfUrl || '', 
              ltf: ltfUrl || '',
              items: [],
              initialIndex: 0
            })}
            onOpenDebrief={(t: Trade) => { setEditingTrade(t); setIsDebriefModalOpen(true); }}
            onOpenCsvModal={() => setIsCsvModalOpen(true)}
          />
        )}
        {activeTab === 'codex' && (
          <CodexView
            collections={deduplicatedCollections} uniqueCategories={uniqueCategories} selectedCollection={selectedCollection}
            activeCollectionSpecimens={activeCollectionSpecimens} trades={trades} studySpecimens={studySpecimens}
            onSelectCollection={(col: PlaybookCollection | null) => setSelectedCollection(col)} 
            onOpenAddCollection={() => setIsAddCollectionOpen(true)}
            onOpenEditCollection={(col: PlaybookCollection) => { setEditingCollection(col); setIsEditCollectionOpen(true); }}
            onOpenAddStudy={() => setIsAddStudyChartOpen(true)}
            onDeleteCollection={(id: string, name: string) => {
              setCollections((p: PlaybookCollection[]) => p.filter((c: PlaybookCollection) => c.id !== id));
              showToast(`Setup collection "${name}" deleted.`, "info");
            }}
            onDeleteSpecimen={(id: string) => {
              setStudySpecimens((p: ChartSpecimen[]) => {
                const updated = p.filter((s: ChartSpecimen) => String(s.id) !== String(id));
                idbSet(STUDY_STORAGE_KEY, updated);
                return updated;
              });
              showToast("Specimen chart removed.", "info");
            }}
            onReorderSpecimens={handleReorderSpecimens}
            onReorderCategories={handleReorderCategories}
            onReorderCollections={(updated: PlaybookCollection[]) => {
              setCollections(updated);
              showToast("Setup order saved.", "info");
            }}
            onOpenInspector={(url: string, title: string, index = 0, items = []) => setInspectorChart({ 
              isOpen: true, 
              url, 
              title, 
              htf: '', 
              ltf: '',
              items,
              initialIndex: index
            })}
          />
        )}
        {activeTab === 'matrix' && <MatrixView collections={deduplicatedCollections} trades={trades} />}
        {activeTab === 'heatmap' && <HeatmapView trades={trades} />}
        {activeTab === 'settings' && (
          <SettingsView
            defaultRisk={defaultRiskPerTrade}
            currentUser={currentUser}
            onGoogleLogin={handleGoogleLogin}
            onLogout={handleLogout}
            onChangeDefaultRisk={(val: number) => {
              setDefaultRiskPerTrade(val);
              showToast(`1R Risk updated to ₹${val.toLocaleString('en-IN')}`, "success");
            }} 
            onExport={handleExportBackup}
            onRestore={handleRestoreBackup}
            onReset={handlePurgeAll}
            onForceSync={handleForceSync}
          />
        )}
      </main>

      {/* FULLSCREEN INSPECTOR */}
      <ChartInspector
        isOpen={inspectorChart.isOpen} 
        title={inspectorChart.title} 
        initialUrl={inspectorChart.url}
        htfUrl={inspectorChart.htf} 
        ltfUrl={inspectorChart.ltf}
        items={inspectorChart.items}
        initialIndex={inspectorChart.initialIndex}
        onClose={() => setInspectorChart(prev => ({ ...prev, isOpen: false }))}
      />

      {/* CSV MODAL */}
      <CsvImportStudio
        isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} csvPreview={csvPreview}
        csvFileName={csvFileName} defaultRisk={defaultRiskPerTrade} collections={playbookOrderedCollections}
        onFileUpload={(e) => {
          const f = e.target.files?.[0]; if (!f) return; setCsvFileName(f.name); const r = new FileReader();
          r.onload = (ev) => { 
            const p = parseKotakNeoCsv(ev.target?.result as string, defaultRiskPerTrade, playbookOrderedCollections); 
            setCsvPreview(p); 
            showToast(`Parsed ${p.length} trades from ${f.name}.`, "info");
          };
          r.readAsText(f);
        }}
        onUpdateTrade={(idx, field, val) => setCsvPreview(prev => { const c = [...prev]; c[idx] = { ...c[idx], [field]: val }; return c; })}
        onResetPreview={() => { setCsvPreview([]); setCsvFileName(''); }}
        onConfirmImport={() => { 
          setTrades(prev => [...prev, ...csvPreview]); 
          showToast(`Successfully imported ${csvPreview.length} trades.`, "success");
          setCsvPreview([]); 
          setIsCsvModalOpen(false); 
        }}
      />

      {/* DEBRIEF MODAL */}
      <EditDebriefModal
        isOpen={isDebriefModalOpen} trade={editingTrade} collections={playbookOrderedCollections}
        onClose={() => setIsDebriefModalOpen(false)}
        onSave={(updated) => { 
          const cleanUpdated = { ...updated, symbol: cleanSecurityName(updated.symbol) };
          setTrades(prev => prev.map(t => t.id === cleanUpdated.id ? cleanUpdated : t)); 
          showToast(`Debrief for ${cleanUpdated.symbol} saved.`, "success");
          setIsDebriefModalOpen(false); 
        }}
      />

      {/* EDIT SETUP MODAL */}
      <EditCollectionModal
        isOpen={isEditCollectionOpen}
        collection={editingCollection}
        onClose={() => { setIsEditCollectionOpen(false); setEditingCollection(null); }}
        onSave={handleUpdateCollection}
      />

      {/* ADD STUDY MODAL */}
      <AddStudyModal
        isOpen={isAddStudyChartOpen} collectionName={selectedCollection?.name || ''} suggestedSymbols={Array.from(new Set(trades.map(t => cleanSecurityName(t.symbol))))}
        onClose={() => setIsAddStudyChartOpen(false)}
        onSave={(symbol, url) => {
          if (!selectedCollection) return;
          const cleanSym = cleanSecurityName(symbol.trim());
          const uniqueId = `s-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          const newSpecimen: ChartSpecimen = {
            id: uniqueId,
            collectionId: selectedCollection.id,
            collectionName: selectedCollection.name.trim(),
            type: 'STUDY_SETUP',
            title: `${cleanSym} (Study)`,
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            imageUrl: url.trim()
          };

          setStudySpecimens(prev => {
            const updated = [newSpecimen, ...prev];
            idbSet(STUDY_STORAGE_KEY, updated);
            return updated;
          });

          showToast(`Study chart saved to "${selectedCollection.name}".`, "success");
          setIsAddStudyChartOpen(false);
        }}
      />

      {/* ADD SETUP MODAL */}
      {isAddCollectionOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#090A10] border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />Add Setup Collection
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault(); if (!colName || !colCategory) return;
              const newName = colName.trim();
              setCollections(p => [...p, { id: `c-${Date.now()}`, name: newName, category: colCategory.trim().toUpperCase(), description: colDesc.trim() }]);
              showToast(`Setup collection "${newName}" created.`, "success");
              setColName(''); setColCategory(''); setColDesc(''); setIsAddCollectionOpen(false);
            }} className="space-y-4 text-xs font-mono">
              <input type="text" value={colCategory} onChange={e => setColCategory(e.target.value)} placeholder="Category (e.g. BREAKOUT MODELS)" className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white" required />
              <input type="text" value={colName} onChange={e => setColName(e.target.value)} placeholder="Setup Name" className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white" required />
              <textarea value={colDesc} onChange={e => setColDesc(e.target.value)} placeholder="Rules / Trigger description..." className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white h-20" />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAddCollectionOpen(false)} className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-cyan-500 text-black font-bold rounded-lg shadow-lg">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}