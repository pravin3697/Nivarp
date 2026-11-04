'use client';

import React, { useState } from 'react';
import { ExecutionContractState, Trade } from '@/types/trade';
import { 
  X, 
  Swords, 
  Skull, 
  Flame, 
  AlertOctagon
} from 'lucide-react';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ExecutionContractState;
  trades: Trade[];
  onReportBreach: (reason: string, cost: string) => void;
}

export function ContractModal({
  isOpen,
  onClose,
  contract,
  trades,
  onReportBreach
}: ContractModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'rules' | 'graveyard'>('status');

  // Breach confession form state
  const [isConfessingBreach, setIsConfessingBreach] = useState(false);
  const [breachReason, setBreachReason] = useState('');
  const [breachCost, setBreachCost] = useState('');

  if (!isOpen) return null;

  // Calculate days elapsed since current attempt start
  const startTs = new Date(contract.startDate).getTime();
  const nowTs = Date.now();
  const diffDays = Math.max(1, Math.floor((nowTs - startTs) / (1000 * 60 * 60 * 24)) + 1);
  const daysRemaining = Math.max(0, contract.totalTargetDays - diffDays);
  const progressPct = Math.min(100, Math.round((diffDays / contract.totalTargetDays) * 100));

  // Count clean trades executed during this attempt
  const cleanTradesSinceStart = trades.filter(t => {
    const tTs = new Date(t.tradeDate.split('/').reverse().join('-')).getTime();
    if (tTs < startTs) return false;
    return t.behaviorTag === 'Rules Followed' || t.behaviorTag === 'SL Hunt (Clean Variance)';
  }).length;

  const handleConfessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breachReason.trim()) return;
    onReportBreach(breachReason.trim(), breachCost.trim() || 'Lost 1R & streak reset to Day 1');
    setIsConfessingBreach(false);
    setBreachReason('');
    setBreachCost('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      {/* FIXED CONTAINER HEIGHT (ELIMINATES ALL VERTICAL RESIZING AND JUMPING) */}
      <div className="bg-[#08090E] border-2 border-emerald-500/40 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-[0_0_60px_rgba(16,185,129,0.15)] h-[540px] max-h-[92vh] flex flex-col font-mono text-xs overflow-hidden">
        
        {/* FROZEN TOP SECTION: STICKS IN ONE PLACE AT ALL TIMES */}
        <div className="shrink-0 space-y-3 pb-3 border-b border-white/[0.08]">
          {/* Header Bar */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                <Swords className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider truncate">
                    The Executioner Contract
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                    ATTEMPT {contract.currentAttempt} • DAY {diffDays} / {contract.totalTargetDays}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                  The 180-Day Zero-Fault Covenant between Pravin & Gemini AI.
                </p>
              </div>
            </div>

            <button onClick={onClose} className="p-1 rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clean 3-Tab Selector (Fixed in place, uniform size) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-center text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`py-2 px-3 rounded-xl transition-all border ${
                activeTab === 'status' 
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-md font-black' 
                  : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              HUD Status
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`py-2 px-3 rounded-xl transition-all border ${
                activeTab === 'rules' 
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-md font-black' 
                  : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              The Laws
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('graveyard')}
              className={`py-2 px-3 rounded-xl transition-all border ${
                activeTab === 'graveyard' 
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md font-black' 
                  : 'border-transparent text-zinc-400 hover:text-rose-300 hover:bg-white/[0.04]'
              }`}
            >
              Graveyard ({contract.history.length})
            </button>
          </div>
        </div>

        {/* SCROLLABLE INNER VIEWPORT (HEADER & TABS NEVER SHIFT) */}
        <div className="flex-1 overflow-y-auto pt-3.5 pr-1 space-y-4">
          
          {/* TAB 1: HUD STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Progress Bar */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-bold uppercase tracking-wider">
                    180-Day Execution Milestone
                  </span>
                  <span className="font-black text-emerald-400">
                    {diffDays} / {contract.totalTargetDays} Days ({progressPct}%)
                  </span>
                </div>

                <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-white/[0.06]">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-700 shadow-[0_0_15px_#10b981]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                  <span>Start: {contract.startDate}</span>
                  <span>Target: {contract.targetEndDate}</span>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-500 uppercase block">Current Attempt</span>
                  <span className="text-lg font-black text-white">#{contract.currentAttempt}</span>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-500 uppercase block">Days Left</span>
                  <span className="text-lg font-black text-cyan-300">{daysRemaining}d</span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[9px] text-emerald-400 uppercase block">Clean Streak</span>
                  <span className="text-lg font-black text-emerald-400">{cleanTradesSinceStart} Trades</span>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-500 uppercase block">Reset History</span>
                  <span className="text-lg font-black text-rose-400">-{contract.history.length}R</span>
                </div>
              </div>

              {/* Covenant Affirmation */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-black border border-emerald-500/30 text-[11px] text-emerald-200/90 leading-relaxed space-y-0.5">
                <p className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <Flame className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>The Covenant Rule:</span>
                </p>
                <p>
                  "A winning mechanical setup is worthless if the defense mechanism is abandoned. Every loss where rules are followed is an operating expense. Every trade where discipline is broken resets the clock to Day 1."
                </p>
              </div>

              {/* Self-Reporting Breach Trigger */}
              <div className="pt-1">
                {!isConfessingBreach ? (
                  <button
                    type="button"
                    onClick={() => setIsConfessingBreach(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-500/30 font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Report Discipline Breach (Self-Reset to Day 1)</span>
                  </button>
                ) : (
                  <form onSubmit={handleConfessSubmit} className="p-3 rounded-2xl bg-[#14080B] border border-rose-500/50 space-y-2.5 animate-in fade-in">
                    <span className="text-rose-300 font-bold block text-xs">
                      ⚠️ Confess Breach & Terminate Attempt #{contract.currentAttempt}:
                    </span>
                    <input
                      type="text"
                      value={breachReason}
                      onChange={(e) => setBreachReason(e.target.value)}
                      placeholder="Exact breach cause (e.g. Slept during active trade, failed to trail SL)"
                      className="w-full bg-black/60 border border-rose-500/40 rounded-xl p-2 text-white outline-none"
                      required
                    />
                    <input
                      type="text"
                      value={breachCost}
                      onChange={(e) => setBreachCost(e.target.value)}
                      placeholder="Capital/Emotional cost (e.g. -1.22R surrendered)"
                      className="w-full bg-black/60 border border-rose-500/40 rounded-xl p-2 text-white outline-none"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsConfessingBreach(false)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black shadow-lg"
                      >
                        Confirm Reset to Day 1
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: THE INVIOLABLE LAWS */}
          {activeTab === 'rules' && (
            <div className="space-y-2.5 animate-in fade-in duration-150 text-[11px]">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="font-bold text-cyan-300 block">Law 1: Strict 1% Max Capital Risk (1R)</span>
                <p className="text-zinc-400">Pre-calculate all entry levels and stop loss coordinates immediately. No active math during price movement.</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="font-bold text-cyan-300 block">Law 2: Main Zone Size Limit (&le; 0.33%)</span>
                <p className="text-zinc-400">If the Main Zone width exceeds 0.33% of the stock price, the trade is mathematically void. Skip immediately.</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="font-bold text-cyan-300 block">Law 3: Mandatory Trailing Defense</span>
                <p className="text-zinc-400">Once price meets your trailing threshold (e.g. LL break on Origin Retest, or HH break on B2B), trailing stop to Breakeven is mandatory. Never surrender a winning trade to a full loss.</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="font-bold text-cyan-300 block">Law 4: Absolute Desk Presence</span>
                <p className="text-zinc-400">Never leave the terminal or sleep while a position is open without an active, verified trailing stop placed in your broker.</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="font-bold text-rose-400 block">Law 5: The Reset Clause</span>
                <p className="text-zinc-400">A single unforced discipline error (impulse, revenge, or abandoned defense) shatters the contract immediately back to Day 1.</p>
              </div>
            </div>
          )}

          {/* TAB 3: THE GRAVEYARD (ATTEMPT #1: 26 SEP ➔ 03 NOV, 39 DAYS) */}
          {activeTab === 'graveyard' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-zinc-400 text-xs pb-0.5">
                <Skull className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Permanent record of past attempts. Truth is the only cure.</span>
              </div>

              {contract.history.map(item => (
                <div 
                  key={item.attemptNumber}
                  className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-1.5 font-mono"
                >
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="font-black text-rose-300 text-sm">
                      ATTEMPT #{item.attemptNumber} • FAILED ON DAY {item.failedDay || 39}
                    </span>
                    <span className="text-[10px] text-zinc-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                      {item.startDate} ➔ {item.endDate}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-300 leading-relaxed pt-0.5">
                    <strong className="text-rose-400">Cause: </strong>{item.failureReason}
                  </div>

                  {item.costNote && (
                    <div className="text-[10px] text-zinc-500 pt-1 border-t border-rose-500/20">
                      {item.costNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}