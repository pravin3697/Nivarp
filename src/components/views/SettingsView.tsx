'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CustomNumberInput } from '@/components/ui/CustomControls';
import { User } from 'firebase/auth';
import { 
  Sliders, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Cloud, 
  RefreshCw, 
  Smartphone, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  Shield, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Calculator, 
  AlertOctagon, 
  Copy, 
  Check, 
  TrendingUp, 
  TrendingDown
} from 'lucide-react';

interface SettingsViewProps {
  defaultRisk: number;
  tradingCapital: number;
  currentUser: User | null;
  securityPin: string;
  isLockEnabled: boolean;
  onUpdateSecurityPin: (newPin: string, enabled: boolean) => void;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onChangeDefaultRisk: (val: number) => void;
  onChangeTradingCapital: (val: number) => void;
  onExport: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onForceSync: () => Promise<void>;
}

const roundToTick = (val: number): number => {
  return Number((Math.round(val / 0.05) * 0.05).toFixed(2));
};

export function SettingsView({
  defaultRisk,
  tradingCapital,
  currentUser,
  securityPin,
  isLockEnabled,
  onUpdateSecurityPin,
  onGoogleLogin,
  onLogout,
  onChangeDefaultRisk,
  onChangeTradingCapital,
  onExport,
  onRestore,
  onReset,
  onForceSync
}: SettingsViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pinInput, setPinInput] = useState(securityPin || '');
  const [showPin, setShowPin] = useState(false);
  const [enabledToggle, setEnabledToggle] = useState(isLockEnabled);
  const [pinSavedFeedback, setPinSavedFeedback] = useState(false);

  // Mainzone Calculator Inputs
  const [zoneHighInput, setZoneHighInput] = useState<string>('261.00');
  const [zoneLowInput, setZoneLowInput] = useState<string>('260.64');
  const [capitalInput, setCapitalInput] = useState<string>(String(tradingCapital || 70000));
  const [copiedPrice, setCopiedPrice] = useState<string | null>(null);

  useEffect(() => {
    if (tradingCapital) {
      setCapitalInput(String(tradingCapital));
    }
  }, [tradingCapital]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onForceSync();
    setIsSyncing(false);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSecurityPin(pinInput.trim(), enabledToggle);
    setPinSavedFeedback(true);
    setTimeout(() => setPinSavedFeedback(false), 3000);
  };

  const handleCopy = (text: string | number, label: string) => {
    navigator.clipboard.writeText(String(text));
    setCopiedPrice(label);
    setTimeout(() => setCopiedPrice(null), 1500);
  };

  // Mainzone Math & Margin Sizing
  const zoneMath = useMemo(() => {
    const high = parseFloat(zoneHighInput) || 0;
    const low = parseFloat(zoneLowInput) || 0;
    const accountCapital = parseFloat(capitalInput) || 70000;
    const intradayLeverage = 5;

    if (high <= 0 || low <= 0) {
      return null;
    }

    const zoneWidth = Number((high - low).toFixed(2));
    const maxAllowedZone = Number((high * 0.0033).toFixed(2)); // 0.33% Max width
    const zoneWidthPct = Number(((zoneWidth / high) * 100).toFixed(3));
    const isZoneTooWide = zoneWidth > maxAllowedZone;

    // Gaps based on zoneHigh
    const reclaimGap = high * 0.0005; // 0.05%
    const retestGap = high * 0.001;   // 0.10% Penetration
    const slGap = high * 0.001;       // 0.10%

    // Max affordable shares at 5x leverage
    const maxAffordableQty = (entryPrice: number): number => {
      if (entryPrice <= 0) return 0;
      return Math.floor((accountCapital * intradayLeverage) / entryPrice);
    };

    // Calculate required margin cash for a given position at 5x leverage
    const calcRequiredMargin = (entryPrice: number, qty: number): number => {
      return Math.round((entryPrice * qty) / intradayLeverage);
    };

    // --- Bullish Coordinates (Liquidity Spring / Bearish To Bullish) ---
    const longReclaim = roundToTick(high + reclaimGap);
    const longRetest = roundToTick(high - retestGap);
    const longSL = roundToTick(low - slGap);

    const longReclaimRisk = Number(Math.max(0.05, longReclaim - longSL).toFixed(2));
    const longReclaimFullQty = Math.floor(defaultRisk / longReclaimRisk);
    const longReclaimFullMargin = calcRequiredMargin(longReclaim, longReclaimFullQty);
    const longReclaimCapQty = Math.min(longReclaimFullQty, maxAffordableQty(longReclaim));
    const isLongReclaimCapped = longReclaimFullQty > longReclaimCapQty;

    const longRetestRisk = Number(Math.max(0.05, longRetest - longSL).toFixed(2));
    const longRetestFullQty = Math.floor(defaultRisk / longRetestRisk);
    const longRetestFullMargin = calcRequiredMargin(longRetest, longRetestFullQty);
    const longRetestCapQty = Math.min(longRetestFullQty, maxAffordableQty(longRetest));
    const isLongRetestCapped = longRetestFullQty > longRetestCapQty;

    // --- Bearish Coordinates (Origin Retest / Overextended Pivot) ---
    const shortReclaim = roundToTick(low - reclaimGap);
    const shortRetest = roundToTick(low + retestGap);
    const shortSL = roundToTick(high + slGap);

    const shortReclaimRisk = Number(Math.max(0.05, shortSL - shortReclaim).toFixed(2));
    const shortReclaimFullQty = Math.floor(defaultRisk / shortReclaimRisk);
    const shortReclaimFullMargin = calcRequiredMargin(shortReclaim, shortReclaimFullQty);
    const shortReclaimCapQty = Math.min(shortReclaimFullQty, maxAffordableQty(shortReclaim));
    const isShortReclaimCapped = shortReclaimFullQty > shortReclaimCapQty;

    const shortRetestRisk = Number(Math.max(0.05, shortSL - shortRetest).toFixed(2));
    const shortRetestFullQty = Math.floor(defaultRisk / shortRetestRisk);
    const shortRetestFullMargin = calcRequiredMargin(shortRetest, shortRetestFullQty);
    const shortRetestCapQty = Math.min(shortRetestFullQty, maxAffordableQty(shortRetest));
    const isShortRetestCapped = shortRetestFullQty > shortRetestCapQty;

    return {
      high,
      low,
      accountCapital,
      zoneWidth,
      zoneWidthPct,
      maxAllowedZone,
      isZoneTooWide,
      reclaimGap: Number(reclaimGap.toFixed(2)),
      retestGap: Number(retestGap.toFixed(2)),
      slGap: Number(slGap.toFixed(2)),
      // Long
      longReclaim,
      longRetest,
      longSL,
      longReclaimFullQty,
      longReclaimFullMargin,
      longReclaimCapQty,
      isLongReclaimCapped,
      longRetestFullQty,
      longRetestFullMargin,
      longRetestCapQty,
      isLongRetestCapped,
      // Short
      shortReclaim,
      shortRetest,
      shortSL,
      shortReclaimFullQty,
      shortReclaimFullMargin,
      shortReclaimCapQty,
      isShortReclaimCapped,
      shortRetestFullQty,
      shortRetestFullMargin,
      shortRetestCapQty,
      isShortRetestCapped
    };
  }, [zoneHighInput, zoneLowInput, capitalInput, defaultRisk]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
      {/* LEFT COLUMN: Account, Security, Risk Benchmark & Backups */}
      <div className="xl:col-span-6 space-y-4 sm:space-y-6">
        {/* GOOGLE ACCOUNT & CLOUD SYNC SECTION */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-xl object-cover border border-cyan-400/40 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                  <Cloud className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">
                    {currentUser ? (currentUser.displayName || 'Google Account') : 'Multi-Device Cloud Account'}
                  </h3>
                  {currentUser && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Signed In
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  {currentUser 
                    ? `${currentUser.email} • Private cloud storage active`
                    : 'Sign in to access your journal privately from phone and desktop.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentUser ? (
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-mono text-xs transition-all w-full sm:w-auto"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch</span>
                </button>
              ) : (
                <button
                  onClick={onGoogleLogin}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs transition-all shadow-md w-full sm:w-auto"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign in</span>
                </button>
              )}

              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all w-full sm:w-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Force Sync'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* TERMINAL SECURITY LOCK PANEL */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0 border border-cyan-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Terminal Security & PIN Lock</span>
                {enabledToggle && pinInput && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500">
                Locks the journal behind a master PIN whenever you step away.
              </p>
            </div>
          </div>

          <form onSubmit={handleSavePin} className="space-y-3 pt-2 border-t border-white/[0.04]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 font-mono text-xs">
              <div className="relative flex-1">
                <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Set password or PIN"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-9 py-2 text-white outline-none focus:border-cyan-400 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEnabledToggle(prev => !prev)}
                  className={`px-3 py-2 rounded-xl font-bold transition-all border text-xs ${
                    enabledToggle
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'bg-zinc-900 text-zinc-500 border-white/10 hover:text-white'
                  }`}
                >
                  {enabledToggle ? 'Enabled' : 'Disabled'}
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-all text-xs"
                >
                  Save PIN
                </button>
              </div>
            </div>

            {pinSavedFeedback && (
              <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle className="w-3 h-3" />
                <span>Security PIN updated successfully.</span>
              </div>
            )}
          </form>
        </div>

        {/* 1R Capital Benchmark Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">1R Capital Benchmark</h3>
                <p className="text-xs text-zinc-500">
                  Risk denominator used for position sizing & converting Kotak net P&L into R.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-44 shrink-0">
              <CustomNumberInput 
                value={defaultRisk} 
                onChange={onChangeDefaultRisk} 
                step={50} 
                textColor="text-emerald-400" 
              />
            </div>
          </div>
        </div>

        {/* Full Database Backup & Restore */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Database Backup & Portability</h3>
              <p className="text-xs text-zinc-500">Download or restore complete JSON data snapshot.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={onExport}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" /><span>Download JSON Backup</span>
            </button>
            <label className="cursor-pointer p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors">
              <Upload className="w-3.5 h-3.5 text-emerald-400" /><span>Upload & Restore Backup</span>
              <input type="file" accept=".json" onChange={onRestore} className="hidden" />
            </label>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-4 rounded-2xl bg-rose-950/10 border border-rose-900/30 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-xs text-rose-300">Purge Complete Journal & Codex</h4>
            <p className="text-[11px] text-zinc-500">Permanently clears trades, playbook setups, and chart specimens.</p>
          </div>
          <button 
            onClick={onReset} 
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-800 text-rose-400 hover:bg-rose-900 text-xs font-mono transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Wipe Clean</span>
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: MAINZONE COORDINATES & MARGIN CALCULATOR */}
      <div className="xl:col-span-6 space-y-4">
        <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-cyan-500/30 shadow-[0_0_25px_rgba(34,211,238,0.08)] space-y-4">
          
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-white/[0.08] gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                  <span>Mainzone Coordinate Engine</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                    5x Margin Cap
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Exact order coordinates, rule percentages, and capital protection.
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-[11px] text-zinc-400 shrink-0">
              <span className="block text-zinc-500 text-[9px] uppercase">1R Risk Cap</span>
              <span className="font-black text-emerald-400">₹{defaultRisk}</span>
            </div>
          </div>

          {/* 3 Inputs: Zone High, Zone Low, and Trading Capital (Saved Permanently) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div>
              <label className="text-zinc-400 text-[11px] block mb-1">
                Zone High <span className="text-cyan-400 font-bold">(Top)</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={zoneHighInput}
                onChange={(e) => setZoneHighInput(e.target.value)}
                placeholder="e.g. 261.00"
                className="w-full bg-zinc-900/90 border border-white/15 focus:border-cyan-400 rounded-xl p-2.5 text-white font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-[11px] block mb-1">
                Zone Low <span className="text-purple-400 font-bold">(Bottom)</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={zoneLowInput}
                onChange={(e) => setZoneLowInput(e.target.value)}
                placeholder="e.g. 260.64"
                className="w-full bg-zinc-900/90 border border-white/15 focus:border-cyan-400 rounded-xl p-2.5 text-white font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-[11px] block mb-1 flex items-center justify-between">
                <span>Account Capital</span>
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
                  if (parsed && parsed > 0) {
                    onChangeTradingCapital(parsed);
                  }
                }}
                placeholder="70000"
                className="w-full bg-zinc-900/90 border border-white/15 focus:border-emerald-400 rounded-xl p-2.5 text-emerald-300 font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* ZONE WIDTH VALIDATION STATUS (0.33% GATEKEEPER) */}
          {zoneMath && (
            <div>
              {zoneMath.isZoneTooWide ? (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/60 text-rose-300 font-mono text-xs flex items-center justify-between gap-3 animate-in fade-in shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <span className="font-black text-rose-300 block text-xs">TRADE VOID: ZONE TOO WIDE</span>
                      <span className="text-[10px] text-zinc-400">
                        Width is ₹{zoneMath.zoneWidth} ({zoneMath.zoneWidthPct}%) &gt; Max allowed ₹{zoneMath.maxAllowedZone} (0.33%)
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500 text-black font-black uppercase shrink-0">
                    Skip Trade
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-[11px]">
                      ZONE VALID: ₹{zoneMath.zoneWidth} ({zoneMath.zoneWidthPct}%) within max ₹{zoneMath.maxAllowedZone} (0.33%)
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    Reclaim ±0.05% / Retest ±0.10% / SL ±0.10%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* DUAL COORDINATE RESULTS */}
          {zoneMath && (
            <div className="space-y-3.5 pt-1">
              {/* 1. BULLISH COORDINATES (Liquidity Spring / Bearish To Bullish) */}
              <div className="p-3.5 rounded-xl bg-white/[0.015] border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                  <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>Liquidity Spring / Bearish To Bullish</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    SL: <strong className="text-rose-400">₹{zoneMath.longSL}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                  {/* Long Entry (Reclaim) */}
                  <div 
                    onClick={() => handleCopy(zoneMath.longReclaim, 'longReclaim')}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                        <span>Long (Reclaim)</span>
                        {copiedPrice === 'longReclaim' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400" />}
                      </div>
                      <div className="text-base font-black text-emerald-400">
                        ₹{zoneMath.longReclaim}
                      </div>
                      <span className="text-[9px] text-zinc-500 block">High + 0.05%</span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.06] space-y-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Full 1R ({zoneMath.longReclaimFullQty} QTY):</span>
                        <span className="text-cyan-300 font-bold">₹{zoneMath.longReclaimFullMargin.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
                        <span className="text-zinc-400">Your Cap ({Math.round(zoneMath.accountCapital / 1000)}k):</span>
                        <div className="flex items-center gap-1">
                          {zoneMath.isLongReclaimCapped && (
                            <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">CAP</span>
                          )}
                          <span className="text-emerald-300 font-black px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30">
                            {zoneMath.longReclaimCapQty} QTY
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Long Entry (Retest) */}
                  <div 
                    onClick={() => handleCopy(zoneMath.longRetest, 'longRetest')}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                        <span>Long (Retest)</span>
                        {copiedPrice === 'longRetest' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400" />}
                      </div>
                      <div className="text-base font-black text-cyan-300">
                        ₹{zoneMath.longRetest}
                      </div>
                      <span className="text-[9px] text-zinc-500 block">High - 0.10%</span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.06] space-y-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Full 1R ({zoneMath.longRetestFullQty} QTY):</span>
                        <span className="text-cyan-300 font-bold">₹{zoneMath.longRetestFullMargin.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
                        <span className="text-zinc-400">Your Cap ({Math.round(zoneMath.accountCapital / 1000)}k):</span>
                        <div className="flex items-center gap-1">
                          {zoneMath.isLongRetestCapped && (
                            <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">CAP</span>
                          )}
                          <span className="text-cyan-300 font-black px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-500/30">
                            {zoneMath.longRetestCapQty} QTY
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Long Invalidation SL */}
                  <div 
                    onClick={() => handleCopy(zoneMath.longSL, 'longSL')}
                    className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 hover:border-rose-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-rose-400 uppercase mb-0.5">
                        <span>Long Stoploss</span>
                        {copiedPrice === 'longSL' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-rose-400" />}
                      </div>
                      <div className="text-base font-black text-rose-400">
                        ₹{zoneMath.longSL}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-rose-500/20 flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500 font-bold">Low - 0.10%</span>
                      <span className="text-rose-400 font-bold">Invalidation</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. BEARISH COORDINATES (Origin Retest / Overextended Pivot) */}
              <div className="p-3.5 rounded-xl bg-white/[0.015] border border-rose-500/30 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                  <span className="font-mono text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" />
                    <span>Origin Retest / Overextended Pivot</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    SL: <strong className="text-rose-400">₹{zoneMath.shortSL}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                  {/* Short Entry (Reclaim / Breakdown) */}
                  <div 
                    onClick={() => handleCopy(zoneMath.shortReclaim, 'shortReclaim')}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-rose-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                        <span>Short (Reclaim)</span>
                        {copiedPrice === 'shortReclaim' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-600 group-hover:text-rose-400" />}
                      </div>
                      <div className="text-base font-black text-rose-400">
                        ₹{zoneMath.shortReclaim}
                      </div>
                      <span className="text-[9px] text-zinc-500 block">Low - 0.05%</span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.06] space-y-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Full 1R ({zoneMath.shortReclaimFullQty} QTY):</span>
                        <span className="text-cyan-300 font-bold">₹{zoneMath.shortReclaimFullMargin.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
                        <span className="text-zinc-400">Your Cap ({Math.round(zoneMath.accountCapital / 1000)}k):</span>
                        <div className="flex items-center gap-1">
                          {zoneMath.isShortReclaimCapped && (
                            <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">CAP</span>
                          )}
                          <span className="text-rose-300 font-black px-1.5 py-0.2 rounded bg-rose-500/15 border border-rose-500/30">
                            {zoneMath.shortReclaimCapQty} QTY
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Short Entry (Retest) */}
                  <div 
                    onClick={() => handleCopy(zoneMath.shortRetest, 'shortRetest')}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-rose-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                        <span>Short (Retest)</span>
                        {copiedPrice === 'shortRetest' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-600 group-hover:text-rose-400" />}
                      </div>
                      <div className="text-base font-black text-amber-300">
                        ₹{zoneMath.shortRetest}
                      </div>
                      <span className="text-[9px] text-zinc-500 block">Low + 0.10%</span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.06] space-y-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Full 1R ({zoneMath.shortRetestFullQty} QTY):</span>
                        <span className="text-cyan-300 font-bold">₹{zoneMath.shortRetestFullMargin.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
                        <span className="text-zinc-400">Your Cap ({Math.round(zoneMath.accountCapital / 1000)}k):</span>
                        <div className="flex items-center gap-1">
                          {zoneMath.isShortRetestCapped && (
                            <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">CAP</span>
                          )}
                          <span className="text-amber-300 font-black px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30">
                            {zoneMath.shortRetestCapQty} QTY
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Short Invalidation SL */}
                  <div 
                    onClick={() => handleCopy(zoneMath.shortSL, 'shortSL')}
                    className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 hover:border-rose-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-rose-400 uppercase mb-0.5">
                        <span>Short Stoploss</span>
                        {copiedPrice === 'shortSL' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-rose-400" />}
                      </div>
                      <div className="text-base font-black text-rose-400">
                        ₹{zoneMath.shortSL}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-rose-500/20 flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500 font-bold">High + 0.10%</span>
                      <span className="text-rose-400 font-bold">Invalidation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 flex items-center justify-between">
            <span>Click any box to copy price • 5x Intraday MIS Margin Protection</span>
            <span>Standard NSE 0.05 Tick</span>
          </div>

        </div>
      </div>
    </div>
  );
}