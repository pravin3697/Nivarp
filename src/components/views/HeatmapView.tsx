'use client';

import React, { useMemo, useState } from 'react';
import { Trade } from '@/types/trade';
import { parseDateToTimestamp } from '@/lib/parser';
import { Flame, Calendar, Sparkles, Clock, ArrowUpRight, Table, X } from 'lucide-react';

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

  // Overall Year Analytics
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

  // GitHub-style Calendar Matrices for Each Month (Monday to Friday rows x up to 5 week columns)
  const monthlyBlocks = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map((monthName, monthIdx) => {
      const daysInMonth = new Date(selectedYear, monthIdx + 1, 0).getDate();

      const weekColumns: Array<Array<{
        dateKey?: string;
        dayNum?: number;
        isValid: boolean;
        data?: ReturnType<typeof daysMap.get>;
      }>> = [];

      let currentWeek: Array<{
        dateKey?: string;
        dayNum?: number;
        isValid: boolean;
        data?: ReturnType<typeof daysMap.get>;
      }> = [];

      let monthNetR = 0;
      let monthTrades = 0;
      let monthWins = 0;
      let monthLosses = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(selectedYear, monthIdx, day);
        const dow = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

        if (dow === 0 || dow === 6) {
          if (dow === 0 && currentWeek.length > 0) {
            while (currentWeek.length < 5) currentWeek.push({ isValid: false });
            weekColumns.push(currentWeek);
            currentWeek = [];
          }
          continue;
        }

        const weekdayIndex = dow - 1; // 0 (Mon) to 4 (Fri)

        if (day === 1 && weekdayIndex > 0) {
          for (let p = 0; p < weekdayIndex; p++) {
            currentWeek.push({ isValid: false });
          }
        }

        const dateKey = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = daysMap.get(dateKey);

        if (dayData) {
          monthNetR = Number((monthNetR + dayData.totalR).toFixed(2));
          monthTrades += dayData.trades.length;
          monthWins += dayData.trades.filter(t => t.rMultiple > 0).length;
          monthLosses += dayData.trades.filter(t => t.rMultiple <= 0).length;
        }

        currentWeek.push({
          dateKey,
          dayNum: day,
          isValid: true,
          data: dayData
        });

        if (weekdayIndex === 4) {
          weekColumns.push(currentWeek);
          currentWeek = [];
        }
      }

      if (currentWeek.length > 0) {
        while (currentWeek.length < 5) currentWeek.push({ isValid: false });
        weekColumns.push(currentWeek);
      }

      while (weekColumns.length < 5) {
        weekColumns.push([
          { isValid: false }, { isValid: false }, { isValid: false }, { isValid: false }, { isValid: false }
        ]);
      }

      const wr = monthTrades ? Math.round((monthWins / monthTrades) * 100) : 0;

      return {
        monthName,
        monthIdx,
        weekColumns,
        monthNetR,
        monthTrades,
        monthWins,
        monthLosses,
        winRate: wr
      };
    });
  }, [selectedYear, daysMap]);

  const activeDayDetails = useMemo(() => {
    if (!selectedDayKey) return null;
    return daysMap.get(selectedDayKey) || null;
  }, [selectedDayKey, daysMap]);

  const getHeatColor = (totalR?: number, count?: number) => {
    if (!count || totalR === undefined) return 'bg-[#12141F] border-white/[0.04] hover:border-white/20';
    if (totalR > 2.0) return 'bg-emerald-400 text-black border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (totalR > 0.5) return 'bg-emerald-500/80 text-black border-emerald-400';
    if (totalR > 0) return 'bg-emerald-600/40 text-emerald-300 border-emerald-500/30';
    if (totalR === 0) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    if (totalR >= -0.5) return 'bg-rose-950/70 text-rose-300 border-rose-800/40';
    if (totalR >= -1.5) return 'bg-rose-700/80 text-white border-rose-500';
    return 'bg-rose-500 text-black border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            Execution Heatmap & Calendar Matrix
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Month-by-month market density and monthly performance dossier.</p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
          {availableYears.map(yr => (
            <button
              key={yr}
              onClick={() => { setSelectedYear(yr); setSelectedDayKey(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                selectedYear === yr ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Top Annual Stat Cards */}
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
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
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
            <span>Longest Streak</span>
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

      {/* MONTH-BY-MONTH UNIFORM 5x5 CALENDAR MATRIX */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h3 className="font-mono text-xs uppercase text-zinc-200">
              Trading Activity // {selectedYear} Monthly Calendar
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
            <span>Loss</span>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded bg-rose-500" />
              <span className="h-2.5 w-2.5 rounded bg-rose-700/80" />
              <span className="h-2.5 w-2.5 rounded bg-zinc-800" />
              <span className="h-2.5 w-2.5 rounded bg-emerald-600/40" />
              <span className="h-2.5 w-2.5 rounded bg-emerald-400" />
            </div>
            <span>Win</span>
          </div>
        </div>

        {/* 12 Symmetrical Month Cards */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start gap-3 min-w-[900px] font-mono">
            {/* Weekday Row Header on far left */}
            <div className="flex flex-col justify-between pt-7 pb-1 text-[9px] text-zinc-500 font-bold select-none h-[116px] shrink-0">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-6 lg:grid-cols-12 gap-3 flex-1">
              {monthlyBlocks.map(block => (
                <div key={block.monthName} className="space-y-1.5 p-2 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                  <div className="text-center pb-1 border-b border-white/[0.04]">
                    <span className="text-[11px] font-bold text-zinc-200 block">{block.monthName}</span>
                    <span className={`text-[9px] font-black ${
                      block.monthTrades === 0 ? 'text-zinc-600' :
                      block.monthNetR >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {block.monthTrades === 0 ? '—' : `${block.monthNetR >= 0 ? '+' : ''}${block.monthNetR}R`}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1">
                    {block.weekColumns.map((col, cIdx) => (
                      <div key={cIdx} className="flex flex-col gap-1">
                        {col.map((day, rIdx) => {
                          if (!day.isValid) {
                            return <div key={rIdx} className="h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-[3px] bg-transparent opacity-0" />;
                          }

                          const isSelected = selectedDayKey === day.dateKey;
                          const hasTrades = !!(day.data && day.data.trades.length > 0);

                          return (
                            <button
                              key={rIdx}
                              onClick={() => setSelectedDayKey(day.dateKey!)}
                              className={`h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-[3px] border transition-all ${
                                getHeatColor(day.data?.totalR, day.data?.trades.length)
                              } ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-black scale-125 z-10' : ''}`}
                              title={`${day.dateKey}: ${hasTrades ? `${day.data!.totalR}R (${day.data!.trades.length} trades)` : 'No trades'}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* POSITIONED DIRECTLY BELOW CALENDAR: Selected Day Execution Details */}
      {activeDayDetails ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-cyan-500/40 space-y-3 animate-in fade-in duration-150 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white font-mono">
                  Day Dossier // {activeDayDetails.dateFormatted} ({activeDayDetails.dayOfWeek})
                </h4>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {activeDayDetails.trades.length} Executed Trades
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`text-sm sm:text-base font-black font-mono ${activeDayDetails.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Day Net: {activeDayDetails.totalR >= 0 ? '+' : ''}{activeDayDetails.totalR}R
              </div>
              <button 
                onClick={() => setSelectedDayKey(null)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Close Day Dossier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {activeDayDetails.trades.map((t, idx) => (
              <div key={t.id || idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{t.symbol}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      t.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {t.direction}
                    </span>
                  </div>
                  <div className="text-[10px] text-cyan-300 mt-0.5 truncate max-w-[170px]">{t.setupType}</div>
                </div>
                <div className={`text-sm sm:text-base font-black ${t.rMultiple > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {t.rMultiple > 0 ? '+' : ''}{t.rMultiple}R
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] text-xs font-mono text-zinc-500 flex items-center gap-2 justify-center">
          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Click any day square in the calendar above to inspect trade executions right here.</span>
        </div>
      )}

      {/* MONTHLY PERFORMANCE BREAKDOWN TABLE (At the bottom as reference) */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
          <Table className="w-4 h-4 text-emerald-400" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">
            Monthly Performance Breakdown ({selectedYear})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/[0.04] text-[10px] text-zinc-500 uppercase tracking-wider">
                <th className="py-2 px-3">Month</th>
                <th className="py-2 px-3 text-center">Total Trades</th>
                <th className="py-2 px-3 text-center">Win / Loss</th>
                <th className="py-2 px-3 text-center">Win Rate</th>
                <th className="py-2 px-3 text-right">Net Harvest (R)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {monthlyBlocks.map(m => {
                const isProfit = m.monthNetR >= 0;
                return (
                  <tr key={m.monthName} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white uppercase">{m.monthName}</td>
                    <td className="py-2.5 px-3 text-center text-zinc-400">{m.monthTrades}</td>
                    <td className="py-2.5 px-3 text-center text-zinc-400">
                      {m.monthTrades > 0 ? (
                        <span>
                          <strong className="text-emerald-400">{m.monthWins}W</strong> / <strong className="text-rose-400">{m.monthLosses}L</strong>
                        </span>
                      ) : (
                        <span className="text-zinc-600">0W / 0L</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {m.monthTrades > 0 ? (
                        <span className={`font-bold ${m.winRate >= 50 ? 'text-cyan-300' : 'text-zinc-400'}`}>
                          {m.winRate}%
                        </span>
                      ) : (
                        <span className="text-zinc-600">0%</span>
                      )}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-black ${
                      m.monthTrades === 0 ? 'text-zinc-600' :
                      isProfit ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {m.monthTrades === 0 ? '0.00R' : `${isProfit ? '+' : ''}${m.monthNetR.toFixed(2)}R`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}