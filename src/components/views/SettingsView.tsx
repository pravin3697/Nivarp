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
  TrendingDown, 
  Zap, 
  RotateCcw, 
  Target
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

  // Active Setup Tab ('spring' | 'b2b' | 'origin' | 'pivot')
  const [activeSetupTab, setActiveSetupTab] = useState<'spring' | 'b2b' | 'origin' | 'pivot'>('spring');

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

  // Mainzone Math with 35% Depth & Capital Margin Audit
  const zoneMath = useMemo(() => {
    const high = parseFloat(zoneHighInput) || 0;
    const low = parseFloat(zoneLowInput) || 0;
    const accountCapital = parseFloat(capitalInput) || 70000;
    const intradayLeverage = 5;
    const totalBuyingPower = accountCapital * intradayLeverage;

    if (high <= 0 || low <= 0) {
      return null;
    }

    const zoneWidth = Number((high - low).toFixed(2));
    const maxAllowedZone = Number((high * 0.0033).toFixed(2)); // 0.33% Max allowed width
    const zoneWidthPct = Number(((zoneWidth / high) * 100).toFixed(3));
    const isZoneTooWide = zoneWidth > maxAllowedZone;

    // Buffer gaps
    const reclaimGap = high * 0.0005; // 0.05% of price
    const slGap = high * 0.001;       // 0.10% of price
    const penetration35 = zoneWidth * 0.35; // 35% of zone width
    const penetrationPct = Number(((penetration35 / high) * 100).toFixed(2));

    const maxAffordableQty = (entryPrice: number): number => {
      if (entryPrice <= 0) return 0;
      return Math.floor(totalBuyingPower / entryPrice);
    };

    const calcSetupMetrics = (entryPrice: number, slPrice: number, isShort: boolean) => {
      const riskPerShare = Number(Math.max(0.05, isShort ? slPrice - entryPrice : entryPrice - slPrice).toFixed(2));
      const idealFullQty = Math.floor(defaultRisk / riskPerShare);
      const maxShares = maxAffordableQty(entryPrice);
      const cappedQty = Math.min(idealFullQty, maxShares);
      const isCapped = idealFullQty > maxShares;

      const totalTradeValue = Math.round(entryPrice * cappedQty);
      const marginUsed = Math.round(totalTradeValue / intradayLeverage);
      const marginFree = Math.max(0, accountCapital - marginUsed);

      const actualRupeeRisk = Math.round(cappedQty * riskPerShare);
      const actualREffective = Number((actualRupeeRisk / defaultRisk).toFixed(2));

      return {
        entryPrice,
        slPrice,
        riskPerShare,
        idealFullQty,
        cappedQty,
        isCapped,
        totalTradeValue,
        marginUsed,
        marginFree,
        actualRupeeRisk,
        actualREffective
      };
    };

    // 1. Liquidity Spring (Long Reclaim)
    const springEntry = roundToTick(high + reclaimGap);
    const springSL = roundToTick(low - slGap);
    const spring = calcSetupMetrics(springEntry, springSL, false);

    // 2. Bearish To Bullish (Long Retest 35% from Top)
    const b2bEntry = roundToTick(high - penetration35);
    const b2bSL = roundToTick(low - slGap);
    const b2b = calcSetupMetrics(b2bEntry, b2bSL, false);

    // 3. Origin Retest (Short Retest 35% from Bottom)
    const originEntry = roundToTick(low + penetration35);
    const originSL = roundToTick(high + slGap);
    const origin = calcSetupMetrics(originEntry, originSL, true);

    // 4. Overextended Pivot (Short Retest 35% from Bottom)
    const pivotEntry = roundToTick(low + penetration35);
    const pivotSL = roundToTick(high + slGap);
    const pivot = calcSetupMetrics(pivotEntry, pivotSL, true);

    return {
      high,
      low,
      accountCapital,
      zoneWidthPct,
      maxAllowedZone,
      isZoneTooWide,
      penetrationPct,
      spring,
      b2b,
      origin,
      pivot
    };
  }, [zoneHighInput, zoneLowInput, capitalInput, defaultRisk]);

  const activeData = useMemo(() => {
    if (!zoneMath) return null;
    if (activeSetupTab === 'spring') return { ...zoneMath.spring, label: 'Liquidity Spring (Long Reclaim)', rule: 'High + 0.05%' };
    if (activeSetupTab === 'b2b') return { ...zoneMath.b2b, label: 'Bearish To Bullish (Long Retest)', rule: 'High - 35% Depth' };
    if (activeSetupTab === 'origin') return { ...zoneMath.origin, label: 'Origin Retest (Short Retest)', rule: 'Low + 35% Depth' };
    return { ...zoneMath.pivot, label: 'Overextended Pivot (Short Retest)', rule: 'Low + 35% Depth' };
  }, [zoneMath, activeSetupTab]);

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

      {/* RIGHT COLUMN: MAINZONE COORDINATES (CLEAN PERCENTAGE WIDTH ONLY) */}
      <div className="xl:col-span-6 space-y-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-cyan-500/30 shadow-[0_0_25px_rgba(34,211,238,0.08)] space-y-3.5">
          
          {/* Header */}
          <div className="flex items-start justify-between pb-2.5 border-b border-white/[0.08] gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                  <span>Mainzone Coordinate Engine</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                    Live Sizing
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Select your setup model to view exact order price coordinates & risk.
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-[11px] text-zinc-400 shrink-0">
              <span className="block text-zinc-500 text-[9px] uppercase">1R Risk Cap</span>
              <span className="font-black text-emerald-400">₹{defaultRisk}</span>
            </div>
          </div>

          {/* 3 Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">
                Zone High <span className="text-cyan-400 font-bold">(Top)</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={zoneHighInput}
                onChange={(e) => setZoneHighInput(e.target.value)}
                placeholder="261.00"
                className="w-full bg-zinc-900/90 border border-white/15 focus:border-cyan-400 rounded-xl px-2.5 py-2 text-white font-bold outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-[10px] block mb-1">
                Zone Low <span className="text-purple-400 font-bold">(Bottom)</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={zoneLowInput}
                onChange={(e) => setZoneLowInput(e.target.value)}
                placeholder="260.64"
                className="w-full bg-zinc-900/90 border border-white/15 focus:border-cyan-400 rounded-xl px-2.5 py-2 text-white font-bold outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-[10px] block mb-1 flex items-center justify-between">
                <span>Account Cash</span>
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
                  if (parsed && parsed > 0) onChangeTradingCapital(parsed);
                }}
                placeholder="70000"
                className="w-full bg-zinc-900/90 border border-white/15 focus:border-emerald-400 rounded-xl px-2.5 py-2 text-emerald-300 font-black outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* ZONE WIDTH VALIDATION STATUS (CLEAN PERCENTAGE ONLY) */}
          {zoneMath && (
            <div>
              {zoneMath.isZoneTooWide ? (
                <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/60 text-rose-300 font-mono text-[11px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-bold">TRADE VOID: ZONE TOO WIDE ({zoneMath.zoneWidthPct}% &gt; 0.33%)</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500 text-black font-black uppercase">Skip</span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>ZONE VALID: {zoneMath.zoneWidthPct}%</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    35% Retest Depth = ±{zoneMath.penetrationPct}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* FULL SETUP TABS */}
          {zoneMath && activeData && (
            <div className="space-y-3 pt-1">
              {/* Full Setup Name Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSetupTab('spring')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    activeSetupTab === 'spring'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold shadow-sm'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="block text-[11px] font-bold">⚡ Liquidity Spring</span>
                  <span className="text-[9px] text-zinc-500">Reclaim</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSetupTab('b2b')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    activeSetupTab === 'b2b'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold shadow-sm'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="block text-[11px] font-bold">📈 Bearish To Bullish</span>
                  <span className="text-[9px] text-zinc-500">35% Retest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSetupTab('origin')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    activeSetupTab === 'origin'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold shadow-sm'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="block text-[11px] font-bold">🔄 Origin Retest</span>
                  <span className="text-[9px] text-zinc-500">35% Short</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSetupTab('pivot')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    activeSetupTab === 'pivot'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-sm'
                      : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="block text-[11px] font-bold">🎯 Overextended Pivot</span>
                  <span className="text-[9px] text-zinc-500">35% Short</span>
                </button>
              </div>

              {/* FOCUSED SETUP RESULT CARD */}
              <div className="p-4 rounded-xl bg-white/[0.015] border border-white/10 space-y-3 font-mono">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    {activeData.label}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Risk/Share: <strong className="text-white">₹{activeData.riskPerShare}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Entry Price Box */}
                  <div
                    onClick={() => handleCopy(activeData.entryPrice, 'entry')}
                    className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-cyan-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase mb-1">
                        <span>Limit Entry</span>
                        {copiedPrice === 'entry' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400" />}
                      </div>
                      <div className="text-xl font-black text-white">
                        ₹{activeData.entryPrice}
                      </div>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">
                        {activeData.rule}
                      </span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-zinc-500 text-[10px]">Position Size:</span>
                      <span className="text-emerald-300 font-black px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-xs">
                        {activeData.cappedQty} QTY
                      </span>
                    </div>
                  </div>

                  {/* Stop Loss Price Box */}
                  <div
                    onClick={() => handleCopy(activeData.slPrice, 'sl')}
                    className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 hover:border-rose-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-rose-400 uppercase mb-1">
                        <span>Stop Loss (SL)</span>
                        {copiedPrice === 'sl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-rose-400" />}
                      </div>
                      <div className="text-xl font-black text-rose-400">
                        ₹{activeData.slPrice}
                      </div>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">
                        Invalidation Buffer (0.10%)
                      </span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-rose-500/20 text-[10px] text-zinc-400 flex items-center justify-between">
                      <span>1R Benchmark</span>
                      <span className="text-rose-400 font-bold">-₹{defaultRisk}</span>
                    </div>
                  </div>
                </div>

                {/* DETAILED CAPITAL, MARGIN & REALIZED RISK AUDIT STRIP */}
                <div className="p-2.5 rounded-xl bg-black/50 border border-white/[0.06] text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase">Trade Value</span>
                    <span className="text-zinc-200 font-bold">₹{activeData.totalTradeValue.toLocaleString('en-IN')}</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase">Margin Used (5x)</span>
                    <span className="text-cyan-300 font-bold">₹{activeData.marginUsed.toLocaleString('en-IN')}</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase">Margin Left</span>
                    <span className="text-zinc-400 font-bold">₹{activeData.marginFree.toLocaleString('en-IN')}</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase">Actual Risk Taken</span>
                    <span className={`font-black ${activeData.isCapped ? 'text-amber-400' : 'text-emerald-400'}`}>
                      ₹{activeData.actualRupeeRisk} ({activeData.actualREffective}R)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 flex items-center justify-between">
            <span>Click any box to copy price • 5x MIS Margin Sized</span>
            <span>NSE 0.05 Tick</span>
          </div>

        </div>
      </div>
    </div>
  );
}