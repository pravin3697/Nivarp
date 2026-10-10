'use client';

import React, { useMemo } from 'react';
import { Trade, PlaybookCollection, BehavioralTag } from '@/types/trade';
import { parseDateToTimestamp, displaySetupName, cleanSecurityName } from '@/lib/parser';
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
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  AlertTriangle, 
  ZapOff, 
  Skull, 
  Timer, 
  AlertOctagon,
  ClockAlert,
  Flame
} from 'lucide-react';

interface MatrixViewProps {
  collections: PlaybookCollection[];
  trades: Trade[];
}

export function MatrixView({ collections, trades }: MatrixViewProps) {
  // Normalize trades so any legacy 'TATA' symbol is automatically grouped under 'TATAMOTORS'
  const normalizedTrades = useMemo(() => {
    return trades.map(t => ({
      ...t,
      symbol: cleanSecurityName(t.symbol)
    }));
  }, [trades]);

  // Helper to extract clean numeric R from MAE/MFE strings with Rupee price guard
  const parseExcursionR = (val: string | undefined, trade: Trade, isMae: boolean): number => {
    if (!val) {
      if (isMae) return trade.rMultiple < 0 ? Math.min(1.0, Math.abs(trade.rMultiple)) : 0.3;
      return trade.rMultiple > 0 ? Number((trade.rMultiple * 1.1).toFixed(2)) : 0;
    }

    const rawNum = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    if (isNaN(rawNum)) return 0;

    // Rupee price guard (if user typed stock price like ₹939 instead of R)
    if (rawNum > 20 && trade.entryPrice > 0) {
      const riskPerShare = Math.abs(trade.entryPrice - (trade.slPrice || trade.entryPrice * 0.99)) || 1;
      const priceDistance = trade.direction === 'LONG'
        ? (isMae ? trade.entryPrice - rawNum : rawNum - trade.entryPrice)
        : (isMae ? rawNum - trade.entryPrice : trade.entryPrice - rawNum);
      const computed = Number((priceDistance / riskPerShare).toFixed(2));
      return Math.min(15, Math.max(0, computed));
    }

    return Math.min(15, Math.abs(rawNum));
  };

  // Helper to convert trade timestamp into standard intraday time window
  const getTradeTimeSlot = (tradeTime?: string): string | null => {
    if (!tradeTime || typeof tradeTime !== 'string' || tradeTime.trim() === '') return null;
    const firstTime = tradeTime.includes('-') ? tradeTime.split('-')[0].trim() : tradeTime.trim();
    const match = firstTime.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
    if (!match) return null;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) || 0;
    const ampm = match[3] ? match[3].toUpperCase() : null;

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    const minuteOfDay = h * 60 + m;

    if (minuteOfDay >= 9 * 60 + 15 && minuteOfDay < 10 * 60) return '09:15 - 10:00 AM';
    if (minuteOfDay >= 10 * 60 && minuteOfDay < 11 * 60) return '10:00 - 11:00 AM';
    if (minuteOfDay >= 11 * 60 && minuteOfDay < 12 * 60) return '11:00 - 12:00 PM';
    if (minuteOfDay >= 12 * 60 && minuteOfDay < 13 * 60) return '12:00 - 01:00 PM';
    if (minuteOfDay >= 13 * 60 && minuteOfDay < 14 * 60) return '01:00 - 02:00 PM';
    if (minuteOfDay >= 14 * 60 && minuteOfDay <= 15 * 60 + 30) return '02:00 - 03:30 PM';
    return null;
  };

  // 1. Behavioral Execution Analytics
  const behaviorAnalytics = useMemo(() => {
    const totalTrades = normalizedTrades.length;

    const tags: {
      tag: BehavioralTag;
      label: string;
      color: string;
      border: string;
      bg: string;
      icon: any;
      isSystemRule: boolean;
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
        isSystemRule: true,
        trades: 0,
        wins: 0,
        netR: 0
      },
      {
        tag: 'SL Hunt / Slippage Hunt',
        label: 'SL Hunt (Market Variance)',
        color: 'text-purple-400',
        border: 'border-purple-500/30',
        bg: 'bg-purple-500/10',
        icon: ZapOff,
        isSystemRule: true,
        trades: 0,
        wins: 0,
        netR: 0
      },
      {
        tag: 'No Confirmation Entry',
        label: 'No Confirmation (Impulse)',
        color: 'text-amber-400',
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/10',
        icon: AlertTriangle,
        isSystemRule: false,
        trades: 0,
        wins: 0,
        netR: 0
      },
      {
        tag: 'Hallucinated Trade',
        label: 'Hallucinated (Revenge)',
        color: 'text-rose-400',
        border: 'border-rose-500/30',
        bg: 'bg-rose-500/10',
        icon: Skull,
        isSystemRule: false,
        trades: 0,
        wins: 0,
        netR: 0
      }
    ];

    let taggedCount = 0;
    let disciplinedTrades = 0;
    let disciplinedR = 0;
    let mistakeR = 0;
    let brokenRuleCount = 0;

    normalizedTrades.forEach(t => {
      const tag = t.behaviorTag;
      if (!tag) return;

      taggedCount++;
      const item = tags.find(x => x.tag === tag);
      if (item) {
        item.trades += 1;
        if (t.rMultiple > 0) item.wins += 1;
        item.netR = Number((item.netR + t.rMultiple).toFixed(2));
      }

      if (tag === 'Rules Followed' || tag === 'SL Hunt / Slippage Hunt') {
        disciplinedTrades++;
        disciplinedR = Number((disciplinedR + t.rMultiple).toFixed(2));
      } else {
        mistakeR = Number((mistakeR + t.rMultiple).toFixed(2));
        brokenRuleCount++;
      }
    });

    const complianceRate = taggedCount 
      ? Math.round((disciplinedTrades / taggedCount) * 100) 
      : 100;

    const avgCostPerMistake = brokenRuleCount 
      ? Number((mistakeR / brokenRuleCount).toFixed(2)) 
      : 0;

    return {
      tags,
      taggedCount,
      complianceRate,
      disciplinedR,
      mistakeR,
      brokenRuleCount,
      avgCostPerMistake,
      untaggedCount: totalTrades - taggedCount
    };
  }, [normalizedTrades]);

  // 2. Consolidated Setup Realization Edge with Per-Setup Peak & Worst Time Windows
  const setupEdge = useMemo(() => {
    const getBaseModelName = (name: string): string => {
      const clean = displaySetupName(name);
      return clean.replace(/^(failed|extended)\s+/i, '').trim();
    };

    const isArchiveBucket = (cat: string, name: string) => {
      const cleanCat = (cat || '').toUpperCase();
      const cleanName = (name || '').toLowerCase();
      return (
        cleanCat.includes('EXECUTION STOPPED') ||
        cleanCat.includes('BAD ENTRY') ||
        cleanName.includes('execution leak') ||
        cleanName.includes('behavioral & early')
      );
    };

    const modelMap = new Map<string, {
      baseName: string;
      category: string;
      totalTrades: number;
      wins: number;
      netR: number;
      primaryWins: number;
      primaryTrades: number;
      failedWins: number;
      failedTrades: number;
      totalMaeR: number;
      maeCount: number;
      totalMfeR: number;
      mfeCount: number;
      timeSlotsMap: Map<string, { trades: number; netR: number }>;
    }>();

    collections.forEach(col => {
      if (isArchiveBucket(col.category, col.name)) return;

      const base = getBaseModelName(col.name);
      const key = base.toLowerCase();
      if (!modelMap.has(key)) {
        modelMap.set(key, {
          baseName: base,
          category: col.category,
          totalTrades: 0,
          wins: 0,
          netR: 0,
          primaryWins: 0,
          primaryTrades: 0,
          failedWins: 0,
          failedTrades: 0,
          totalMaeR: 0,
          maeCount: 0,
          totalMfeR: 0,
          mfeCount: 0,
          timeSlotsMap: new Map()
        });
      }
    });

    normalizedTrades.forEach(t => {
      const raw = t.setupType || 'General Setup';
      const clean = displaySetupName(raw);
      if (isArchiveBucket(t.regime || '', clean)) return;

      const base = getBaseModelName(raw);
      const key = base.toLowerCase();

      if (!modelMap.has(key)) return;

      const current = modelMap.get(key)!;
      const isFailedOrExtended = /^(failed|extended)\s+/i.test(clean);
      const isWin = t.rMultiple > 0;

      current.totalTrades += 1;
      if (isWin) current.wins += 1;
      current.netR += t.rMultiple;

      if (isFailedOrExtended) {
        current.failedTrades += 1;
        if (isWin) current.failedWins += 1;
      } else {
        current.primaryTrades += 1;
        if (isWin) current.primaryWins += 1;
      }

      const tradeMae = parseExcursionR(t.mae, t, true);
      if (tradeMae > 0) {
        current.totalMaeR += tradeMae;
        current.maeCount += 1;
      }

      const tradeMfe = parseExcursionR(t.mfe, t, false);
      if (tradeMfe > 0) {
        current.totalMfeR += tradeMfe;
        current.mfeCount += 1;
      }

      // Record per-setup time execution slot
      const slot = getTradeTimeSlot(t.tradeTime);
      if (slot) {
        const slotData = current.timeSlotsMap.get(slot) || { trades: 0, netR: 0 };
        slotData.trades += 1;
        slotData.netR = Number((slotData.netR + t.rMultiple).toFixed(2));
        current.timeSlotsMap.set(slot, slotData);
      }

      modelMap.set(key, current);
    });

    return Array.from(modelMap.values()).map(d => {
      const wr = d.totalTrades ? Math.round((d.wins / d.totalTrades) * 100) : 0;
      const avgMae = d.maeCount ? Number((d.totalMaeR / d.maeCount).toFixed(2)) : 0;
      const avgMfe = d.mfeCount ? Number((d.totalMfeR / d.mfeCount).toFixed(2)) : 0;

      let bestSlot = '—';
      let bestSlotNetR = -Infinity;
      let worstSlot = '—';
      let worstSlotNetR = Infinity;

      if (d.timeSlotsMap.size > 0) {
        d.timeSlotsMap.forEach((val, slotName) => {
          if (val.netR > bestSlotNetR) {
            bestSlotNetR = val.netR;
            bestSlot = slotName;
          }
          if (val.netR < worstSlotNetR) {
            worstSlotNetR = val.netR;
            worstSlot = slotName;
          }
        });
      }

      // If best and worst point to the exact same slot with single record, show clear status
      if (d.timeSlotsMap.size <= 1) {
        if (bestSlotNetR >= 0) {
          worstSlot = 'None (Clean)';
        } else {
          bestSlot = 'None';
        }
      }

      return {
        name: d.baseName,
        category: d.category,
        total: d.totalTrades,
        wins: d.wins,
        wr,
        netR: Number(d.netR.toFixed(2)),
        hasVariants: d.failedTrades > 0,
        primaryTrades: d.primaryTrades,
        primaryWins: d.primaryWins,
        failedTrades: d.failedTrades,
        failedWins: d.failedWins,
        avgMae,
        avgMfe,
        bestTimeSlot: bestSlot,
        bestTimeNetR: bestSlotNetR !== -Infinity ? bestSlotNetR : 0,
        worstTimeSlot: worstSlot,
        worstTimeNetR: worstSlotNetR !== Infinity ? worstSlotNetR : 0
      };
    }).sort((a, b) => b.netR - a.netR);
  }, [collections, normalizedTrades]);

  // 3. Holding Duration
  const durationStats = useMemo(() => {
    let totalWinDuration = 0;
    let winCount = 0;
    let totalLossDuration = 0;
    let lossCount = 0;

    const scatterData = normalizedTrades.map(t => {
      let durationMinutes = t.durationMinutes || 0;

      if (!durationMinutes) {
        durationMinutes = t.rMultiple <= 0 ? 8 : 35;
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
    const overallAvgMin = normalizedTrades.length ? Math.round((totalWinDuration + totalLossDuration) / normalizedTrades.length) : 0;

    return {
      scatterData,
      avgWinMin,
      avgLossMin,
      overallAvgMin
    };
  }, [normalizedTrades]);

  // 4. Drawdown Depth Curve
  const drawdownData = useMemo(() => {
    if (!normalizedTrades.length) return { data: [], maxDrawdown: 0 };
    const sorted = [...normalizedTrades].sort((a, b) => parseDateToTimestamp(a.tradeDate) - parseDateToTimestamp(b.tradeDate));
    
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
  }, [normalizedTrades]);

  // 5. Global Time Edge
  const timeEdgeAnalysis = useMemo(() => {
    const timeSlots = [
      { label: '09:15 - 10:00 AM', startMin: 9 * 60 + 15, endMin: 10 * 60 - 1 },
      { label: '10:00 - 11:00 AM', startMin: 10 * 60, endMin: 11 * 60 - 1 },
      { label: '11:00 - 12:00 PM', startMin: 11 * 60, endMin: 12 * 60 - 1 },
      { label: '12:00 - 01:00 PM', startMin: 12 * 60, endMin: 13 * 60 - 1 },
      { label: '01:00 - 02:00 PM', startMin: 13 * 60, endMin: 14 * 60 - 1 },
      { label: '02:00 - 03:30 PM', startMin: 14 * 60, endMin: 15 * 60 + 30 }
    ];

    const slotStats = timeSlots.map(s => ({
      slot: s.label,
      trades: 0,
      wins: 0,
      netR: 0
    }));

    let missingTimeCount = 0;

    normalizedTrades.forEach((t) => {
      const rawTime = t.tradeTime || (t as any).time;
      let minuteOfDay = -1;

      if (rawTime && typeof rawTime === 'string' && rawTime.trim() !== '') {
        const firstTime = rawTime.includes('-') ? rawTime.split('-')[0].trim() : rawTime.trim();
        const match = firstTime.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);

        if (match) {
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10) || 0;
          const ampm = match[3] ? match[3].toUpperCase() : null;

          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;

          minuteOfDay = h * 60 + m;
        }
      }

      if (minuteOfDay < 0) {
        missingTimeCount++;
        return;
      }

      const matchIdx = timeSlots.findIndex(s => minuteOfDay >= s.startMin && minuteOfDay <= s.endMin);
      if (matchIdx !== -1) {
        slotStats[matchIdx].trades += 1;
        if (t.rMultiple > 0) slotStats[matchIdx].wins += 1;
        slotStats[matchIdx].netR = Number((slotStats[matchIdx].netR + t.rMultiple).toFixed(2));
      }
    });

    return {
      slots: slotStats,
      missingTimeCount
    };
  }, [normalizedTrades]);

  // 6. Asset Edge
  const assetEdge = useMemo(() => {
    const map = new Map<string, { total: number; wins: number; netR: number }>();

    normalizedTrades.forEach(t => {
      const sym = cleanSecurityName(t.symbol);
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
  }, [normalizedTrades]);

  // 7. Day of Week Edge
  const dayEdge = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayStats = days.map(d => ({ day: d, trades: 0, wins: 0, netR: 0 }));

    normalizedTrades.forEach(t => {
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
  }, [normalizedTrades]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Banner */}
      <div className="border-b border-white/[0.06] pb-3 sm:pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Binary className="w-5 h-5 text-purple-400" />
            Quant Edge & Behavioral Matrix
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Statistical setup models, per-setup peak/worst windows, and holding efficiency.</p>
        </div>
        {behaviorAnalytics.untaggedCount > 0 && (
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {behaviorAnalytics.untaggedCount} trades need behavioral tagging
          </span>
        )}
      </div>

      {/* 1. BEHAVIORAL EXECUTION AUDIT */}
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
              <span className="text-zinc-500">Unforced Mistake Cost:</span>
              <span className={`text-base font-black ${behaviorAnalytics.mistakeR <= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {behaviorAnalytics.mistakeR >= 0 ? '+' : ''}{behaviorAnalytics.mistakeR}R
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
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      {item.isSystemRule ? 'Rule Execution' : 'Psychological Error'}
                    </span>
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

        {/* UNFORCED MISTAKE RADAR */}
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-300">Unforced Error Penalty Radar:</span>
              <span className="text-zinc-400 ml-1.5">
                {behaviorAnalytics.brokenRuleCount} out of {behaviorAnalytics.taggedCount} trades were impulse/hallucinated mistakes.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="text-[10px] text-zinc-500 block">Avg Cost per Mistake</span>
              <span className="text-sm font-black text-rose-400">
                {behaviorAnalytics.avgCostPerMistake}R / trade
              </span>
            </div>
            <div className="h-6 w-[1px] bg-rose-500/20 hidden sm:block" />
            <div className="hidden sm:block text-left">
              <span className="text-[10px] text-zinc-500 block">Capital Saved If Skipped</span>
              <span className="text-sm font-black text-emerald-400">
                +{Math.abs(behaviorAnalytics.mistakeR)}R Saved
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXPANDED FULL-WIDTH CONTAINER DIRECTLY BELOW BEHAVIORAL: CONSOLIDATED TRUE SETUP PROBABILITY, EXCURSION & DUAL TIME WINDOWS */}
      <div className="w-full p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.06] gap-2">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-mono text-sm uppercase tracking-wider text-white font-bold">
                Consolidated True Setup Probability, Excursion & Time Edge Matrix
              </h3>
              <p className="text-[11px] font-mono text-zinc-400">
                Full blueprint: win rate, primary vs failed variants, peak edge window, leakage/worst time, runner MFE, and adverse MAE.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            {setupEdge.length} Playbook Models Tracked
          </span>
        </div>

        {setupEdge.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-zinc-600">
            No playbook setups logged yet.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {setupEdge.map(col => {
              const isGreen = col.netR >= 0;
              return (
                <div key={col.name} className="py-3.5 flex flex-col xl:flex-row xl:items-center justify-between hover:bg-white/[0.015] px-2 sm:px-3 rounded-xl transition-all gap-3">
                  {/* Setup Title, Category, and Volume Details */}
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{col.name}</span>
                      <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-white/[0.04]">
                        {col.category}
                      </span>
                    </div>
                    
                    <div className="text-[11px] font-mono text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>{col.total} Total Trades</span>
                      <span>•</span>
                      <span className="text-zinc-300 font-bold">{col.wr}% Win Rate</span>

                      {col.hasVariants && (
                        <div className="flex items-center gap-1.5 ml-1">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Primary: {col.primaryWins}W / {col.primaryTrades - col.primaryWins}L
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Failed: {col.failedWins}W / {col.failedTrades - col.failedWins}L
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantitative Metric Badges: Peak Window, Worst Window, MFE, MAE, Win Bar, Net R */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 font-mono text-xs">
                    {/* Setup-Specific Peak Time Edge Window */}
                    <div className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex flex-col items-start min-w-[125px]">
                      <span className="text-[9px] text-zinc-500 uppercase flex items-center gap-1 font-bold">
                        <Clock className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Peak Edge Time</span>
                      </span>
                      <span className="text-[11px] font-bold text-cyan-300 truncate max-w-[130px]">
                        {col.bestTimeSlot}
                      </span>
                    </div>

                    {/* Setup-Specific Worst / Leakage Time Window */}
                    <div className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col items-start min-w-[125px]">
                      <span className="text-[9px] text-zinc-500 uppercase flex items-center gap-1 font-bold">
                        <Flame className="w-2.5 h-2.5 text-amber-400" />
                        <span>Worst Time</span>
                      </span>
                      <span className="text-[11px] font-bold text-amber-300 truncate max-w-[130px]">
                        {col.worstTimeSlot}
                      </span>
                    </div>

                    {/* Average MFE (Peak Excursion) */}
                    <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-right min-w-[70px]">
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold">Avg MFE</span>
                      <span className="text-[11px] font-black text-emerald-400">+{col.avgMfe}R</span>
                    </div>

                    {/* Average MAE (Adverse Excursion) */}
                    <div className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/25 text-right min-w-[70px]">
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold">Avg MAE</span>
                      <span className="text-[11px] font-black text-rose-400">-{col.avgMae}R</span>
                    </div>

                    {/* Win Rate Progress Indicator */}
                    <div className="w-16 bg-white/[0.04] h-2 rounded-full overflow-hidden hidden md:block">
                      <div
                        className={`h-full rounded-full ${col.wr >= 50 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                        style={{ width: `${col.wr}%` }}
                      />
                    </div>

                    {/* Net Realized Return */}
                    <div className={`font-mono text-sm sm:text-base font-black min-w-[75px] text-right ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isGreen ? '+' : ''}{col.netR.toFixed(2)}R
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. DURATION VS PROFITABILITY MATRIX & HOLDING EFFICIENCY */}
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

      {/* 4. UNDERWATER DRAWDOWN & GLOBAL TIME EDGE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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

        {/* Global Time Edge */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">Global Time Edge</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">All Market Windows</span>
          </div>

          {timeEdgeAnalysis.missingTimeCount > 0 && (
            <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-center gap-1.5">
              <ClockAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>{timeEdgeAnalysis.missingTimeCount} trade(s) have no timestamp. Update them via Edit Debrief.</span>
            </div>
          )}

          <div className="space-y-3 flex-1 flex flex-col justify-around">
            {timeEdgeAnalysis.slots.map(t => {
              const isProfit = t.netR >= 0;
              const maxAbs = Math.max(...timeEdgeAnalysis.slots.map(item => Math.abs(item.netR)), 1);
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
            <span>Global Market Windows</span>
          </div>
        </div>
      </div>

      {/* 5. DAY-OF-WEEK EDGE & ASSET EDGE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
    </div>
  );
}