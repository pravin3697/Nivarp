'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  AlertOctagon, 
  Copy, 
  Check, 
  CheckCircle
} from 'lucide-react';

export const WATCHLIST_TICKERS = ['DLF', 'HINDALCO', 'SBIN', 'TATAMOTORS'] as const;
export type WatchlistTicker = typeof WATCHLIST_TICKERS[number];

interface EngineViewProps {
  defaultRisk: number;
  tradingCapital: number;
  watchlistData: Record<string, { high: string; low: string }>;
  activeTicker: string;
  onSelectTicker: (ticker: string) => void;
  onUpdateTickerZone: (ticker: string, high: string, low: string) => void;
  onChangeTradingCapital: (val: number) => void;
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
  onChangeTradingCapital
}: EngineViewProps) {
  const currentTickerData = watchlistData[activeTicker] || { high: '', low: '' };
  const [zoneHighInput, setZoneHighInput] = useState<string>(currentTickerData.high || '');
  const [zoneLowInput, setZoneLowInput] = useState<string>(currentTickerData.low || '');
  const [capitalInput, setCapitalInput] = useState<string>(String(tradingCapital || 70000));
  const [copiedPrice, setCopiedPrice] = useState<string | null>(null);

  // Active Setup Tab ('spring' | 'b2b' | 'origin' | 'pivot')
  const [activeSetupTab, setActiveSetupTab] = useState<'spring' | 'b2b' | 'origin' | 'pivot'>('spring');

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

    // 1. Liquidity Spring (Long Reclaim)
    const springEntry = roundToTick(high + reclaimGap);
    const springSL = roundToTick(low - slGap);
    const spring = calcSetupMetrics(springEntry, springSL, false);

    // 2. Bearish To Bullish (Long Retest 35% from Top)
    const b2bEntry = roundToTick(high - penetration35);
    const b2bSL = roundToTick(low - slGap);
    const b2b = calcSetupMetrics(b2bEntry, b2bSL, false);

    // 3. Origin Retest (Short Retest 35% from Bottom)
    const originEntry = roundToTick(low + penetration35);
    const originSL = roundToTick(high + slGap);
    const origin = calcSetupMetrics(originEntry, originSL, true);

    // 4. Overextended Pivot (Short Retest 35% from Bottom)
    const pivotEntry = roundToTick(low + penetration35);
    const pivotSL = roundToTick(high + slGap);
    const pivot = calcSetupMetrics(pivotEntry, pivotSL, true);

    return {
      high,
      low,
      accountCapital,
      zoneWidthPct,
      maxAllowedZone,
      isZoneTooWide,
      penetrationPct,
      spring,
      b2b,
      origin,
      pivot
    };
  }, [zoneHighInput, zoneLowInput, capitalInput, defaultRisk]);

  const activeData = useMemo(() => {
    if (!zoneMath) return null;
    if (activeSetupTab === 'spring') return { ...zoneMath.spring, label: 'Liquidity Spring (Long Reclaim)', rule: 'High + 0.05%' };
    if (activeSetupTab === 'b2b') return { ...zoneMath.b2b, label: 'Bearish To Bullish (Long Retest)', rule: 'High - 35% Depth' };
    if (activeSetupTab === 'origin') return { ...zoneMath.origin, label: 'Origin Retest (Short Retest)', rule: 'Low + 35% Depth' };
    return { ...zoneMath.pivot, label: 'Overextended Pivot (Short Retest)', rule: 'Low + 35% Depth' };
  }, [zoneMath, activeSetupTab]);

  return (
    <div className="max-w-4xl mx-auto space-y-3.5">
      {/* Main Terminal Frame */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3.5 shadow-2xl">
        
        {/* ROCK-SOLID STABLE HEADER: Zero horizontal shift on ticker click */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] gap-3">
          {/* Left: Terminal Title & Badge */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-2 rounded-xl bg-white/[0.03] text-cyan-400 border border-white/[0.06] shadow-inner">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-white font-mono">
                Execution Engine
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                Live Terminal
              </span>
            </div>
          </div>

          {/* Center: Zero-Layout-Shift Fixed-Width Pill Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.02] border border-white/10 font-mono text-xs gap-1 shadow-inner">
            {WATCHLIST_TICKERS.map((ticker) => {
              const isSelected = activeTicker === ticker;

              return (
                <button
                  type="button"
                  key={ticker}
                  onClick={() => onSelectTicker(ticker)}
                  className={`w-24 sm:w-28 py-1.5 rounded-lg text-xs font-mono font-bold text-center select-none border transition-colors ${
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

          {/* Right: 1R Benchmark */}
          <div className="text-right font-mono text-xs text-zinc-400 shrink-0 flex items-center gap-1.5">
            <span className="text-zinc-500 text-[10px] uppercase font-bold">1R:</span>
            <span className="font-black text-emerald-400 text-sm">₹{defaultRisk}</span>
          </div>
        </div>

        {/* 3 Parameter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div>
            <label className="text-zinc-400 text-[11px] block mb-1 flex items-center justify-between">
              <span>Zone High <span className="text-zinc-200 font-bold">(Top)</span></span>
              <span className="text-[10px] text-cyan-400 font-bold">{activeTicker}</span>
            </label>
            <input
              type="number"
              step="0.05"
              value={zoneHighInput}
              onChange={(e) => handleHighChange(e.target.value)}
              placeholder="e.g. 261.00"
              className="w-full bg-zinc-900 border border-white/10 focus:border-cyan-500/50 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
            />
          </div>

          <div>
            <label className="text-zinc-400 text-[11px] block mb-1 flex items-center justify-between">
              <span>Zone Low <span className="text-zinc-200 font-bold">(Bottom)</span></span>
              <span className="text-[10px] text-cyan-400 font-bold">{activeTicker}</span>
            </label>
            <input
              type="number"
              step="0.05"
              value={zoneLowInput}
              onChange={(e) => handleLowChange(e.target.value)}
              placeholder="e.g. 260.64"
              className="w-full bg-zinc-900 border border-white/10 focus:border-cyan-500/50 rounded-xl px-3 py-2 text-white font-bold outline-none text-xs placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
            />
          </div>

          <div>
            <label className="text-zinc-400 text-[11px] block mb-1 flex items-center justify-between">
              <span>Account Cash</span>
              <span className="text-emerald-400 font-bold">5x MIS</span>
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
              className="w-full bg-zinc-900 border border-white/10 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-emerald-300 font-black outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
            />
          </div>
        </div>

        {/* ZONE VALIDATION STATUS BAR OR EMPTY HELPER */}
        {zoneMath ? (
          <div>
            {zoneMath.isZoneTooWide ? (
              <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/40 text-rose-300 font-mono text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-bold">TRADE VOID: ZONE TOO WIDE ({zoneMath.zoneWidthPct}% &gt; 0.33%)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase">Skip Trade</span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">ZONE VALID: {zoneMath.zoneWidthPct}%</span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  35% Retest Depth = ±{zoneMath.penetrationPct}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-white/[0.015] border border-white/[0.05] text-xs font-mono text-zinc-500 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Enter Zone High and Zone Low above for <strong className="text-zinc-300">{activeTicker}</strong> to activate live execution calculations.</span>
            </span>
          </div>
        )}

        {/* 4 PLAYBOOK SETUP TABS */}
        {zoneMath && activeData && (
          <div className="space-y-3 pt-0.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveSetupTab('spring')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  activeSetupTab === 'spring'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/15'
                }`}
              >
                <span className="block text-xs font-bold">⚡ Liquidity Spring</span>
                <span className="text-[10px] text-zinc-500">Reclaim</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSetupTab('b2b')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  activeSetupTab === 'b2b'
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40 font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/15'
                }`}
              >
                <span className="block text-xs font-bold">📈 Bearish To Bullish</span>
                <span className="text-[10px] text-zinc-500">35% Retest</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSetupTab('origin')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  activeSetupTab === 'origin'
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/40 font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/15'
                }`}
              >
                <span className="block text-xs font-bold">🔄 Origin Retest</span>
                <span className="text-[10px] text-zinc-500">35% Short</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSetupTab('pivot')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  activeSetupTab === 'pivot'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 font-bold shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/15'
                }`}
              >
                <span className="block text-xs font-bold">🎯 Overextended Pivot</span>
                <span className="text-[10px] text-zinc-500">35% Short</span>
              </button>
            </div>

            {/* FOCUSED SETUP COORDINATE CARD */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.015] border border-white/[0.06] space-y-3 font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.04] text-xs">
                <span className="font-bold text-white flex items-center gap-1.5 text-xs sm:text-sm">
                  {activeData.label}
                </span>
                <span className="text-xs text-zinc-400">
                  Risk/Share: <strong className="text-white">₹{activeData.riskPerShare}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Entry Price Box */}
                <div
                  onClick={() => handleCopy(activeData.entryPrice, 'entry')}
                  className="p-3.5 rounded-xl bg-black/40 border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer group flex flex-col justify-between shadow-inner"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 uppercase mb-1">
                      <span>Limit Entry Price</span>
                      {copiedPrice === 'entry' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      ₹{activeData.entryPrice}
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      {activeData.rule}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-zinc-500 text-[11px]">Position Size:</span>
                    <span className="text-emerald-300 font-black px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      {activeData.cappedQty} QTY
                    </span>
                  </div>
                </div>

                {/* Stop Loss Price Box */}
                <div
                  onClick={() => handleCopy(activeData.slPrice, 'sl')}
                  className="p-3.5 rounded-xl bg-rose-950/15 border border-rose-500/25 hover:border-rose-500/40 transition-all cursor-pointer group flex flex-col justify-between shadow-inner"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-rose-400 uppercase mb-1">
                      <span>Stop Loss (SL)</span>
                      {copiedPrice === 'sl' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">
                      ₹{activeData.slPrice}
                    </div>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Invalidation Buffer (0.10%)
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-rose-500/20 text-[11px] text-zinc-400 flex items-center justify-between">
                    <span>1R Benchmark</span>
                    <span className="text-rose-400 font-bold">-₹{defaultRisk}</span>
                  </div>
                </div>
              </div>

              {/* DETAILED CAPITAL, MARGIN & REALIZED RISK STRIP */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.04] text-xs grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Trade Value</span>
                  <span className="text-zinc-200 font-bold text-xs">₹{activeData.totalTradeValue.toLocaleString('en-IN')}</span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Margin Used (5x)</span>
                  <span className="text-cyan-300 font-bold text-xs">₹{activeData.marginUsed.toLocaleString('en-IN')}</span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Margin Left</span>
                  <span className="text-zinc-400 font-bold text-xs">₹{activeData.marginFree.toLocaleString('en-IN')}</span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Actual Risk Taken</span>
                  <span className={`font-black text-xs ${activeData.isCapped ? 'text-amber-400' : 'text-emerald-400'}`}>
                    ₹{activeData.actualRupeeRisk} ({activeData.actualREffective}R)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-white/[0.04] text-[11px] font-mono text-zinc-500 flex items-center justify-between">
          <span>Click any coordinate box to copy price • 5x MIS Margin Protection</span>
          <span>Standard NSE 0.05 Tick</span>
        </div>

      </div>
    </div>
  );
}