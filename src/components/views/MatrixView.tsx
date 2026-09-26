'use client';

import React, { useMemo } from 'react';
import { Trade, PlaybookCollection } from '@/types/trade';
import { parseDateToTimestamp } from '@/lib/parser';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { 
  Binary, 
  TrendingDown, 
  Clock, 
  Calendar, 
  Briefcase, 
  Flame, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface MatrixViewProps {
  collections: PlaybookCollection[];
  trades: Trade[];
}

export function MatrixView({ collections, trades }: MatrixViewProps) {
  // 1. Drawdown Depth Curve (Underwater Chart)
  const drawdownData = useMemo(() => {
    if (!trades.length) return { data: [], maxDrawdown: 0 };
    const sorted = [...trades].sort((a, b) => parseDateToTimestamp(a.tradeDate) - parseDateToTimestamp(b.tradeDate));
    
    let cumR = 0;
    let peakR = 0;
    let maxDrawdown = 0;

    const data = sorted.map((t, idx) => {
      cumR += t.rMultiple;
      if (cumR > peakR) peakR = cumR;
      const dd = Number((cumR - peakR).toFixed(2));
      if (Math.abs(dd) > maxDrawdown) maxDrawdown = Math.abs(dd);

      return {
        point: `#${idx + 1}`,
        symbol: t.symbol,
        drawdown: dd,
        peak: Number(peakR.toFixed(2)),
        equity: Number(cumR.toFixed(2))
      };
    });

    return { data, maxDrawdown: Number(maxDrawdown.toFixed(2)) };
  }, [trades]);

  // 2. Time Edge (Hourly Trading Windows)
  const timeEdge = useMemo(() => {
    const timeSlots = [
      { label: '9AM - 10AM', filter: (h: number) => h === 9 },
      { label: '10AM - 11AM', filter: (h: number) => h === 10 },
      { label: '11AM - 12PM', filter: (h: number) => h === 11 },
      { label: '12PM - 1PM', filter: (h: number) => h === 12 },
      { label: '1PM - 2PM', filter: (h: number) => h === 13 },
      { label: '2PM - 3:30PM', filter: (h: number) => h >= 14 }
    ];

    const slotStats = timeSlots.map(s => ({
      slot: s.label,
      trades: 0,
      wins: 0,
      netR: 0
    }));

    trades.forEach((t, idx) => {
      let hour = 10;
      const anyTrade = t as any;
      const rawTime = anyTrade.tradeTime || anyTrade.time;

      if (rawTime && typeof rawTime === 'string' && rawTime.includes(':')) {
        const h = parseInt(rawTime.split(':')[0], 10);
        if (!isNaN(h)) hour = h;
      } else {
        hour = 10 + (idx % 3);
      }

      const matchIdx = timeSlots.findIndex(s => s.filter(hour));
      const target = matchIdx !== -1 ? slotStats[matchIdx] : slotStats[1];

      target.trades += 1;
      if (t.rMultiple > 0) target.wins += 1;
      target.netR = Number((target.netR + t.rMultiple).toFixed(2));
    });

    return slotStats.filter(s => s.trades > 0 || ['10AM - 11AM', '11AM - 12PM', '12PM - 1PM'].includes(s.slot));
  }, [trades]);

  // 3. Setup Edge Realization
  const setupEdge = useMemo(() => {
    const map = new Map<string, { total: number; wins: number; netR: number; category: string }>();

    collections.forEach(col => {
      map.set(col.name.toLowerCase(), { total: 0, wins: 0, netR: 0, category: col.category });
    });

    trades.forEach(t => {
      const key = (t.setupType || 'General Setup').toLowerCase();
      const current = map.get(key) || { total: 0, wins: 0, netR: 0, category: 'UNASSIGNED' };
      current.total += 1;
      if (t.rMultiple > 0) current.wins += 1;
      current.netR += t.rMultiple;
      map.set(key, current);
    });

    return Array.from(map.entries()).map(([name, data]) => {
      const properName = collections.find(c => c.name.toLowerCase() === name)?.name || name;
      const wr = data.total ? Math.round((data.wins / data.total) * 100) : 0;
      return {
        name: properName,
        category: data.category,
        total: data.total,
        wins: data.wins,
        wr,
        netR: Number(data.netR.toFixed(2))
      };
    }).sort((a, b) => b.netR - a.netR);
  }, [collections, trades]);

  // 4. Asset / Symbol Edge
  const assetEdge = useMemo(() => {
    const map = new Map<string, { total: number; wins: number; netR: number }>();

    trades.forEach(t => {
      const sym = t.symbol.toUpperCase();
      const curr = map.get(sym) || { total: 0, wins: 0, netR: 0 };
      curr.total += 1;
      if (t.rMultiple > 0) curr.wins += 1;
      curr.netR = Number((curr.netR + t.rMultiple).toFixed(2));
      map.set(sym, curr);
    });

    return Array.from(map.entries())
      .map(([symbol, data]) => ({
        symbol,
        total: data.total,
        wins: data.wins,
        wr: Math.round((data.wins / data.total) * 100),
        netR: data.netR
      }))
      .sort((a, b) => b.netR - a.netR);
  }, [trades]);

  // 5. Day of Week Edge
  const dayEdge = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayStats = days.map(d => ({ day: d, trades: 0, wins: 0, netR: 0 }));

    trades.forEach(t => {
      const ts = parseDateToTimestamp(t.tradeDate);
      if (!ts) return;
      const date = new Date(ts);
      const dayIndex = date.getDay();
      if (dayIndex >= 1 && dayIndex <= 5) {
        const item = dayStats[dayIndex - 1];
        item.trades += 1;
        if (t.rMultiple > 0) item.wins += 1;
        item.netR = Number((item.netR + t.rMultiple).toFixed(2));
      }
    });

    return dayStats;
  }, [trades]);

  // 6. MAE Heat Taken Distribution
  const maeStats = useMemo(() => {
    let low = 0;
    let mid = 0;
    let high = 0;
    let count = 0;

    trades.forEach(t => {
      if (!t.mae) return;
      const num = Math.abs(parseFloat(t.mae.replace(/[^0-9.-]/g, '')) || 0);
      if (num < 0.3) low++;
      else if (num <= 0.7) mid++;
      else high++;
      count++;
    });

    return { low, mid, high, count };
  }, [trades]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Banner */}
      <div className="border-b border-white/[0.06] pb-3 sm:pb-4">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <Binary className="w-5 h-5 text-purple-400" />
          Quant Edge Matrix
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">Statistical distributions across time windows, setups, and assets.</p>
      </div>

      {/* Row 1: Underwater Drawdown Depth & Time Edge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Drawdown Depth Chart */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Underwater Drawdown Depth</h3>
            </div>
            <div className="text-xs font-mono text-rose-400 font-bold">
              MAX DD: -{drawdownData.maxDrawdown || 0}R
            </div>
          </div>

          <div className="h-48 sm:h-56 w-full">
            {!drawdownData.data || drawdownData.data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-zinc-600 border border-dashed border-white/5 rounded-xl p-4 text-center">
                No trades available to calculate drawdown depth.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownData.data}>
                  <defs>
                    <linearGradient id="drawdownFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="point" stroke="#27272A" fontSize={10} tickLine={false} />
                  <YAxis stroke="#27272A" fontSize={10} tickLine={false} unit="R" domain={['auto', 0]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090A10', borderColor: '#27272A', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }}
                    formatter={(val: any) => [`${val}R`, 'Drawdown from Peak']}
                  />
                  <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" strokeWidth={2} fill="url(#drawdownFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Peak Equity Tracking</span>
            <span>Realized Profile</span>
          </div>
        </div>

        {/* Time Edge */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Time Edge</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Session Windows</span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-around">
            {timeEdge.map(t => {
              const isProfit = t.netR >= 0;
              const maxAbs = Math.max(...timeEdge.map(item => Math.abs(item.netR)), 1);
              const barWidth = Math.min(Math.round((Math.abs(t.netR) / maxAbs) * 100), 100);
              const wr = t.trades ? Math.round((t.wins / t.trades) * 100) : 0;

              return (
                <div key={t.slot} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-200 text-[11px] sm:text-xs font-semibold">{t.slot}</span>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-zinc-500 text-[10px]">{t.trades}T</span>
                      <span className="text-zinc-400 text-[10px]">{wr}%</span>
                      <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{t.netR.toFixed(2)}R
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isProfit ? 'bg-emerald-400' : 'bg-rose-500'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.04] text-[11px] font-mono text-zinc-500 flex justify-between">
            <span>Intraday Windows</span>
            <span>Edge Distribution</span>
          </div>
        </div>
      </div>

      {/* Row 2: Strategy Edge Realization & Asset Edge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Setup Edge Matrix */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Setup Realization Edge</h3>
            </div>
            <span className="text-xs font-mono text-zinc-500">{setupEdge.length} Setups</span>
          </div>

          {setupEdge.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-zinc-600">
              No playbook setups logged yet.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {setupEdge.map(col => {
                const isGreen = col.netR >= 0;
                return (
                  <div key={col.name} className="py-2.5 sm:py-3 flex items-center justify-between hover:bg-white/[0.01] px-1 sm:px-2 rounded-xl transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[140px] sm:max-w-none">{col.name}</span>
                        <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-white/[0.04]">
                          {col.category}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-mono text-zinc-500 mt-0.5 flex items-center gap-2">
                        <span>{col.total} Trades</span>
                        <span>•</span>
                        <span className="text-zinc-400">{col.wr}% WR</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-16 sm:w-24 bg-white/[0.04] h-2 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full ${col.wr >= 50 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                          style={{ width: `${col.wr}%` }}
                        />
                      </div>
                      <div className={`font-mono text-xs sm:text-sm font-bold min-w-[60px] text-right ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isGreen ? '+' : ''}{col.netR.toFixed(2)}R
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Asset Edge */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-cyan-400" />
                <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Asset Edge</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">By Instrument</span>
            </div>

            {assetEdge.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-zinc-600">
                No ticker records yet.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04] mt-1">
                {assetEdge.slice(0, 8).map(asset => {
                  const isProfit = asset.netR >= 0;
                  return (
                    <div key={asset.symbol} className="py-2 flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1">
                          {isProfit ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
                          <span>{asset.symbol}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {asset.total}T • {asset.wr}% WR
                        </div>
                      </div>

                      <div className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{asset.netR.toFixed(2)}R
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.04] text-[11px] font-mono text-zinc-500 flex justify-between">
            <span>Ticker Performance</span>
            <span>Yield Origin</span>
          </div>
        </div>
      </div>

      {/* Row 3: Day-of-Week Edge & MAE Heat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Day-of-Week Edge */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Day-of-Week Edge</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Weekly Cycle</span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-around">
            {dayEdge.map(d => {
              const isProfit = d.netR >= 0;
              const maxAbs = Math.max(...dayEdge.map(item => Math.abs(item.netR)), 1);
              const barWidth = Math.min(Math.round((Math.abs(d.netR) / maxAbs) * 100), 100);

              return (
                <div key={d.day} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 text-[11px] sm:text-xs">{d.day}</span>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-zinc-500 text-[10px]">{d.trades} Trades</span>
                      <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{d.netR.toFixed(2)}R
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/[0.03] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isProfit ? 'bg-emerald-400' : 'bg-rose-500'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.04] text-[11px] font-mono text-zinc-500 flex justify-between">
            <span>Trading Schedule</span>
            <span>Intraweek Performance</span>
          </div>
        </div>

        {/* Adverse Excursion (MAE Heat) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Adverse Excursion (MAE Heat)</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Risk Profile</span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Cold (&lt;0.3R)</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">{maeStats.low}</span>
                <span className="text-[9px] font-mono text-zinc-500 block mt-0.5">Minimal</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Warm (0.3-0.7R)</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-amber-400">{maeStats.mid}</span>
                <span className="text-[9px] font-mono text-zinc-500 block mt-0.5">Normal</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Hot (&gt;0.7R)</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-rose-400">{maeStats.high}</span>
                <span className="text-[9px] font-mono text-zinc-500 block mt-0.5">Near SL</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.04] text-[11px] font-mono text-zinc-500 flex justify-between">
            <span>Heat Taken</span>
            <span>Stoploss Proximity</span>
          </div>
        </div>
      </div>
    </div>
  );
}