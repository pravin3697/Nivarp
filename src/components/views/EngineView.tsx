'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GatekeeperConfig, GatekeeperCheckItem } from '@/types/trade';
import { idbGet, idbSet } from '@/lib/storage';
import { 
  Calculator, 
  AlertOctagon, 
  Copy, 
  Check, 
  CheckCircle,
  PictureInPicture2,
  ShieldCheck,
  Lock,
  Unlock,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  Clock,
  X
} from 'lucide-react';

export const WATCHLIST_TICKERS = ['DLF', 'HINDALCO', 'SBIN', 'TATAMOTORS'] as const;
export type WatchlistTicker = typeof WATCHLIST_TICKERS[number];

const GATEKEEPER_STORAGE_KEY = 'NIVARP_GATEKEEPER_CONFIG';

// Standardized setups in consistent order across Engine and Gatekeeper
const SETUPS_LIST = [
  { key: 'origin', label: 'Origin Retest', icon: '🔄', subtext: '35% Short' },
  { key: 'spring', label: 'Liquidity Spring', icon: '⚡', subtext: 'Reclaim' },
  { key: 'pivot', label: 'Overextended Pivot', icon: '🎯', subtext: '35% Short' },
  { key: 'b2b', label: 'Bearish To Bullish', icon: '📈', subtext: '35% Retest' }
] as const;

export const DEFAULT_GATEKEEPER_CONFIG: GatekeeperConfig = {
  globalConstraints: [
    { id: 'g-1', text: 'Time Filter: Current time strictly after 10:00 AM' },
    { id: 'g-2', text: 'Risk Cap: Max capital risk capped strictly <= 1% (1R)' },
    { id: 'g-3', text: 'Zone Size Limit: Main Zone is <= 0.33% of stock price' },
    { id: 'g-4', text: 'Pre-calculate Entry & 0.10% buffered SL resting prior to order' }
  ],
  setups: {
    origin: {
      setupKey: 'origin',
      label: 'Origin Retest',
      tag: 'BEARISH SHORT',
      tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      trailingRule: 'Trail to Breakeven (BE) once price drops below the initial bearish confirmation (the LL).',
      items: [
        { id: 'or-1', text: 'Price broken strictly BELOW Main Zone?' },
        { id: 'or-2', text: 'Mathematically confirmed downtrend (L, LH, LL) below zone?' },
        { id: 'or-3', text: 'Entry limit order resting exactly 35% inside Main Zone width?' }
      ]
    },
    spring: {
      setupKey: 'spring',
      label: 'Liquidity Spring',
      tag: 'BULLISH LONG',
      tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      trailingRule: "Trail to BE once price breaks above Today's High, pulls back, and breaks out higher again.",
      items: [
        { id: 'sp-1', text: 'Price broke above zone (bullish lure), failed retest & swept liquidity below?' },
        { id: 'sp-2', text: 'Confirmed bearish structure (L, LH, LL) established below zone?' },
        { id: 'sp-3', text: 'Price violently reclaiming back above Main Zone line?' },
        { id: 'sp-4', text: 'Stop entry order resting exactly 0.05% above Main Zone high?' }
      ]
    },
    pivot: {
      setupKey: 'pivot',
      label: 'Overextended Pivot',
      tag: 'BEARISH SHORT REVERSAL',
      tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      trailingRule: 'Trail stop to protect capital as soon as price expands away from Main Zone.',
      items: [
        { id: 'pv-1', text: 'Price extended significantly above Main Zone (HH/HL exhausted)?' },
        { id: 'pv-2', text: 'Violent drop back below zone with decisive red candle close?' },
        { id: 'pv-3', text: 'Short limit order resting exactly 35% inside Main Zone width?' }
      ]
    },
    b2b: {
      setupKey: 'b2b',
      label: 'Bearish To Bullish',
      tag: 'BULLISH LONG',
      tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      trailingRule: 'Mandatory trail to Breakeven (BE) once price decisively breaks above the reversal high (the HH).',
      items: [
        { id: 'bb-1', text: 'Execution strictly after 10:00 AM?' },
        { id: 'bb-2', text: 'Clear, prior resistance verified on Main Zone before breakout?' },
        { id: 'bb-3', text: 'Origin Retest failed; price violently pushed back above zone?' },
        { id: 'bb-4', text: 'Confirmed bullish structure (H, HL, HH) established?' },
        { id: 'bb-5', text: 'Long limit order resting exactly 35% inside Main Zone width?' }
      ]
    }
  }
};

function getISTTimeInfo() {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
    const formatted = formatter.format(now);

    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).format(now);
    
    const [h, m] = timeParts.split(':').map(Number);
    const minuteOfDay = (h || 0) * 60 + (m || 0);
    const isAfter10AM = minuteOfDay >= 10 * 60;
    const minutesTo10 = Math.max(0, 10 * 60 - minuteOfDay);

    return {
      formattedIST: formatted,
      isAfter10AM,
      minutesTo10
    };
  } catch {
    const now = new Date();
    return {
      formattedIST: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAfter10AM: now.getHours() >= 10,
      minutesTo10: 0
    };
  }
}

interface EngineViewProps {
  defaultRisk: number;
  tradingCapital: number;
  watchlistData: Record<string, { high: string; low: string }>;
  activeTicker: string;
  onSelectTicker: (ticker: string) => void;
  onUpdateTickerZone: (ticker: string, high: string, low: string) => void;
  onChangeTradingCapital: (val: number) => void;
  isWidgetMode?: boolean;
  onTogglePiP?: () => void;
  isPiPActive?: boolean;
}

const roundToTick = (val: number): number => {
  return Number((Math.round(val / 0.05) * 0.05).toFixed(2));
};

export function EngineView({
  defaultRisk,
  tradingCapital,
  watchlistData,
  activeTicker,
  onSelectTicker,
  onUpdateTickerZone,
  onChangeTradingCapital,
  isWidgetMode = false,
  onTogglePiP,
  isPiPActive = false
}: EngineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Top Switch Mode: 'engine' | 'gatekeeper'
  const [viewMode, setViewMode] = useState<'engine' | 'gatekeeper'>('engine');

  // Active Setup Tab ('origin' | 'spring' | 'pivot' | 'b2b')
  const [activeSetupTab, setActiveSetupTab] = useState<'origin' | 'spring' | 'pivot' | 'b2b'>('origin');

  const currentTickerData = watchlistData[activeTicker] || { high: '', low: '' };
  const [zoneHighInput, setZoneHighInput] = useState<string>(currentTickerData.high || '');
  const [zoneLowInput, setZoneLowInput] = useState<string>(currentTickerData.low || '');
  const [capitalInput, setCapitalInput] = useState<string>(String(tradingCapital || 70000));
  const [copiedPrice, setCopiedPrice] = useState<string | null>(null);

  // GATEKEEPER STATE (Fully dynamic & editable on website)
  const [gatekeeperConfig, setGatekeeperConfig] = useState<GatekeeperConfig>(DEFAULT_GATEKEEPER_CONFIG);
  const [isEditMode, setIsEditMode] = useState(false);

  // Per-Ticker checked states: Record<Ticker, Record<itemId, boolean>>
  const [tickerChecks, setTickerChecks] = useState<Record<string, Record<string, boolean>>>({});

  // Live IST Time Tracker (updates every 5 seconds)
  const [istTime, setIstTime] = useState(getISTTimeInfo);

  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(getISTTimeInfo());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // KEYBOARD SHORTCUTS (E for Engine, G for Gatekeeper)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't switch if user is actively typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setViewMode('engine');
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setViewMode('gatekeeper');
      }
    };

    // Listen on the window hosting this element (supports both main website and PiP window)
    const activeWin = containerRef.current?.ownerDocument?.defaultView || window;
    activeWin.addEventListener('keydown', handleKeyDown);

    if (activeWin !== window) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      activeWin.removeEventListener('keydown', handleKeyDown);
      if (activeWin !== window) {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, []);

  // Synchronize inputs whenever active ticker changes or watchlist updates from cloud
  useEffect(() => {
    const data = watchlistData[activeTicker] || { high: '', low: '' };
    setZoneHighInput(data.high || '');
    setZoneLowInput(data.low || '');
  }, [activeTicker, watchlistData]);

  useEffect(() => {
    if (tradingCapital) {
      setCapitalInput(String(tradingCapital));
    }
  }, [tradingCapital]);

  // Load Gatekeeper config from storage
  useEffect(() => {
    idbGet<GatekeeperConfig>(GATEKEEPER_STORAGE_KEY).then(saved => {
      if (saved && saved.globalConstraints && saved.setups) {
        setGatekeeperConfig(saved);
      }
    });
  }, []);

  const saveGatekeeperConfig = (updated: GatekeeperConfig) => {
    setGatekeeperConfig(updated);
    idbSet(GATEKEEPER_STORAGE_KEY, updated);
  };

  const handleHighChange = (val: string) => {
    setZoneHighInput(val);
    onUpdateTickerZone(activeTicker, val, zoneLowInput);
  };

  const handleLowChange = (val: string) => {
    setZoneLowInput(val);
    onUpdateTickerZone(activeTicker, zoneHighInput, val);
  };

  const handleCopy = (text: string | number, label: string) => {
    navigator.clipboard.writeText(String(text));
    setCopiedPrice(label);
    setTimeout(() => setCopiedPrice(null), 1500);
  };

  // Mainzone Math with 35% Depth & Capital Margin Audit
  const zoneMath = useMemo(() => {
    const high = parseFloat(zoneHighInput) || 0;
    const low = parseFloat(zoneLowInput) || 0;
    const accountCapital = parseFloat(capitalInput) || 70000;
    const intradayLeverage = 5;
    const totalBuyingPower = accountCapital * intradayLeverage;

    if (high <= 0 || low <= 0 || high <= low) {
      return null;
    }

    const zoneWidth = Number((high - low).toFixed(2));
    const maxAllowedZone = Number((high * 0.0033).toFixed(2)); // 0.33% Max allowed width
    const zoneWidthPct = Number(((zoneWidth / high) * 100).toFixed(3));
    const isZoneTooWide = zoneWidth > maxAllowedZone;

    // Buffer gaps
    const reclaimGap = high * 0.0005; // 0.05% of price
    const slGap = high * 0.001;       // 0.10% of price
    const penetration35 = zoneWidth * 0.35; // 35% of zone width
    const penetrationPct = Number(((penetration35 / high) * 100).toFixed(2));

    const maxAffordableQty = (entryPrice: number): number => {
      if (entryPrice <= 0) return 0;
      return Math.floor(totalBuyingPower / entryPrice);
    };

    const calcSetupMetrics = (entryPrice: number, slPrice: number, isShort: boolean) => {
      const riskPerShare = Number(Math.max(0.05, isShort ? slPrice - entryPrice : entryPrice - slPrice).toFixed(2));
      const idealFullQty = Math.floor(defaultRisk / riskPerShare);
      const maxShares = maxAffordableQty(entryPrice);
      const cappedQty = Math.min(idealFullQty, maxShares);
      const isCapped = idealFullQty > maxShares;

      const totalTradeValue = Math.round(entryPrice * cappedQty);
      const marginUsed = Math.round(totalTradeValue / intradayLeverage);
      const marginFree = Math.max(0, accountCapital - marginUsed);

      const actualRupeeRisk = Math.round(cappedQty * riskPerShare);
      const actualREffective = Number((actualRupeeRisk / defaultRisk).toFixed(2));

      return {
        entryPrice,
        slPrice,
        riskPerShare,
        idealFullQty,
        cappedQty,
        isCapped,
        totalTradeValue,
        marginUsed,
        marginFree,
        actualRupeeRisk,
        actualREffective
      };
    };

    const spring = calcSetupMetrics(roundToTick(high + reclaimGap), roundToTick(low - slGap), false);
    const b2b = calcSetupMetrics(roundToTick(high - penetration35), roundToTick(low - slGap), false);
    const origin = calcSetupMetrics(roundToTick(low + penetration35), roundToTick(high + slGap), true);
    const pivot = calcSetupMetrics(roundToTick(low + penetration35), roundToTick(high + slGap), true);

    return {
      high,
      low,
      accountCapital,
      zoneWidthPct,
      maxAllowedZone,
      isZoneTooWide,
      penetrationPct,
      origin,
      spring,
      pivot,
      b2b
    };
  }, [zoneHighInput, zoneLowInput, capitalInput, defaultRisk]);

  const activeData = useMemo(() => {
    if (!zoneMath) return null;
    if (activeSetupTab === 'origin') return { ...zoneMath.origin, label: 'Origin Retest (Short Retest)', rule: 'Low + 35% Depth' };
    if (activeSetupTab === 'spring') return { ...zoneMath.spring, label: 'Liquidity Spring (Long Reclaim)', rule: 'High + 0.05%' };
    if (activeSetupTab === 'pivot') return { ...zoneMath.pivot, label: 'Overextended Pivot (Short Retest)', rule: 'Low + 35% Depth' };
    return { ...zoneMath.b2b, label: 'Bearish To Bullish (Long Retest)', rule: 'High - 35% Depth' };
  }, [zoneMath, activeSetupTab]);

  // LIVE AUTOMATION HELPERS FOR GATEKEEPER
  const activeGatekeeperSetup = gatekeeperConfig.setups[activeSetupTab];
  const currentTickerCheckMap = tickerChecks[activeTicker] || {};

  const getItemCheckDetails = (item: GatekeeperCheckItem) => {
    const isTimeFilter = /time\s+filter|after\s+10/i.test(item.text) || item.id === 'g-1' || item.id === 'bb-1';
    const isZoneSize = /zone\s+size|0\.33/i.test(item.text) || item.id === 'g-3';

    let isAutoChecked = false;
    let autoBadgeText: string | null = null;
    let autoBadgeColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';

    if (isTimeFilter) {
      if (istTime.isAfter10AM) {
        isAutoChecked = true;
        autoBadgeText = `Auto: ${istTime.formattedIST} IST`;
      } else {
        autoBadgeText = `${istTime.formattedIST} (Wait ${istTime.minutesTo10}m)`;
        autoBadgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      }
    } else if (isZoneSize && zoneMath) {
      if (!zoneMath.isZoneTooWide) {
        isAutoChecked = true;
        autoBadgeText = `Auto: ${zoneMath.zoneWidthPct}% ≤ 0.33%`;
      } else {
        autoBadgeText = `Void: ${zoneMath.zoneWidthPct}% > 0.33%`;
        autoBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      }
    }

    const isChecked = currentTickerCheckMap[item.id] !== undefined
      ? currentTickerCheckMap[item.id]
      : isAutoChecked;

    return {
      isChecked,
      isAutoChecked,
      autoBadgeText,
      autoBadgeColor
    };
  };

  const totalRequiredChecks = gatekeeperConfig.globalConstraints.length + (activeGatekeeperSetup?.items.length || 0);
  
  const checkedCount = useMemo(() => {
    let count = 0;
    gatekeeperConfig.globalConstraints.forEach(item => {
      if (getItemCheckDetails(item).isChecked) count++;
    });
    activeGatekeeperSetup?.items.forEach(item => {
      if (getItemCheckDetails(item).isChecked) count++;
    });
    return count;
  }, [currentTickerCheckMap, gatekeeperConfig, activeGatekeeperSetup, istTime, zoneMath]);

  const isExecutionUnlocked = totalRequiredChecks > 0 && checkedCount >= totalRequiredChecks;

  const handleToggleCheck = (itemId: string, defaultAutoVal: boolean) => {
    setTickerChecks(prev => {
      const current = prev[activeTicker] || {};
      const currentVal = current[itemId] !== undefined ? current[itemId] : defaultAutoVal;
      return {
        ...prev,
        [activeTicker]: {
          ...current,
          [itemId]: !currentVal
        }
      };
    });
  };

  const handleResetChecklist = () => {
    setTickerChecks(prev => ({
      ...prev,
      [activeTicker]: {}
    }));
  };

  // EDIT MODE HANDLERS (Website only)
  const handleUpdateGlobalItem = (id: string, text: string) => {
    saveGatekeeperConfig({
      ...gatekeeperConfig,
      globalConstraints: gatekeeperConfig.globalConstraints.map(item => item.id === id ? { ...item, text } : item)
    });
  };

  const handleDeleteGlobalItem = (id: string) => {
    saveGatekeeperConfig({
      ...gatekeeperConfig,
      globalConstraints: gatekeeperConfig.globalConstraints.filter(item => item.id !== id)
    });
  };

  const handleAddGlobalItem = () => {
    const newItem: GatekeeperCheckItem = {
      id: `g-${Date.now()}`,
      text: 'New Constraint Rule'
    };
    saveGatekeeperConfig({
      ...gatekeeperConfig,
      globalConstraints: [...gatekeeperConfig.globalConstraints, newItem]
    });
  };

  const handleUpdateSetupItem = (id: string, text: string) => {
    const currentSetup = gatekeeperConfig.setups[activeSetupTab];
    saveGatekeeperConfig({
      ...gatekeeperConfig,
      setups: {
        ...gatekeeperConfig.setups,
        [activeSetupTab]: {
          ...currentSetup,
          items: currentSetup.items.map(item => item.id === id ? { ...item, text } : item)
        }
      }
    });
  };

  const handleDeleteSetupItem = (id: string) => {
    const currentSetup = gatekeeperConfig.setups[activeSetupTab];
    saveGatekeeperConfig({
      ...gatekeeperConfig,
      setups: {
        ...gatekeeperConfig.setups,
        [activeSetupTab]: {
          ...currentSetup,
          items: currentSetup.items.filter(item => item.id !== id)
        }
      }
    });
  };

  const handleAddSetupItem = () => {
    const currentSetup = gatekeeperConfig.setups[activeSetupTab];
    const newItem: GatekeeperCheckItem = {
      id: `rule-${Date.now()}`,
      text: 'New Setup Rule'
    };
    saveGatekeeperConfig({
      ...gatekeeperConfig,
      setups: {
        ...gatekeeperConfig.setups,
        [activeSetupTab]: {
          ...currentSetup,
          items: [...currentSetup.items, newItem]
        }
      }
    });
  };

  const handleUpdateTrailingRule = (text: string) => {
    const currentSetup = gatekeeperConfig.setups[activeSetupTab];
    saveGatekeeperConfig({
      ...gatekeeperConfig,
      setups: {
        ...gatekeeperConfig.setups,
        [activeSetupTab]: {
          ...currentSetup,
          trailingRule: text
        }
      }
    });
  };

  return (
    <div ref={containerRef} className={`mx-auto space-y-3 ${isWidgetMode ? 'w-full p-2.5 max-w-none' : 'max-w-4xl sm:space-y-3.5'}`}>
      {/* Main Terminal Frame */}
      <div className={`rounded-2xl bg-[#090A10] border border-white/[0.08] shadow-2xl overflow-hidden ${
        isWidgetMode ? 'p-3 space-y-2.5 border-cyan-500/30' : 'p-3.5 sm:p-5 space-y-3 sm:space-y-3.5'
      }`}>
        
        {/* HEADER: MODE SWITCH TOGGLE (HOTKEYS E & G) */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] gap-2">
          
          {/* Switch Toggle Buttons with Shortcut Indicators */}
          <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs gap-0.5 sm:gap-1 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('engine')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'engine'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
              title="Calculator Engine [Press E]"
            >
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              {!isWidgetMode && <span>Engine</span>}
              <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-black/40 text-[9px] text-zinc-500 border border-white/10 font-mono">
                E
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('gatekeeper')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'gatekeeper'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
              title="Terminal Gatekeeper Checklist [Press G]"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {!isWidgetMode && <span>Gatekeeper</span>}
              <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-black/40 text-[9px] text-zinc-500 border border-white/10 font-mono">
                G
              </kbd>
              <span className={`text-[9px] px-1 py-0.2 rounded font-black ${
                isExecutionUnlocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {checkedCount}/{totalRequiredChecks}
              </span>
            </button>
          </div>

          {/* Right Action: 1R & Dock Toggle Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs shrink-0">
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-400">
              <span className="text-zinc-500 uppercase text-[9px] font-bold">1R:</span>
              <span className="font-black text-emerald-400 text-xs">₹{defaultRisk}</span>
            </div>

            {onTogglePiP && (
              <button
                type="button"
                onClick={onTogglePiP}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                  isPiPActive
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                    : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-cyan-400 hover:text-cyan-300'
                }`}
                title={isPiPActive ? "Dock back to website" : "Pop out as Always-On-Top Floating Window"}
              >
                {isPiPActive ? <X className="w-3 h-3 shrink-0" /> : <PictureInPicture2 className="w-3 h-3 shrink-0" />}
                <span>{isPiPActive ? 'Dock' : 'Floating'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Ticker Pill Switcher (Shared between Engine and Gatekeeper) */}
        <div className="grid grid-cols-4 items-center p-1 rounded-xl bg-white/[0.02] border border-white/10 font-mono text-xs gap-1 shadow-inner w-full">
          {WATCHLIST_TICKERS.map((ticker) => {
            const isSelected = activeTicker === ticker;

            return (
              <button
                type="button"
                key={ticker}
                onClick={() => onSelectTicker(ticker)}
                className={`py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold text-center select-none border transition-colors truncate ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'text-zinc-400 hover:text-white border-transparent hover:bg-white/[0.04]'
                }`}
              >
                {ticker}
              </button>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: ENGINE CALCULATOR & COORDINATES (Press E)         */}
        {/* ========================================================= */}
        {viewMode === 'engine' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* 3 Parameter Inputs */}
            <div className={`grid gap-2 font-mono text-xs ${isWidgetMode ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
              <div>
                <label className="text-zinc-400 text-[10px] block mb-0.5 truncate">
                  <span>Zone High <strong className="text-zinc-200">({activeTicker})</strong></span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={zoneHighInput}
                  onChange={(e) => handleHighChange(e.target.value)}
                  placeholder="High"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-cyan-500/50 rounded-xl px-2.5 py-1.5 text-white font-bold outline-none text-xs placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-[10px] block mb-0.5 truncate">
                  <span>Zone Low <strong className="text-zinc-200">({activeTicker})</strong></span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={zoneLowInput}
                  onChange={(e) => handleLowChange(e.target.value)}
                  placeholder="Low"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-cyan-500/50 rounded-xl px-2.5 py-1.5 text-white font-bold outline-none text-xs placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-[10px] block mb-0.5 truncate">
                  <span>Account Cash <strong className="text-emerald-400">(5x)</strong></span>
                </label>
                <input
                  type="number"
                  step="5000"
                  value={capitalInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCapitalInput(val);
                    const parsed = parseFloat(val);
                    if (parsed && parsed > 0) onChangeTradingCapital(parsed);
                  }}
                  placeholder="70000"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-emerald-500/50 rounded-xl px-2.5 py-1.5 text-emerald-300 font-black outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                />
              </div>
            </div>

            {/* ZONE VALIDATION STATUS BAR */}
            {zoneMath ? (
              <div>
                {zoneMath.isZoneTooWide ? (
                  <div className="p-2 rounded-xl bg-rose-950/20 border border-rose-500/40 text-rose-300 font-mono text-xs flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-bold text-[11px] truncate">ZONE TOO WIDE ({zoneMath.zoneWidthPct}% &gt; 0.33%)</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase shrink-0">Skip</span>
                  </div>
                ) : (
                  <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-bold text-[11px]">ZONE VALID: {zoneMath.zoneWidthPct}%</span>
                    </div>
                    <span className="text-[9px] text-zinc-400">
                      Depth ±{zoneMath.penetrationPct}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-white/[0.015] border border-white/[0.05] text-[10px] font-mono text-zinc-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                  <span>Enter Zone High & Low for <strong className="text-zinc-300">{activeTicker}</strong>.</span>
                </span>
              </div>
            )}

            {/* 4 PLAYBOOK SETUP TABS */}
            {zoneMath && activeData && (
              <div className="space-y-2.5 pt-0.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
                  {SETUPS_LIST.map(({ key, label, icon, subtext }) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setActiveSetupTab(key)}
                      className={`p-1.5 sm:p-2 rounded-xl border text-center transition-all ${
                        activeSetupTab === key
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40 font-bold shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-[11px] font-bold leading-tight truncate">{icon} {label}</span>
                      <span className="text-[9px] text-zinc-500">{subtext}</span>
                    </button>
                  ))}
                </div>

                {/* FOCUSED SETUP COORDINATE CARD */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.015] border border-white/[0.06] space-y-2.5 font-mono">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04] text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5 text-xs truncate max-w-[70%]">
                      {activeData.label}
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      Risk/Sh: <strong className="text-white">₹{activeData.riskPerShare}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Entry Price Box */}
                    <div
                      onClick={() => handleCopy(activeData.entryPrice, 'entry')}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer group flex flex-col justify-between shadow-inner"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                          <span>Limit Entry</span>
                          {copiedPrice === 'entry' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />}
                        </div>
                        <div className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                          ₹{activeData.entryPrice}
                        </div>
                        <span className="text-[9px] text-zinc-500 block truncate">
                          {activeData.rule}
                        </span>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-white/[0.04] flex items-center justify-between">
                        <span className="text-zinc-500 text-[10px]">Size:</span>
                        <span className="text-emerald-300 font-black px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                          {activeData.cappedQty} QTY
                        </span>
                      </div>
                    </div>

                    {/* Stop Loss Price Box */}
                    <div
                      onClick={() => handleCopy(activeData.slPrice, 'sl')}
                      className="p-2.5 rounded-xl bg-rose-950/15 border border-rose-500/25 hover:border-rose-500/40 transition-all cursor-pointer group flex flex-col justify-between shadow-inner"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-rose-400 uppercase mb-0.5">
                          <span>Stop Loss (SL)</span>
                          {copiedPrice === 'sl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-rose-400" />}
                        </div>
                        <div className="text-lg sm:text-2xl font-black text-rose-400 tracking-tight truncate">
                          ₹{activeData.slPrice}
                        </div>
                        <span className="text-[9px] text-zinc-500 block truncate">
                          Buffer (0.10%)
                        </span>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-rose-500/20 text-[10px] text-zinc-400 flex items-center justify-between">
                        <span>1R</span>
                        <span className="text-rose-400 font-bold">-₹{defaultRisk}</span>
                      </div>
                    </div>
                  </div>

                  {/* CAPITAL & MARGIN STRIP */}
                  <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04] text-[10px] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <div>
                      <span className="text-zinc-500 block uppercase text-[8.5px]">Value</span>
                      <span className="text-zinc-200 font-bold truncate block">₹{activeData.totalTradeValue.toLocaleString('en-IN')}</span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block uppercase text-[8.5px]">Margin 5x</span>
                      <span className="text-cyan-300 font-bold truncate block">₹{activeData.marginUsed.toLocaleString('en-IN')}</span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block uppercase text-[8.5px]">Margin Free</span>
                      <span className="text-zinc-400 font-bold truncate block">₹{activeData.marginFree.toLocaleString('en-IN')}</span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block uppercase text-[8.5px]">Actual Risk</span>
                      <span className={`font-black truncate block ${activeData.isCapped ? 'text-amber-400' : 'text-emerald-400'}`}>
                        ₹{activeData.actualRupeeRisk} ({activeData.actualREffective}R)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: TERMINAL GATEKEEPER CHECKLIST (Press G)           */}
        {/* ========================================================= */}
        {viewMode === 'gatekeeper' && (
          <div className="space-y-3 font-mono animate-in fade-in duration-150">
            {/* Gatekeeper Bar: Setup Tabs + Edit Mode Toggle (Website Only) */}
            <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06] text-xs gap-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 w-full sm:w-auto">
                {SETUPS_LIST.map(({ key, label, icon }) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setActiveSetupTab(key)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors truncate ${
                      activeSetupTab === key
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-white'
                    }`}
                  >
                    <span>{icon} {label}</span>
                  </button>
                ))}
              </div>

              {/* Edit Mode Toggle Button — Rendered ONLY on website, hidden in floating widget/popup */}
              {!isWidgetMode && (
                <button
                  type="button"
                  onClick={() => setIsEditMode(prev => !prev)}
                  className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all shrink-0 ${
                    isEditMode
                      ? 'bg-cyan-500 text-black border-cyan-400 font-black shadow-md'
                      : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-cyan-300'
                  }`}
                  title={isEditMode ? "Done Editing Rules" : "Edit Checklist Text & Rules"}
                >
                  {isEditMode ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  <span>{isEditMode ? 'Done' : 'Edit Mode'}</span>
                </button>
              )}
            </div>

            {/* SECTION 1: GLOBAL CONSTRAINTS */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                <span>Global Constraints</span>
                {!isWidgetMode && isEditMode && (
                  <button
                    type="button"
                    onClick={handleAddGlobalItem}
                    className="text-cyan-400 hover:text-white flex items-center gap-0.5 font-bold"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Add Constraint</span>
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {gatekeeperConfig.globalConstraints.map(item => {
                  const checkDetails = getItemCheckDetails(item);

                  if (!isWidgetMode && isEditMode) {
                    return (
                      <div key={item.id} className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-lg border border-white/10">
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => handleUpdateGlobalItem(item.id, e.target.value)}
                          className="w-full bg-transparent text-xs text-zinc-200 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteGlobalItem(item.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleCheck(item.id, checkDetails.isAutoChecked)}
                      className={`p-2 rounded-xl border text-xs cursor-pointer select-none transition-all flex items-center justify-between gap-2.5 ${
                        checkDetails.isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          checkDetails.isChecked ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/20 bg-zinc-900'
                        }`}>
                          {checkDetails.isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-[11px] leading-snug truncate">{item.text}</span>
                      </div>

                      {checkDetails.autoBadgeText && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-mono font-bold shrink-0 ${checkDetails.autoBadgeColor}`}>
                          {checkDetails.autoBadgeText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: SETUP-SPECIFIC MECHANICAL RULES */}
            {activeGatekeeperSetup && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 uppercase">Setup:</span>
                    <span className="text-white font-bold">{activeGatekeeperSetup.label}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] border font-black ${activeGatekeeperSetup.tagColor}`}>
                      {activeGatekeeperSetup.tag}
                    </span>
                  </div>

                  {!isWidgetMode && isEditMode && (
                    <button
                      type="button"
                      onClick={handleAddSetupItem}
                      className="text-cyan-400 hover:text-white flex items-center gap-0.5 font-bold"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Add Setup Rule</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {activeGatekeeperSetup.items.map(item => {
                    const checkDetails = getItemCheckDetails(item);

                    if (!isWidgetMode && isEditMode) {
                      return (
                        <div key={item.id} className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-lg border border-white/10">
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => handleUpdateSetupItem(item.id, e.target.value)}
                            className="w-full bg-transparent text-xs text-zinc-200 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteSetupItem(item.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleCheck(item.id, checkDetails.isAutoChecked)}
                        className={`p-2 rounded-xl border text-xs cursor-pointer select-none transition-all flex items-center justify-between gap-2.5 ${
                          checkDetails.isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            checkDetails.isChecked ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-white/20 bg-zinc-900'
                          }`}>
                            {checkDetails.isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-[11px] leading-snug truncate">{item.text}</span>
                        </div>

                        {checkDetails.autoBadgeText && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-mono font-bold shrink-0 ${checkDetails.autoBadgeColor}`}>
                            {checkDetails.autoBadgeText}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* TRAILING DEFENSE REMINDER BOX */}
                <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30 text-[10px] space-y-1">
                  <span className="text-purple-300 font-bold uppercase tracking-wider block">
                    🛡️ Trailing Stop / Capital Defense Rule:
                  </span>
                  {!isWidgetMode && isEditMode ? (
                    <textarea
                      value={activeGatekeeperSetup.trailingRule}
                      onChange={(e) => handleUpdateTrailingRule(e.target.value)}
                      className="w-full bg-black/50 border border-purple-500/40 rounded p-1.5 text-zinc-200 outline-none h-14"
                    />
                  ) : (
                    <p className="text-purple-200/80 leading-relaxed font-bold">
                      {activeGatekeeperSetup.trailingRule}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* RESTORE DEFAULTS (IN EDIT MODE ON WEBSITE) */}
            {!isWidgetMode && isEditMode && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    saveGatekeeperConfig(DEFAULT_GATEKEEPER_CONFIG);
                  }}
                  className="text-[10px] text-zinc-500 hover:text-rose-400 underline font-mono flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Restore Playbook Defaults</span>
                </button>
              </div>
            )}

            {/* EXECUTION SAFETY GATE BUTTON */}
            {(!isEditMode || isWidgetMode) && (
              <div className="pt-1 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (isExecutionUnlocked) {
                      setViewMode('engine'); // Jump right into coordinates!
                    }
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl font-mono text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg ${
                    isExecutionUnlocked
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25 cursor-pointer ring-1 ring-emerald-300'
                      : 'bg-rose-950/40 border border-rose-500/40 text-rose-300 cursor-not-allowed'
                  }`}
                >
                  {isExecutionUnlocked ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>{activeTicker}: RULES SATISFIED — READY TO EXECUTE</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-rose-400" />
                      <span>{activeTicker}: EXECUTION LOCKED ({totalRequiredChecks - checkedCount} CHECKS REMAINING)</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Checked: <strong className="text-white">{checkedCount} / {totalRequiredChecks}</strong></span>
                  <button
                    type="button"
                    onClick={handleResetChecklist}
                    className="hover:text-zinc-300 underline"
                  >
                    Reset {activeTicker} Checklist
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-1.5 border-t border-white/[0.04] text-[9.5px] font-mono text-zinc-500 flex items-center justify-between">
          <span>Shortcuts: Press <strong>E</strong> (Engine) or <strong>G</strong> (Gatekeeper)</span>
          <span>NSE 0.05 Tick</span>
        </div>

      </div>
    </div>
  );
}