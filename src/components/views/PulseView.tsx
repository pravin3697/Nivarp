'use client';

import React, { useMemo, useState } from 'react';
import { Trade } from '@/types/trade';
import { parseDateToTimestamp } from '@/lib/parser';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Activity, Target, Layers, ShieldAlert, Maximize2, Pencil, ShieldCheck, Filter } from 'lucide-react';

interface PulseViewProps {
  trades: Trade[];
  stats: any;
  growthCurve: any[];
  defaultRisk: number;
  onOpenInspector: (url: string, title: string, htfUrl?: string, ltfUrl?: string) => void;
  onOpenDebrief: (trade: Trade) => void;
  onOpenCsvModal: () => void;
}

export function PulseView({
  trades,
  stats: globalStats,
  growthCurve: globalGrowthCurve,
  onOpenInspector,
  onOpenDebrief,
}: PulseViewProps) {
  // Mode: 'rules-only' (System Edge) vs 'all' (Realized Portfolio)
  const [filterMode, setFilterMode] = useState<'rules-only' | 'all'>('rules-only');

  // Filtered trades based on selection
  const activeTrades = useMemo(() => {
    if (filterMode === 'rules-only') {
      return trades.filter(t => t.behaviorTag === 'Rules Followed' || (!t.behaviorTag && t.rMultiple > 0));
    }
    return trades;
  }, [trades, filterMode]);

  // Recalculated Pristine vs Realized Statistics
  const dynamicStats = useMemo(() => {
    const list = activeTrades;
    const total = list.length;
    if (!total) {
      return { 
        total: 0, 
        netR: 0, 
        winRate: 0, 
        longs: 0, 
        shorts: 0, 
        maxDD: 0, 
        athR: 0, 
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        expectancy: 0
      };
    }

    const wins = list.filter(t => t.rMultiple > 0);
    const losses = list.filter(t => t.rMultiple < 0);
    const netR = Number(list.reduce((acc, t) => acc + t.rMultiple, 0).toFixed(2));
    const winRate = Math.round((wins.length / total) * 100);
    const longs = list.filter(t => t.direction === 'LONG').length;
    const shorts = list.filter(t => t.direction === 'SHORT').length;

    let runR = 0, peak = 0, maxDD = 0;
    list.forEach(t => {
      runR += t.rMultiple;
      if (runR > peak) peak = runR;
      const dd = peak - runR;
      if (dd > maxDD) maxDD = dd;
    });

    const sumWins = wins.reduce((acc, t) => acc + t.rMultiple, 0);
    const sumLosses = Math.abs(losses.reduce((acc, t) => acc + t.rMultiple, 0));
    const profitFactor = sumLosses > 0 ? Number((sumWins / sumLosses).toFixed(2)) : sumWins > 0 ? 99 : 0;

    const avgWin = wins.length ? Number((sumWins / wins.length).toFixed(2)) : 0;
    const avgLoss = losses.length ? Number((sumLosses / losses.length).toFixed(2)) : 0;
    const expectancy = Number((netR / total).toFixed(2));

    return {
      total,
      netR,
      winRate,
      longs,
      shorts,
      maxDD: Number(maxDD.toFixed(2)),
      athR: Number(peak.toFixed(2)),
      profitFactor,
      avgWin,
      avgLoss,
      expectancy
    };
  }, [activeTrades]);

  // Dynamic Growth Trajectory Curve
  const dynamicGrowthCurve = useMemo(() => {
    const chronological = [...activeTrades].sort((a, b) => parseDateToTimestamp(a.tradeDate) - parseDateToTimestamp(b.tradeDate));
    let cumR = 0;
    return chronological.map((t, idx) => {
      cumR += t.rMultiple;
      return { point: `#${idx + 1}`, r: Number(cumR.toFixed(2)) };
    });
  }, [activeTrades]);

  // Sort trades: strictly newest on top
  const sortedRecentTrades = useMemo(() => {
    return [...activeTrades].sort((a, b) => {
      const timeA = parseDateToTimestamp(a.tradeDate);
      const timeB = parseDateToTimestamp(b.tradeDate);
      return timeB - timeA;
    });
  }, [activeTrades]);

  const formatR = (rVal: number) => {
    return `${rVal >= 0 ? '+' : ''}${rVal.toFixed(2)}R`;
  };

  const getBehaviorBadge = (tag?: string) => {
    if (!tag) return null;
    if (tag === 'Rules Followed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (tag === 'No Confirmation Entry') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (tag === 'SL Hunt / Slippage Hunt') return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Filter Bar: System Edge vs Realized Portfolio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#090A10] border border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-bold">Execution Filter:</span>
          <span className="text-xs font-mono text-zinc-500">
            {filterMode === 'rules-only' ? 'Showing Pristine Mechanical System Edge' : 'Showing All Realized Executions'}
          </span>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono w-full sm:w-auto">
          <button
            onClick={() => setFilterMode('rules-only')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterMode === 'rules-only'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Rules-Based Only</span>
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Trades ({trades.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Dynamically calculated based on Filter Mode) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Edge & Expectancy */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>{filterMode === 'rules-only' ? 'System Net Edge' : 'Realized Edge'}</span>
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <div className={`text-2xl sm:text-3xl font-black font-mono truncate ${dynamicStats.netR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatR(dynamicStats.netR)}
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>PF: <strong className="text-white">{dynamicStats.profitFactor}</strong></span>
            <span>Exp: <strong className="text-cyan-400">{formatR(dynamicStats.expectancy || 0)}/T</strong></span>
          </div>
        </div>

        {/* Strike Accuracy & Risk/Reward */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>{filterMode === 'rules-only' ? 'System Win Rate' : 'Total Win Rate'}</span>
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">{dynamicStats.winRate}%</div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>Win: <strong className="text-emerald-400">+{dynamicStats.avgWin}R</strong></span>
            <span>Loss: <strong className="text-rose-400">-{dynamicStats.avgLoss}R</strong></span>
          </div>
        </div>

        {/* Directional Bias */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>Directional Bias</span>
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-zinc-200">
            {dynamicStats.longs}L <span className="text-zinc-600">/</span> {dynamicStats.shorts}S
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400">
            Trades Count: <strong className="text-white">{dynamicStats.total}</strong>
          </div>
        </div>

        {/* Drawdown & ATH Peak */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>Drawdown & Peak</span>
            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
            -{dynamicStats.maxDD.toFixed(2)}R
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>Peak: <strong className="text-emerald-400">+{dynamicStats.athR.toFixed(2)}R</strong></span>
          </div>
        </div>
      </div>

      {/* Trajectory Growth Curve */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs uppercase text-zinc-400 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${filterMode === 'rules-only' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
            <span>
              {filterMode === 'rules-only' ? 'System Edge Trajectory (Pristine Rules Only)' : 'Realized Trajectory (All Trades)'}
            </span>
          </h3>
          <span className={`text-xs font-mono font-bold ${dynamicStats.netR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatR(dynamicStats.netR)}
          </span>
        </div>
        <div className="h-56 sm:h-72 w-full">
          {activeTrades.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-xs font-mono text-zinc-600 border border-dashed border-white/[0.05] rounded-xl p-4 text-center">
              No trades matching this filter.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicGrowthCurve}>
                <defs>
                  <linearGradient id="curveLaser" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={filterMode === 'rules-only' ? '#00F5A0' : '#22d3ee'} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={filterMode === 'rules-only' ? '#00F5A0' : '#22d3ee'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="point" stroke="#27272A" fontSize={10} tickLine={false} />
                <YAxis stroke="#27272A" fontSize={10} tickLine={false} unit="R" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0C0D14', borderColor: '#27272A', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }} 
                  formatter={(val: any) => [`${Number(val).toFixed(2)}R`, 'Cumulative Return']}
                />
                <Area 
                  type="monotone" 
                  dataKey="r" 
                  stroke={filterMode === 'rules-only' ? '#00F5A0' : '#22d3ee'} 
                  strokeWidth={2.5} 
                  fill="url(#curveLaser)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Trade Entries */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="font-mono text-xs uppercase text-zinc-400">
            {filterMode === 'rules-only' ? 'Rules-Based Executions' : 'All Trade Executions'} (Newest First)
          </h3>
          <span className="text-[11px] font-mono text-zinc-500">{sortedRecentTrades.length} Trades</span>
        </div>

        {sortedRecentTrades.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-zinc-600">
            No trades found for this filter.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {sortedRecentTrades.map(t => {
              const isGreen = t.rMultiple >= 0;
              const behaviorClass = getBehaviorBadge(t.behaviorTag);

              return (
                <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/[0.01] px-1 sm:px-2 rounded-xl transition-all gap-2">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 mt-0.5 sm:mt-0 ${
                      t.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {t.direction}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{t.symbol}</span>
                        <span className="text-[11px] text-zinc-500 font-mono">({t.tradeDate})</span>
                        {t.behaviorTag && (
                          <span className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-bold ${behaviorClass}`}>
                            {t.behaviorTag}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-cyan-400 font-semibold">{t.setupType}</span>
                        <span>•</span>
                        <span>₹{t.entryPrice} → ₹{t.exitPrice}</span>
                        {t.slPrice && <span className="text-rose-400/80 font-mono">• SL: ₹{t.slPrice}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-10 sm:pl-0">
                    <div className="flex items-center gap-1.5">
                      {t.image1 && (
                        <button 
                          onClick={() => onOpenInspector(t.image1!, `${t.symbol} Context`, t.image1, t.image2)} 
                          className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-[10px] font-mono text-cyan-400 hover:text-white flex items-center gap-1"
                        >
                          <span>HTF</span><Maximize2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {t.image2 && (
                        <button 
                          onClick={() => onOpenInspector(t.image2!, `${t.symbol} Execution`, t.image1, t.image2)} 
                          className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-[10px] font-mono text-emerald-400 hover:text-white flex items-center gap-1"
                        >
                          <span>LTF</span><Maximize2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className={`font-mono text-sm sm:text-base font-bold text-right ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatR(t.rMultiple)}
                    </div>

                    <button
                      onClick={() => onOpenDebrief(t)}
                      className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition-all border border-white/10"
                    >
                      <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}