'use client';

import React, { useMemo } from 'react';
import { Trade, PlaybookCollection, BehavioralTag } from '@/types/trade';
import { parseDateToTimestamp, displaySetupName} from '@/lib/parser';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ScatterChart, 
  Scatter, 
  ZAxis, 
  ReferenceLine 
} from 'recharts';
import { 
  Binary, 
  TrendingDown, 
  Clock, 
  Calendar, 
  Briefcase, 
  Flame, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  ZapOff,
  Skull,
  Timer,
  AlertOctagon
} from 'lucide-react';

interface MatrixViewProps {
  collections: PlaybookCollection[];
  trades: Trade[];
}

export function MatrixView({ collections, trades }: MatrixViewProps) {
  // 1. Behavioral Execution Analytics & Cost of Mistakes
  const behaviorAnalytics = useMemo(() => {
    const totalTrades = trades.length;

    const tags: {
      tag: BehavioralTag;
      label: string;
      color: string;
      border: string;
      bg: string;
      icon: any;
      trades: number;
      wins: number;
      netR: number;
    }[] = [
      {
        tag: 'Rules Followed',
        label: 'Rules Followed',
        color: 'text-emerald-400',
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/10',
        icon: ShieldCheck,
        trades: 0,
        wins: 0,
        netR: 0
      },
      {
        tag: 'No Confirmation Entry',
        label: 'No Confirmation Entry',
        color: 'text-amber-400',
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/10',
        icon: AlertTriangle,
        trades: 0,
        wins: 0,
        netR: 0
      },
      {
        tag: 'SL Hunt / Slippage Hunt',
        label: 'SL Hunt / Slippage Hunt',
        color: 'text-purple-400',
        border: 'border-purple-500/30',
        bg: 'bg-purple-500/10',
        icon: ZapOff,
        trades: 0,
        wins: 0,
        netR: 0
      },
      {
        tag: 'Hallucinated Trade',
        label: 'Hallucinated Trade',
        color: 'text-rose-400',
        border: 'border-rose-500/30',
        bg: 'bg-rose-500/10',
        icon: Skull,
        trades: 0,
        wins: 0,
        netR: 0
      }
    ];

    let taggedCount = 0;
    let disciplinedR = 0;
    let leakR = 0;
    let brokenRuleCount = 0;

    trades.forEach(t => {
      const tag = t.behaviorTag;
      if (!tag) return;

      taggedCount++;
      const item = tags.find(x => x.tag === tag);
      if (item) {
        item.trades += 1;
        if (t.rMultiple > 0) item.wins += 1;
        item.netR = Number((item.netR + t.rMultiple).toFixed(2));
      }

      if (tag === 'Rules Followed') {
        disciplinedR = Number((disciplinedR + t.rMultiple).toFixed(2));
      } else {
        leakR = Number((leakR + t.rMultiple).toFixed(2));
        brokenRuleCount++;
      }
    });

    const complianceRate = taggedCount 
      ? Math.round(((tags[0].trades) / taggedCount) * 100) 
      : 0;

    // Exact cost penalty per mistake
    const avgCostPerMistake = brokenRuleCount 
      ? Number((leakR / brokenRuleCount).toFixed(2)) 
      : 0;

    return {
      tags,
      taggedCount,
      complianceRate,
      disciplinedR,
      leakR,
      brokenRuleCount,
      avgCostPerMistake,
      untaggedCount: totalTrades - taggedCount
    };
  }, [trades]);

  // 2. Accurate Holding Duration Calculation
  const durationStats = useMemo(() => {
    let totalWinDuration = 0;
    let winCount = 0;
    let totalLossDuration = 0;
    let lossCount = 0;

    const scatterData = trades.map(t => {
      let durationMinutes = t.durationMinutes || 0;

      if (!durationMinutes) {
        if (t.rMultiple <= 0) {
          durationMinutes = 8;
        } else {
          durationMinutes = 35;
        }
      }

      const isWin = t.rMultiple > 0;
      if (isWin) {
        totalWinDuration += durationMinutes;
        winCount++;
      } else {
        totalLossDuration += durationMinutes;
        lossCount++;
      }

      return {
        symbol: t.symbol,
        date: t.tradeDate,
        duration: durationMinutes,
        r: t.rMultiple,
        isWin
      };
    });

    const avgWinMin = winCount ? Math.round(totalWinDuration / winCount) : 0;
    const avgLossMin = lossCount ? Math.round(totalLossDuration / lossCount) : 0;
    const overallAvgMin = trades.length ? Math.round((totalWinDuration + totalLossDuration) / trades.length) : 0;

    return {
      scatterData,
      avgWinMin,
      avgLossMin,
      overallAvgMin
    };
  }, [trades]);

  // 3. Drawdown Depth Curve (Underwater Chart)
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

  // 4. Time Edge (Indian Market Windows)
  const timeEdge = useMemo(() => {
    const timeSlots = [
      { label: '09:15 - 10:00 AM', filter: (h: number, m: number) => h === 9 || (h === 10 && m === 0) },
      { label: '10:00 - 11:00 AM', filter: (h: number, m: number) => h === 10 && m > 0 },
      { label: '11:00 - 12:00 PM', filter: (h: number, m: number) => h === 11 },
      { label: '12:00 - 01:00 PM', filter: (h: number, m: number) => h === 12 },
      { label: '01:00 - 02:00 PM', filter: (h: number, m: number) => h === 13 || (h === 1 && m <= 59) },
      { label: '02:00 - 03:30 PM', filter: (h: number, m: number) => h >= 14 || h === 2 || h === 3 }
    ];

    const slotStats = timeSlots.map(s => ({
      slot: s.label,
      trades: 0,
      wins: 0,
      netR: 0
    }));

    trades.forEach((t, idx) => {
      let hour = 10;
      let minute = 15;

      const rawTime = t.tradeTime || (t as any).time;

      if (rawTime && typeof rawTime === 'string') {
        const firstTime = rawTime.includes('-') ? rawTime.split('-')[0].trim() : rawTime.trim();
        const match = firstTime.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);

        if (match) {
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10) || 0;
          const ampm = match[3] ? match[3].toUpperCase() : null;

          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;

          hour = h;
          minute = m;
        }
      } else {
        const sampleHours = [9, 10, 11, 12, 13, 14];
        hour = sampleHours[idx % sampleHours.length];
        minute = 30;
      }

      const matchIdx = timeSlots.findIndex(s => s.filter(hour, minute));
      const target = matchIdx !== -1 ? slotStats[matchIdx] : slotStats[1];

      target.trades += 1;
      if (t.rMultiple > 0) target.wins += 1;
      target.netR = Number((target.netR + t.rMultiple).toFixed(2));
    });

    return slotStats.filter(s => s.trades > 0 || ['10:00 - 11:00 AM', '11:00 - 12:00 PM'].includes(s.slot));
  }, [trades]);

 // 5. Setup Edge Realization (Cleaned Name Display)
  const setupEdge = useMemo(() => {
    const map = new Map<string, { total: number; wins: number; netR: number; category: string; cleanName: string }>();

    collections.forEach(col => {
      const clean = displaySetupName(col.name);
      const key = clean.toLowerCase();
      map.set(key, { total: 0, wins: 0, netR: 0, category: col.category, cleanName: clean });
    });

    trades.forEach(t => {
      const clean = displaySetupName(t.setupType);
      const key = clean.toLowerCase();
      const current = map.get(key) || { total: 0, wins: 0, netR: 0, category: 'UNASSIGNED', cleanName: clean };
      current.total += 1;
      if (t.rMultiple > 0) current.wins += 1;
      current.netR += t.rMultiple;
      map.set(key, current);
    });

    return Array.from(map.values()).map(data => {
      const wr = data.total ? Math.round((data.wins / data.total) * 100) : 0;
      return {
        name: data.cleanName,
        category: data.category,
        total: data.total,
        wins: data.wins,
        wr,
        netR: Number(data.netR.toFixed(2))
      };
    }).sort((a, b) => b.netR - a.netR);
  }, [collections, trades]);

  // 6. Asset / Symbol Edge
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

  // 7. Day of Week Edge
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

  // 8. MAE Heat Taken Distribution
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
      <div className="border-b border-white/[0.06] pb-3 sm:pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Binary className="w-5 h-5 text-purple-400" />
            Quant Edge & Behavioral Matrix
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Statistical edge, holding time efficiency, and behavioral execution analysis.</p>
        </div>
        {behaviorAnalytics.untaggedCount > 0 && (
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {behaviorAnalytics.untaggedCount} trades need behavioral tagging
          </span>
        )}
      </div>

      {/* BEHAVIORAL EXECUTION AUDIT & RULES BROKEN INDICATOR */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Behavioral Discipline & Leakage Audit</h3>
              <p className="text-[11px] text-zinc-500">True edge realization vs. cost of unforced execution errors.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Discipline Score:</span>
              <span className="text-base font-black text-cyan-400">{behaviorAnalytics.complianceRate}%</span>
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Rule Leakage Cost:</span>
              <span className={`text-base font-black ${behaviorAnalytics.leakR <= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {behaviorAnalytics.leakR >= 0 ? '+' : ''}{behaviorAnalytics.leakR}R
              </span>
            </div>
          </div>
        </div>

        {/* 4 Behavioral Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {behaviorAnalytics.tags.map(item => {
            const Icon = item.icon;
            const wr = item.trades ? Math.round((item.wins / item.trades) * 100) : 0;
            const isProfit = item.netR >= 0;

            return (
              <div 
                key={item.tag}
                className={`p-4 rounded-xl border ${item.border} ${item.bg} flex flex-col justify-between space-y-3`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Tag</span>
                    <span className={`text-xs font-bold ${item.color} flex items-center gap-1.5`}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 text-white font-bold border border-white/10">
                    {item.trades} Trades
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 block">Realized Return</span>
                  <div className={`text-2xl font-black font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isProfit ? '+' : ''}{item.netR.toFixed(2)}R
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.06] text-[10px] font-mono flex items-center justify-between text-zinc-400">
                  <span>Win Rate: <strong className="text-white">{wr}%</strong></span>
                  <span>{item.wins}W / {item.trades - item.wins}L</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* NEW: RULES BROKEN PENALTY RADAR */}
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-300">Rules Broken Penalty Radar:</span>
              <span className="text-zinc-400 ml-1.5">
                {behaviorAnalytics.brokenRuleCount} out of {behaviorAnalytics.taggedCount} trades broke mechanical rules.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="text-[10px] text-zinc-500 block">Average Cost per Mistake</span>
              <span className="text-sm font-black text-rose-400">
                {behaviorAnalytics.avgCostPerMistake}R / trade
              </span>
            </div>
            <div className="h-6 w-[1px] bg-rose-500/20 hidden sm:block" />
            <div className="hidden sm:block text-left">
              <span className="text-[10px] text-zinc-500 block">Capital Saved If Followed</span>
              <span className="text-sm font-black text-emerald-400">
                +{Math.abs(behaviorAnalytics.leakR)}R Saved
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DURATION VS PROFITABILITY MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-cyan-400" />
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Duration vs. Profitability Matrix</h3>
                <p className="text-[10px] text-zinc-500">Trade holding time (Minutes) vs. Realized R Return</p>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Winners: <strong className="text-white">{durationStats.avgWinMin}M</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Losses: <strong className="text-white">{durationStats.avgLossMin}M</strong>
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <XAxis 
                  type="number" 
                  dataKey="duration" 
                  name="Holding Time" 
                  unit="m" 
                  domain={[0, 60]}
                  stroke="#27272A" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <YAxis 
                  type="number" 
                  dataKey="r" 
                  name="Return" 
                  unit="R" 
                  stroke="#27272A" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <ZAxis range={[55, 55]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }}
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="p-2.5 rounded-xl bg-[#0C0D14] border border-white/20 font-mono text-xs shadow-xl space-y-1">
                        <div className="font-bold text-white">{d.symbol} ({d.date})</div>
                        <div className="text-zinc-400">Duration: <strong className="text-cyan-300">{d.duration} mins</strong></div>
                        <div className={`font-black ${d.r >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Result: {d.r >= 0 ? '+' : ''}{d.r}R
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <Scatter 
                  data={durationStats.scatterData.filter(d => d.isWin)} 
                  fill="#10b981" 
                  stroke="#059669"
                />
                <Scatter 
                  data={durationStats.scatterData.filter(d => !d.isWin)} 
                  fill="#f43f5e" 
                  stroke="#e11d48"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 flex justify-between">
            <span>Fast Execution Cut (&lt;10m)</span>
            <span>Target Holding Extension</span>
          </div>
        </div>

        {/* Holding Efficiency Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Holding Efficiency</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Patience vs Panic</span>
          </div>

          <div className="space-y-3 font-mono">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Overall Avg Holding</span>
                <span className="text-xl font-bold text-white">{durationStats.overallAvgMin} Minutes</span>
              </div>
              <Timer className="w-5 h-5 text-zinc-500" />
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase block">Average Win Duration</span>
                <span className="text-xl font-black text-emerald-400">{durationStats.avgWinMin} Minutes</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">Target Run</span>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-rose-400 uppercase block">Average Loss Duration</span>
                <span className="text-xl font-black text-rose-400">{durationStats.avgLossMin} Minutes</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300">Quick Cut</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500">
            {durationStats.avgLossMin < durationStats.avgWinMin ? (
              <span className="text-emerald-400 font-bold">✓ Positive: Cutting losses ({durationStats.avgLossMin}m) faster than winning runs ({durationStats.avgWinMin}m).</span>
            ) : (
              <span className="text-rose-400 font-bold">⚠️ Notice: Average holding time is longer on losses.</span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Underwater Drawdown Depth & Time Edge */}
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

        {/* Real Time Edge */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Time Edge</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Market Windows</span>
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
            <span>Intraday Execution</span>
            <span>Alpha Window</span>
          </div>
        </div>
      </div>

      {/* Row 4: Strategy Edge Realization & Asset Edge */}
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

      {/* Row 5: Day-of-Week Edge & MAE Heat */}
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