'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { idbGet, idbSet } from '@/lib/storage';
import { 
  Calculator, 
  AlertOctagon, 
  Copy, 
  Check, 
  CheckCircle,
  PictureInPicture2,
  Target,
  X
} from 'lucide-react';

export const WATCHLIST_TICKERS = ['DLF', 'HINDALCO', 'SBIN', 'TATAMOTORS'] as const;
export type WatchlistTicker = typeof WATCHLIST_TICKERS[number];

const TICKER_SETUPS_KEY = 'NIVARP_TICKER_SETUPS_MAP';
const FOCUSED_TICKERS_KEY = 'NIVARP_ENGINE_FOCUSED_TICKERS';

type SetupKey = 'origin' | 'spring' | 'pivot' | 'b2b';

const SETUPS_LIST: { key: SetupKey; label: string; icon: string; subtext: string }[] = [
  { key: 'origin', label: 'Origin Retest', icon: '🔄', subtext: '35% Short' },
  { key: 'spring', label: 'Liquidity Spring', icon: '⚡', subtext: 'Reclaim' },
  { key: 'pivot', label: 'Overextended Pivot', icon: '🎯', subtext: '35% Short' },
  { key: 'b2b', label: 'Bearish To Bullish', icon: '📈', subtext: '35% Retest' }
];

const R_MULTIPLES = [3, 4, 5, 6, 7] as const;

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
  const focusMenuRef = useRef<HTMLDivElement>(null);
  const targetMenuRef = useRef<HTMLDivElement>(null);
  const targetBtnRef = useRef<HTMLButtonElement>(null);

  // LIVE FOCUS STATE
  const [focusedTickers, setFocusedTickers] = useState<string[]>([...WATCHLIST_TICKERS]);
  const [isFocusSelectorOpen, setIsFocusSelectorOpen] = useState(false);

  // Centered Targets Popover State
  const [isTargetMenuOpen, setIsTargetMenuOpen] = useState(false);

  useEffect(() => {
    idbGet<string[]>(FOCUSED_TICKERS_KEY).then(saved => {
      if (Array.isArray(saved) && saved.length > 0) {
        setFocusedTickers(saved);
        if (!saved.includes(activeTicker) && saved.length > 0) {
          onSelectTicker(saved[0]);
        }
      }
    });
  }, []);

  // Close menus on click outside
  useEffect(() => {
    if (!isFocusSelectorOpen && !isTargetMenuOpen) return;

    const activeDoc = containerRef.current?.ownerDocument || document;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (isFocusSelectorOpen && focusMenuRef.current && !focusMenuRef.current.contains(target)) {
        setIsFocusSelectorOpen(false);
      }
      if (
        isTargetMenuOpen && 
        targetMenuRef.current && 
        !targetMenuRef.current.contains(target) &&
        targetBtnRef.current &&
        !targetBtnRef.current.contains(target)
      ) {
        setIsTargetMenuOpen(false);
      }
    };

    activeDoc.addEventListener('mousedown', handleClickOutside);
    activeDoc.addEventListener('touchstart', handleClickOutside);

    if (activeDoc !== document) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      activeDoc.removeEventListener('mousedown', handleClickOutside);
      activeDoc.removeEventListener('touchstart', handleClickOutside);
      if (activeDoc !== document) {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      }
    };
  }, [isFocusSelectorOpen, isTargetMenuOpen]);

  const handleToggleTickerFocus = (ticker: string) => {
    let next: string[];
    if (focusedTickers.includes(ticker)) {
      if (focusedTickers.length <= 1) return;
      next = focusedTickers.filter(t => t !== ticker);
    } else {
      next = [...focusedTickers, ticker];
    }

    setFocusedTickers(next);
    idbSet(FOCUSED_TICKERS_KEY, next);

    if (!next.includes(activeTicker) && next.length > 0) {
      onSelectTicker(next[0]);
    }
  };

  const handleResetAllFocus = () => {
    const all = [...WATCHLIST_TICKERS];
    setFocusedTickers(all);
    idbSet(FOCUSED_TICKERS_KEY, all);
  };

  const visibleTickers = useMemo(() => {
    return WATCHLIST_TICKERS.filter(t => focusedTickers.includes(t));
  }, [focusedTickers]);

  // INDEPENDENT SETUP MEMORY PER TICKER
  const [tickerSetupMap, setTickerSetupMap] = useState<Record<string, SetupKey>>({
    DLF: 'origin',
    HINDALCO: 'spring',
    SBIN: 'origin',
    TATAMOTORS: 'origin'
  });

  const activeSetupTab: SetupKey = tickerSetupMap[activeTicker] || 'origin';

  const handleSelectSetupForCurrentTicker = (setupKey: SetupKey) => {
    const updated = { ...tickerSetupMap, [activeTicker]: setupKey };
    setTickerSetupMap(updated);
    idbSet(TICKER_SETUPS_KEY, updated);
  };

  useEffect(() => {
    idbGet<Record<string, SetupKey>>(TICKER_SETUPS_KEY).then(saved => {
      if (saved && typeof saved === 'object') {
        setTickerSetupMap(prev => ({ ...prev, ...saved }));
      }
    });
  }, []);

  const currentTickerData = watchlistData[activeTicker] || { high: '', low: '' };
  const [zoneHighInput, setZoneHighInput] = useState<string>(currentTickerData.high || '');
  const [zoneLowInput, setZoneLowInput] = useState<string>(currentTickerData.low || '');
  const [capitalInput, setCapitalInput] = useState<string>(String(tradingCapital || 70000));
  const [copiedPrice, setCopiedPrice] = useState<string | null>(null);

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

  const handleHighChange = (val: string) => {
    setZoneHighInput(val);
    onUpdateTickerZone(activeTicker, val, zoneLowInput);
  };

  const handleLowChange = (val: string) => {
    setZoneLowInput(val);
    onUpdateTickerZone(activeTicker, zoneHighInput, val);
  };

  // ROBUST CLIPBOARD COPY
  const handleCopy = async (text: string | number, label: string) => {
    const str = String(text);
    const activeDoc = containerRef.current?.ownerDocument || document;
    const activeWin = activeDoc.defaultView || window;

    let copied = false;

    if ((activeWin as any).navigator?.clipboard?.writeText) {
      try {
        await (activeWin as any).navigator.clipboard.writeText(str);
        copied = true;
      } catch {}
    }

    if (!copied && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(str);
        copied = true;
      } catch {}
    }

    if (!copied) {
      try {
        const el = activeDoc.createElement('textarea');
        el.value = str;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '0';
        el.style.top = '0';
        el.style.opacity = '0';
        el.style.width = '2em';
        el.style.height = '2em';
        el.style.padding = '0';
        el.style.border = 'none';
        el.style.outline = 'none';
        el.style.boxShadow = 'none';
        el.style.background = 'transparent';
        
        activeDoc.body.appendChild(el);
        el.focus();
        el.select();
        el.setSelectionRange(0, el.value.length);
        
        copied = activeDoc.execCommand('copy');
        activeDoc.body.removeChild(el);
      } catch (err) {
        console.warn('execCommand copy fallback error:', err);
      }
    }

    setCopiedPrice(label);
    setTimeout(() => setCopiedPrice(null), 1500);
  };

  // Mainzone Math
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
    const maxAllowedZone = Number((high * 0.0033).toFixed(2));
    const zoneWidthPct = Number(((zoneWidth / high) * 100).toFixed(3));
    const isZoneTooWide = zoneWidth > maxAllowedZone;

    const reclaimGap = high * 0.0005;
    const slGap = high * 0.001;
    const penetration35 = zoneWidth * 0.35;
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
        actualREffective,
        isShort
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

  // Compute 3R, 4R, 5R, 6R, 7R Target Levels
  const targetLevels = useMemo(() => {
    if (!activeData || activeData.entryPrice <= 0 || activeData.riskPerShare <= 0) return [];
    
    return R_MULTIPLES.map(r => {
      const price = activeData.isShort
        ? roundToTick(activeData.entryPrice - r * activeData.riskPerShare)
        : roundToTick(activeData.entryPrice + r * activeData.riskPerShare);
      
      return { r, price };
    });
  }, [activeData]);

  const tickerGridColsClass = 
    visibleTickers.length === 1 ? 'grid-cols-1' :
    visibleTickers.length === 2 ? 'grid-cols-2' :
    visibleTickers.length === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div ref={containerRef} className={`mx-auto space-y-3 ${isWidgetMode ? 'w-full p-2.5 max-w-none' : 'max-w-4xl sm:space-y-3.5'}`}>
      <div className={`rounded-2xl bg-[#090A10] border border-white/[0.08] shadow-2xl overflow-hidden ${
        isWidgetMode ? 'p-3 space-y-2.5 border-cyan-500/30' : 'p-3.5 sm:p-5 space-y-3 sm:space-y-3.5'
      }`}>
        
        {/* CLEAN SINGLE HEADER */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-white/[0.03] text-cyan-400 border border-white/[0.06] shadow-inner shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <h2 className="font-bold text-xs sm:text-sm text-white font-mono whitespace-nowrap truncate">
                Execution Engine
              </h2>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold shrink-0">
                Live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 font-mono text-xs shrink-0">
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-400">
              <span className="text-zinc-500 uppercase text-[9px] font-bold">1R:</span>
              <span className="font-black text-emerald-400 text-xs">₹{defaultRisk}</span>
            </div>

            {onTogglePiP && (
              <button
                type="button"
                onClick={onTogglePiP}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                  isPiPActive
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                    : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-zinc-200'
                }`}
                title={isPiPActive ? "Dock back to website" : "Pop out as Always-On-Top Floating Window"}
              >
                {isPiPActive ? <X className="w-3 h-3 shrink-0" /> : <PictureInPicture2 className="w-3 h-3 shrink-0" />}
                <span>{isPiPActive ? 'Dock' : 'Floating'}</span>
              </button>
            )}
          </div>
        </div>

        {/* TICKER SELECTOR BAR WITH LIVE FOCUS SELECTOR */}
        <div className="flex items-center gap-1.5">
          <div className={`grid ${tickerGridColsClass} items-center p-1 rounded-xl bg-white/[0.02] border border-white/10 font-mono text-xs gap-1 shadow-inner flex-1`}>
            {visibleTickers.map((ticker) => {
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

          {/* FOCUS FILTER TOGGLE */}
          <div className="relative shrink-0" ref={focusMenuRef}>
            <button
              type="button"
              onClick={() => setIsFocusSelectorOpen(prev => !prev)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                focusedTickers.length < WATCHLIST_TICKERS.length
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/10 text-zinc-400 hover:text-white'
              }`}
              title="Focus 1 or 2 specific tickers for today's session"
            >
              <Target className={`w-3.5 h-3.5 ${focusedTickers.length < WATCHLIST_TICKERS.length ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline">
                {focusedTickers.length < WATCHLIST_TICKERS.length ? `Focus (${focusedTickers.length}/4)` : 'Focus'}
              </span>
              <span className="sm:hidden text-[10px] font-bold">
                {focusedTickers.length < WATCHLIST_TICKERS.length ? focusedTickers.length : ''}
              </span>
            </button>

            {isFocusSelectorOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-[#0B0D14]/98 border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-2.5 font-mono text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                    <Target className="w-3 h-3 text-cyan-400" />
                    <span>Watchlist Focus</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetAllFocus}
                    className="text-[10px] text-cyan-400 hover:text-white underline"
                  >
                    All (4)
                  </button>
                </div>

                <div className="space-y-1">
                  {WATCHLIST_TICKERS.map(ticker => {
                    const isFocused = focusedTickers.includes(ticker);
                    return (
                      <button
                        key={ticker}
                        type="button"
                        onClick={() => handleToggleTickerFocus(ticker)}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-all ${
                          isFocused
                            ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 font-bold'
                            : 'bg-white/[0.02] text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                      >
                        <span>{ticker}</span>
                        {isFocused ? (
                          <Check className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <span className="text-[9px] text-zinc-600">Hidden</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[9px] text-zinc-500 pt-1 border-t border-white/[0.04] leading-normal">
                  Focus only 1 or 2 active charts to eliminate distractions during live execution.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3 PARAMETER INPUTS */}
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

        {/* 4 PLAYBOOK SETUP TABS (INDEPENDENT PER TICKER) */}
        {zoneMath && activeData && (
          <div className="space-y-2.5 pt-0.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
              {SETUPS_LIST.map(({ key, label, icon, subtext }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleSelectSetupForCurrentTicker(key)}
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

            {/* FOCUSED SETUP COORDINATE CARD (RELATIVE POSITIONED FOR CENTERED OVERLAY) */}
            <div className="relative p-2.5 sm:p-3 rounded-xl bg-white/[0.015] border border-white/[0.06] space-y-2.5 font-mono">
              
              {/* CARD HEADER */}
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04] text-xs">
                <span className="font-bold text-white flex items-center gap-1.5 text-xs truncate max-w-[55%]">
                  {activeData.label}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {/* ZERO-HEIGHT TARGETS POPOVER BUTTON */}
                  {targetLevels.length > 0 && (
                    <button
                      ref={targetBtnRef}
                      type="button"
                      onClick={() => setIsTargetMenuOpen(prev => !prev)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                        isTargetMenuOpen
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                      title="View 3R to 7R targets (Click to copy)"
                    >
                      <Target className="w-3 h-3" />
                      <span>Targets</span>
                    </button>
                  )}

                  <span className="text-[10px] text-zinc-400">
                    Risk/Sh: <strong className="text-white">₹{activeData.riskPerShare}</strong>
                  </span>
                </div>
              </div>

              {/* PERFECTLY CENTERED FLOATING TARGETS OVERLAY (ACROSS THE MIDDLE OF THE CARD) */}
              {isTargetMenuOpen && (
                <div
                  ref={targetMenuRef}
                  className="absolute left-2 right-2 top-8 z-50 bg-[#0B0D14]/98 border border-emerald-500/50 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                      <Target className="w-3 h-3 text-emerald-400" />
                      <span>R-Multiple Targets (3R — 7R)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-500">Click to copy</span>
                      <button
                        type="button"
                        onClick={() => setIsTargetMenuOpen(false)}
                        className="text-zinc-500 hover:text-white p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {targetLevels.map(({ r, price }) => {
                      const label = `r${r}`;
                      const isCopied = copiedPrice === label;
                      return (
                        <div
                          key={r}
                          onClick={() => handleCopy(price, label)}
                          className="p-1.5 rounded-xl bg-black/60 border border-white/10 hover:border-emerald-400 hover:bg-emerald-500/10 cursor-pointer transition-all"
                          title={`Copy ${r}R target price (₹${price})`}
                        >
                          <span className="text-[8.5px] font-bold text-zinc-400 block">{r}R</span>
                          <span className="text-[11px] font-black text-emerald-300 block truncate">
                            {isCopied ? '✓' : `₹${price}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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

        <div className="pt-1.5 border-t border-white/[0.04] text-[9.5px] font-mono text-zinc-500 flex items-center justify-between">
          <span>Click box to copy • 5x MIS Margin</span>
          <span>NSE 0.05 Tick</span>
        </div>

      </div>
    </div>
  );
}