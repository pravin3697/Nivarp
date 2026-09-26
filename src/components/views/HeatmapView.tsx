'use client';

import React, { useMemo, useState } from 'react';
import { Trade } from '@/types/trade';
import { parseDateToTimestamp } from '@/lib/parser';
import { Flame, Calendar, Sparkles, Clock, ArrowUpRight } from 'lucide-react';

interface HeatmapViewProps {
  trades: Trade[];
}

export function HeatmapView({ trades }: HeatmapViewProps) {
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    trades.forEach(t => {
      const ts = parseDateToTimestamp(t.tradeDate);
      if (ts) years.add(new Date(ts).getFullYear());
    });
    if (!years.size) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [trades]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0]);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'quarters'>('timeline');

  const daysMap = useMemo(() => {
    const map = new Map<string, {
      dateKey: string;
      dateObj: Date;
      dateFormatted: string;
      dayOfWeek: string;
      totalR: number;
      trades: Trade[];
    }>();

    trades.forEach(t => {
      const ts = parseDateToTimestamp(t.tradeDate);
      if (!ts) return;
      const d = new Date(ts);
      if (d.getFullYear() !== selectedYear) return;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const existing = map.get(key) || {
        dateKey: key,
        dateObj: d,
        dateFormatted: t.tradeDate,
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
        totalR: 0,
        trades: []
      };

      existing.totalR = Number((existing.totalR + t.rMultiple).toFixed(2));
      existing.trades.push(t);
      map.set(key, existing);
    });

    return map;
  }, [trades, selectedYear]);

  const analytics = useMemo(() => {
    const allTradedDays = Array.from(daysMap.values());
    const totalDays = allTradedDays.length;
    const greenDays = allTradedDays.filter(d => d.totalR > 0).length;
    const redDays = allTradedDays.filter(d => d.totalR < 0).length;
    const neutralDays = allTradedDays.filter(d => d.totalR === 0).length;

    const dayWinRate = totalDays ? Math.round((greenDays / totalDays) * 100) : 0;
    const totalHarvestedR = Number(allTradedDays.reduce((acc, d) => acc + d.totalR, 0).toFixed(2));

    const sortedDays = [...allTradedDays].sort((a, b) => b.totalR - a.totalR);
    const bestDay = sortedDays[0] || null;

    let maxGreenStreak = 0;
    let currentStreak = 0;
    const chronologicalDays = [...allTradedDays].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    
    chronologicalDays.forEach(d => {
      if (d.totalR > 0) {
        currentStreak++;
        if (currentStreak > maxGreenStreak) maxGreenStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    return { totalDays, greenDays, redDays, neutralDays, dayWinRate, totalHarvestedR, bestDay, maxGreenStreak };
  }, [daysMap]);

  const activeDayDetails = useMemo(() => {
    if (!selectedDayKey) return null;
    return daysMap.get(selectedDayKey) || null;
  }, [selectedDayKey, daysMap]);

  const calendarTimeline = useMemo(() => {
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);
    
    const weeks: Array<Array<{
      dateKey: string;
      dayIndex: number;
      monthIndex: number;
      dayNum: number;
      data?: ReturnType<typeof daysMap.get>;
    }>> = [];

    let currentWeek: Array<{
      dateKey: string;
      dayIndex: number;
      monthIndex: number;
      dayNum: number;
      data?: ReturnType<typeof daysMap.get>;
    }> = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayData = daysMap.get(dateKey);

      currentWeek.push({
        dateKey,
        dayIndex: dayOfWeek,
        monthIndex: d.getMonth(),
        dayNum: d.getDate(),
        data: dayData
      });

      if (dayOfWeek === 5) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [selectedYear, daysMap]);

  const quarterlyData = useMemo(() => {
    const quarters = [
      { name: 'Q1 (Jan - Mar)', months: [0, 1, 2], netR: 0, trades: 0, wins: 0, totalDays: 0 },
      { name: 'Q2 (Apr - Jun)', months: [3, 4, 5], netR: 0, trades: 0, wins: 0, totalDays: 0 },
      { name: 'Q3 (Jul - Sep)', months: [6, 7, 8], netR: 0, trades: 0, wins: 0, totalDays: 0 },
      { name: 'Q4 (Oct - Dec)', months: [9, 10, 11], netR: 0, trades: 0, wins: 0, totalDays: 0 },
    ];

    daysMap.forEach(day => {
      const m = day.dateObj.getMonth();
      const q = quarters.find(item => item.months.includes(m));
      if (q) {
        q.netR = Number((q.netR + day.totalR).toFixed(2));
        q.trades += day.trades.length;
        q.wins += day.trades.filter(t => t.rMultiple > 0).length;
        q.totalDays += 1;
      }
    });

    return quarters;
  }, [daysMap]);

  const getHeatColor = (totalR?: number, count?: number) => {
    if (!count || totalR === undefined) return 'bg-white/[0.02] border-white/[0.04]';
    if (totalR > 2.0) return 'bg-emerald-400 text-black border-emerald-300';
    if (totalR > 0.5) return 'bg-emerald-500/80 text-black border-emerald-400';
    if (totalR > 0) return 'bg-emerald-600/40 text-emerald-300 border-emerald-500/30';
    if (totalR === 0) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    if (totalR >= -0.5) return 'bg-rose-950/70 text-rose-300 border-rose-800/40';
    if (totalR >= -1.5) return 'bg-rose-700/80 text-white border-rose-500';
    return 'bg-rose-500 text-black border-rose-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            Execution Heatmap Matrix
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Monday–Friday market density & daily performance track.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'timeline' ? 'bg-amber-400 text-black font-bold' : 'text-zinc-400'
              }`}
            >
              52-Week
            </button>
            <button
              onClick={() => setViewMode('quarters')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'quarters' ? 'bg-amber-400 text-black font-bold' : 'text-zinc-400'
              }`}
            >
              Quarterly
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
            {availableYears.map(yr => (
              <button
                key={yr}
                onClick={() => { setSelectedYear(yr); setSelectedDayKey(null); }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  selectedYear === yr ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs uppercase mb-1">
            <span>Harvest Yield</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className={`text-2xl sm:text-3xl font-black ${analytics.totalHarvestedR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {analytics.totalHarvestedR >= 0 ? '+' : ''}{analytics.totalHarvestedR}R
          </div>
          <div className="mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-zinc-400">
            Traded: <strong className="text-white">{analytics.totalDays} Days</strong>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs uppercase mb-1">
            <span>Day Accuracy</span>
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{analytics.dayWinRate}%</div>
          <div className="mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-zinc-400 flex items-center justify-between">
            <span className="text-emerald-400">{analytics.greenDays}G</span>
            <span>•</span>
            <span className="text-rose-400">{analytics.redDays}R</span>
            <span>•</span>
            <span className="text-zinc-400">{analytics.neutralDays}BE</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs uppercase mb-1">
            <span>Green Streak</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400">{analytics.maxGreenStreak} Days</div>
          <div className="mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-zinc-400">
            Max Consecutive Green
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06]">
          <div className="flex items-center justify-between text-zinc-500 text-[10px] sm:text-xs uppercase mb-1">
            <span>Peak Session</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 truncate">
            {analytics.bestDay ? `+${analytics.bestDay.totalR}R` : '0.00R'}
          </div>
          <div className="mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-zinc-400 truncate">
            {analytics.bestDay ? analytics.bestDay.dateFormatted : 'No records'}
          </div>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h3 className="font-mono text-xs uppercase text-zinc-200">
                Monday–Friday Matrix ({selectedYear})
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="inline-flex gap-2 font-mono min-w-full">
              <div className="flex flex-col justify-between py-1 text-[9px] text-zinc-500 font-bold pr-1 select-none">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
              </div>

              <div className="flex gap-1.5 flex-1">
                {calendarTimeline.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1.5 shrink-0">
                    {week.map(day => {
                      const isSelected = selectedDayKey === day.dateKey;
                      return (
                        <button
                          key={day.dateKey}
                          onClick={() => setSelectedDayKey(day.dateKey)}
                          className={`h-4 w-4 sm:h-5 sm:w-5 rounded-[4px] border text-[8px] font-mono flex items-center justify-center transition-all ${
                            getHeatColor(day.data?.totalR, day.data?.trades.length)
                          } ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black scale-110' : ''}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {quarterlyData.map(q => (
            <div key={q.name} className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                <span className="text-xs font-mono font-bold text-white">{q.name}</span>
                <span className="text-[10px] font-mono text-zinc-500">{q.totalDays} Days</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Yield</span>
                <div className={`text-xl font-black font-mono ${q.netR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {q.netR >= 0 ? '+' : ''}{q.netR.toFixed(2)}R
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeDayDetails && (
        <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white font-mono">
                {activeDayDetails.dateFormatted} ({activeDayDetails.dayOfWeek})
              </h4>
              <span className="text-[11px] text-zinc-500 font-mono">
                {activeDayDetails.trades.length} Trades Executed
              </span>
            </div>
            <div className={`text-sm sm:text-base font-black font-mono ${activeDayDetails.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Day Net: {activeDayDetails.totalR >= 0 ? '+' : ''}{activeDayDetails.totalR}R
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {activeDayDetails.trades.map((t, idx) => (
              <div key={t.id || idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="font-bold text-white text-sm">{t.symbol}</div>
                  <div className="text-[10px] text-cyan-300">{t.setupType}</div>
                </div>
                <div className={`text-sm font-black ${t.rMultiple > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {t.rMultiple > 0 ? '+' : ''}{t.rMultiple}R
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}