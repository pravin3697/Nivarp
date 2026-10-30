'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Trade } from '@/types/trade';
import { parseDateToTimestamp, displaySetupName } from '@/lib/parser';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { 
  Activity, 
  Target, 
  Layers, 
  ShieldAlert, 
  Maximize2, 
  Pencil, 
  ShieldCheck, 
  Clock, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X
} from 'lucide-react';

interface PulseViewProps {
  trades: Trade[];
  stats: any;
  growthCurve: any[];
  defaultRisk: number;
  onOpenInspector: (url: string, title: string, htfUrl?: string, ltfUrl?: string) => void;
  onOpenDebrief: (trade: Trade) => void;
  onOpenCsvModal: () => void;
}

const TIME_WINDOWS = [
  { label: 'All Time Slots', value: 'all', startMin: 0, endMin: 1440 },
  { label: '09:15 - 10:00 AM', value: '09:15 - 10:00 AM', startMin: 9 * 60 + 15, endMin: 10 * 60 - 1 },
  { label: '10:00 - 11:00 AM', value: '10:00 - 11:00 AM', startMin: 10 * 60, endMin: 11 * 60 - 1 },
  { label: '11:00 - 12:00 PM', value: '11:00 - 12:00 PM', startMin: 11 * 60, endMin: 12 * 60 - 1 },
  { label: '12:00 - 01:00 PM', value: '12:00 - 01:00 PM', startMin: 12 * 60, endMin: 13 * 60 - 1 },
  { label: '01:00 - 02:00 PM', value: '01:00 - 02:00 PM', startMin: 13 * 60, endMin: 14 * 60 - 1 },
  { label: '02:00 - 03:30 PM', value: '02:00 - 03:30 PM', startMin: 14 * 60, endMin: 15 * 60 + 30 },
];

function extractEntryMinuteOfDay(rawTime?: string): number {
  if (!rawTime || typeof rawTime !== 'string' || rawTime.trim() === '') return -1;
  const entryPart = rawTime.includes('-') ? rawTime.split('-')[0].trim() : rawTime.trim();

  const match = entryPart.match(/(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*\d{2})?\s*(AM|PM)?/i);
  if (!match) return -1;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

export function PulseView({
  trades,
  stats: globalStats,
  growthCurve: globalGrowthCurve,
  onOpenInspector,
  onOpenDebrief,
}: PulseViewProps) {
  const [filterMode, setFilterMode] = useState<'rules-only' | 'all'>('rules-only');

  const latestTradeDate = useMemo(() => {
    if (!trades.length) return new Date();
    const timestamps = trades.map(t => parseDateToTimestamp(t.tradeDate)).filter(ts => ts > 0);
    return timestamps.length ? new Date(Math.max(...timestamps)) : new Date();
  }, [trades]);

  const [currentDateCursor, setCurrentDateCursor] = useState<Date>(() => latestTradeDate);
  const [isAllTime, setIsAllTime] = useState<boolean>(false);

  const [listTimeSlot, setListTimeSlot] = useState<string>('all');
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTimeDropdownOpen(false);
      }
    }
    if (isTimeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTimeDropdownOpen]);

  const handlePrevMonth = () => {
    setIsAllTime(false);
    setCurrentDateCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setIsAllTime(false);
    setCurrentDateCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSnapToLatest = () => {
    setIsAllTime(false);
    setCurrentDateCursor(latestTradeDate);
  };

  const monthLabel = useMemo(() => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[currentDateCursor.getMonth()]} ${currentDateCursor.getFullYear()}`;
  }, [currentDateCursor]);

  const dashboardTrades = useMemo(() => {
    const curYear = currentDateCursor.getFullYear();
    const curMonth = currentDateCursor.getMonth();

    return trades.filter(t => {
      if (!isAllTime) {
        const ts = parseDateToTimestamp(t.tradeDate);
        if (ts) {
          const d = new Date(ts);
          if (d.getFullYear() !== curYear || d.getMonth() !== curMonth) {
            return false;
          }
        }
      }

      if (filterMode === 'rules-only') {
        const tag = t.behaviorTag;
        return (
          tag === 'Rules Followed' || 
          tag === 'SL Hunt / Slippage Hunt' || 
          (!tag && t.rMultiple > 0)
        );
      }

      return true;
    });
  }, [trades, filterMode, isAllTime, currentDateCursor]);

  const dynamicStats = useMemo(() => {
    const list = dashboardTrades;
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
  }, [dashboardTrades]);

  const dynamicGrowthCurve = useMemo(() => {
    const chronological = [...dashboardTrades].sort((a, b) => parseDateToTimestamp(a.tradeDate) - parseDateToTimestamp(b.tradeDate));
    let cumR = 0;
    return chronological.map((t, idx) => {
      cumR += t.rMultiple;
      return { point: `#${idx + 1}`, r: Number(cumR.toFixed(2)) };
    });
  }, [dashboardTrades]);

  const sortedRecentTrades = useMemo(() => {
    const targetSlot = TIME_WINDOWS.find(w => w.value === listTimeSlot);

    const filteredList = dashboardTrades.filter(t => {
      if (listTimeSlot === 'all' || !targetSlot) return true;
      const entryMin = extractEntryMinuteOfDay(t.tradeTime);
      if (entryMin === -1) return false;
      return entryMin >= targetSlot.startMin && entryMin <= targetSlot.endMin;
    });

    return [...filteredList].sort((a, b) => {
      const timeA = parseDateToTimestamp(a.tradeDate);
      const timeB = parseDateToTimestamp(b.tradeDate);
      return timeB - timeA;
    });
  }, [dashboardTrades, listTimeSlot]);

  const activeTimeLabel = useMemo(() => {
    return TIME_WINDOWS.find(w => w.value === listTimeSlot)?.label || 'All Time Slots';
  }, [listTimeSlot]);

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
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#090A10] border border-white/[0.06] select-none">
        
        {/* Left: Discipline Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
            <button
              onClick={() => setFilterMode('rules-only')}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all w-32 sm:w-36 text-center ${
                filterMode === 'rules-only'
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Rules-Based</span>
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all w-32 sm:w-36 text-center ${
                filterMode === 'all'
                  ? 'bg-zinc-800 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>All Executions</span>
            </button>
          </div>
        </div>

        {/* Right: Sleek Month Pager (Prev / Next) + All Time Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-2 font-mono text-xs">
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div 
              onClick={handleSnapToLatest}
              className="px-3 py-1 font-bold text-center select-none cursor-pointer hover:text-cyan-300 transition-colors min-w-[130px] sm:min-w-[145px]"
              title="Click to reset to current month"
            >
              <span className={isAllTime ? 'text-zinc-500' : 'text-cyan-300'}>
                {monthLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAllTime(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all border ${
              isAllTime
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Edge */}
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

        {/* Win Rate */}
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

        {/* Drawdown & Peak */}
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

      {/* Trajectory Growth Curve with Balanced Contrast Numbers & Graph Lines */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs uppercase text-zinc-400 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${filterMode === 'rules-only' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
            <span>
              {filterMode === 'rules-only' ? 'System Edge Trajectory (Rules Followed & SL Hunts)' : 'Realized Trajectory (All Trades)'}
            </span>
          </h3>
          <span className={`text-xs font-mono font-bold ${dynamicStats.netR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatR(dynamicStats.netR)}
          </span>
        </div>
        <div className="h-56 sm:h-72 w-full">
          {dashboardTrades.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-xs font-mono text-zinc-500 border border-dashed border-white/[0.05] rounded-xl p-4 text-center">
              No trades matching {isAllTime ? 'lifetime records' : monthLabel}.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicGrowthCurve} margin={{ top: 10, right: 10, bottom: 5, left: -15 }}>
                <defs>
                  <linearGradient id="curveLaser" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={filterMode === 'rules-only' ? '#00F5A0' : '#22d3ee'} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={filterMode === 'rules-only' ? '#00F5A0' : '#22d3ee'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                {/* Clean, readable axis numbers without over-brightness */}
                <XAxis 
                  dataKey="point" 
                  stroke="#3F3F46" 
                  tick={{ fill: '#A1A1AA', fontSize: 10, fontFamily: 'monospace' }} 
                  tickLine={{ stroke: '#3F3F46' }} 
                />
                <YAxis 
                  stroke="#3F3F46" 
                  tick={{ fill: '#A1A1AA', fontSize: 10, fontFamily: 'monospace' }} 
                  tickLine={{ stroke: '#3F3F46' }} 
                  unit="R" 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0C0D14', borderColor: '#27272A', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }} 
                  formatter={(val: any) => [`${Number(val).toFixed(2)}R`, 'Cumulative Return']}
                />
                <Area 
                  type="monotone" 
                  dataKey="r" 
                  stroke={filterMode === 'rules-only' ? '#00F5A0' : '#22d3ee'} 
                  strokeWidth={2} 
                  fill="url(#curveLaser)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Logged Trade Entries */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-white/[0.06] gap-2.5">
          <div>
            <h3 className="font-mono text-xs uppercase text-zinc-300 font-bold">
              {filterMode === 'rules-only' ? 'Rules-Based Executions' : 'All Trade Executions'} (Newest First)
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">
              Showing {sortedRecentTrades.length} of {dashboardTrades.length} Trades {isAllTime ? '(All Time)' : `(${monthLabel})`}
            </span>
          </div>

          {/* Cybernetic Custom Dropdown UI */}
          <div className="relative self-start sm:self-auto" ref={dropdownRef}>
            <div className="flex items-center gap-1 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-cyan-500/40 rounded-xl p-1 transition-all">
              <button
                type="button"
                onClick={() => setIsTimeDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-2.5 py-1 text-xs font-mono font-bold text-white transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="tracking-wide text-zinc-200">{activeTimeLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isTimeDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>

              {listTimeSlot !== 'all' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setListTimeSlot('all');
                  }}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Reset to all times"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {isTimeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-[#0B0D14]/95 border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl py-1.5 font-mono text-xs divide-y divide-white/[0.05] animate-in fade-in zoom-in-95 duration-100">
                <div className="p-1 space-y-0.5">
                  {TIME_WINDOWS.map(w => {
                    const isSelected = listTimeSlot === w.value;
                    return (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => {
                          setListTimeSlot(w.value);
                          setIsTimeDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-all ${
                          isSelected
                            ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                            : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>{w.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {sortedRecentTrades.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-zinc-500 space-y-2">
            <p>No trades executed during <span className="text-cyan-400 font-bold">{activeTimeLabel}</span>.</p>
            <button
              onClick={() => setListTimeSlot('all')}
              className="text-cyan-400 underline hover:text-white font-bold"
            >
              Reset to all times
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {sortedRecentTrades.map(t => {
              const isGreen = t.rMultiple >= 0;
              const behaviorClass = getBehaviorBadge(t.behaviorTag);
              const cleanSetup = displaySetupName(t.setupType);

              return (
                <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/[0.01] px-1 sm:px-2 rounded-xl transition-all gap-2">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 mt-0.5 sm:mt-0 ${
                      t.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {t.direction}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{t.symbol}</span>
                        <span className="text-[11px] text-zinc-500 font-mono">({t.tradeDate})</span>

                        {t.behaviorTag && (
                          <span className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-bold ${behaviorClass}`}>
                            {t.behaviorTag}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-cyan-400 font-semibold">{cleanSetup}</span>
                        <span>•</span>
                        <span>₹{t.entryPrice} → ₹{t.exitPrice}</span>
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