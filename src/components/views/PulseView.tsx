'use client';

import React, { useMemo } from 'react';
import { Trade } from '@/types/trade';
import { parseDateToTimestamp } from '@/lib/parser';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Activity, Target, Layers, ShieldAlert, Maximize2, Pencil } from 'lucide-react';

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
  stats,
  growthCurve,
  onOpenInspector,
  onOpenDebrief,
}: PulseViewProps) {
  const sortedRecentTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const timeA = parseDateToTimestamp(a.tradeDate);
      const timeB = parseDateToTimestamp(b.tradeDate);
      return timeB - timeA;
    });
  }, [trades]);

  // Advanced execution statistics
  const advancedStats = useMemo(() => {
    const wins = trades.filter(t => t.rMultiple > 0);
    const losses = trades.filter(t => t.rMultiple < 0);

    const avgWin = wins.length 
      ? Number((wins.reduce((acc, t) => acc + t.rMultiple, 0) / wins.length).toFixed(2)) 
      : 0;

    const avgLoss = losses.length 
      ? Number((losses.reduce((acc, t) => acc + t.rMultiple, 0) / losses.length).toFixed(2)) 
      : 0;

    const expectancy = trades.length 
      ? Number((trades.reduce((acc, t) => acc + t.rMultiple, 0) / trades.length).toFixed(2)) 
      : 0;

    return { avgWin, avgLoss, expectancy };
  }, [trades]);

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
      {/* KPI Cards Row (Enhanced with Avg Win, Avg Loss, and Expectancy) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Harvested & Expectancy */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>Net Edge</span>
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 truncate">
            {formatR(stats.netR)}
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>PF: <strong className="text-white">{stats.profitFactor}</strong></span>
            <span>Exp: <strong className="text-cyan-400">{formatR(advancedStats.expectancy)}/T</strong></span>
          </div>
        </div>

        {/* Strike Accuracy & Risk/Reward */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>Win Rate</span>
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">{stats.winRate}%</div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>Win: <strong className="text-emerald-400">+{advancedStats.avgWin}R</strong></span>
            <span>Loss: <strong className="text-rose-400">{advancedStats.avgLoss}R</strong></span>
          </div>
        </div>

        {/* Directional Bias */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>Directional Bias</span>
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-zinc-200">
            {stats.longs}L <span className="text-zinc-600">/</span> {stats.shorts}S
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400">
            Total Trades: <strong className="text-white">{stats.total}</strong>
          </div>
        </div>

        {/* Drawdown & ATH Peak */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs font-mono uppercase mb-1 sm:mb-2">
            <span>Drawdown & Peak</span>
            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
            -{stats.maxDD.toFixed(2)}R
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.04] text-[10px] sm:text-[11px] font-mono text-zinc-400 flex items-center justify-between">
            <span>ATH Peak: <strong className="text-emerald-400">+{stats.athR.toFixed(2)}R</strong></span>
          </div>
        </div>
      </div>

      {/* Trajectory Growth Curve */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs uppercase text-zinc-400 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Cumulative R Growth Trajectory</span>
          </h3>
          <span className="text-xs font-mono text-emerald-400 font-bold">{formatR(stats.netR)}</span>
        </div>
        <div className="h-56 sm:h-72 w-full">
          {trades.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-xs font-mono text-zinc-600 border border-dashed border-white/[0.05] rounded-xl p-4 text-center">
              No trades logged. Tap "Import" to populate curve.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthCurve}>
                <defs>
                  <linearGradient id="curveLaser" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F5A0" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#00F5A0" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="point" stroke="#27272A" fontSize={10} tickLine={false} />
                <YAxis stroke="#27272A" fontSize={10} tickLine={false} unit="R" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0C0D14', borderColor: '#27272A', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }} 
                  formatter={(val: any) => [`${Number(val).toFixed(2)}R`, 'Cumulative Return']}
                />
                <Area type="monotone" dataKey="r" stroke="#00F5A0" strokeWidth={2.5} fill="url(#curveLaser)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Trade Entries */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="font-mono text-xs uppercase text-zinc-400">Recent Trades (Newest First)</h3>
          <span className="text-[11px] font-mono text-zinc-500">{sortedRecentTrades.length} Total</span>
        </div>

        {sortedRecentTrades.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-zinc-600">
            No trades logged yet. Import Kotak Neo CSV to view execution history.
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