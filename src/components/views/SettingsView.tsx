'use client';

import React, { useState } from 'react';
import { CustomNumberInput } from '@/components/ui/CustomControls';
import { User } from 'firebase/auth';
import { Trade, PlaybookCollection, ChartSpecimen } from '@/types/trade';
import { runGlobalChartBackup } from '@/lib/chartBackup';
import { 
  Sliders, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Cloud, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  Shield, 
  KeyRound, 
  Eye, 
  EyeOff,
  AlertTriangle,
  FolderArchive,
  Loader2,
  X
} from 'lucide-react';

interface SettingsViewProps {
  defaultRisk: number;
  currentUser: User | null;
  securityPin: string;
  isLockEnabled: boolean;
  trades: Trade[];
  collections: PlaybookCollection[];
  studySpecimens: ChartSpecimen[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onUpdateSecurityPin: (newPin: string, enabled: boolean) => void;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onChangeDefaultRisk: (val: number) => void;
  onExport: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onForceSync: () => Promise<void>;
}

export function SettingsView({
  defaultRisk,
  currentUser,
  securityPin,
  isLockEnabled,
  trades,
  collections,
  studySpecimens,
  onShowToast,
  onUpdateSecurityPin,
  onGoogleLogin,
  onLogout,
  onChangeDefaultRisk,
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

  // Global Chart Backup Progress State
  const [isExportingCharts, setIsExportingCharts] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; message: string }>({
    current: 0,
    total: 0,
    message: ''
  });

  // Red Warning Wipe Modal State
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipePasswordInput, setWipePasswordInput] = useState('');
  const [wipeError, setWipeError] = useState('');

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

  const handleGlobalChartExport = async () => {
    if (isExportingCharts) return;

    setIsExportingCharts(true);
    setExportProgress({ current: 0, total: 0, message: 'Indexing chart specimens & executions...' });

    const result = await runGlobalChartBackup(
      trades,
      collections,
      studySpecimens,
      (current, total, message) => {
        setExportProgress({ current, total, message });
      }
    );

    setIsExportingCharts(false);

    if (result.success) {
      onShowToast(`Exported ${result.totalExported} charts into structured folders.`, 'success');
    } else if (result.error && result.error !== 'Export canceled by user.') {
      onShowToast(`Export error: ${result.error}`, 'error');
    }
  };

  const handleConfirmWipe = (e: React.FormEvent) => {
    e.preventDefault();
    setWipeError('');

    if (securityPin && securityPin.trim() !== '') {
      if (wipePasswordInput.trim() !== securityPin.trim()) {
        setWipeError('Incorrect security password / PIN.');
        return;
      }
    } else {
      if (wipePasswordInput.trim().toUpperCase() !== 'DELETE') {
        setWipeError('Please type DELETE to confirm.');
        return;
      }
    }

    setIsWipeModalOpen(false);
    setWipePasswordInput('');
    setWipeError('');
    onReset();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* 1. GOOGLE ACCOUNT & CLOUD SYNC SECTION */}
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

      {/* 2. TERMINAL SECURITY & PIN LOCK */}
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

      {/* 3. 1R CAPITAL BENCHMARK */}
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

      {/* 4. DATABASE BACKUP & GLOBAL CHART PORTABILITY */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Database Backup & Portability</h3>
            <p className="text-xs text-zinc-500">Download or restore JSON data snapshot & global chart folders.</p>
          </div>
        </div>

        {/* JSON Import/Export Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={onExport}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors border border-white/5"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Download JSON Backup</span>
          </button>
          
          <label className="cursor-pointer p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors border border-white/5">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload & Restore Backup</span>
            <input type="file" accept=".json" onChange={onRestore} className="hidden" />
          </label>
        </div>

        {/* Global Chart Backup Button */}
        <div className="pt-2 border-t border-white/[0.04]">
          <button
            type="button"
            onClick={handleGlobalChartExport}
            disabled={isExportingCharts}
            className="w-full p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] hover:border-cyan-500/40 text-zinc-300 hover:text-white text-xs font-mono flex items-center justify-between transition-all disabled:opacity-40 group"
          >
            <div className="flex items-center gap-2.5 truncate pr-2">
              <FolderArchive className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-left truncate">
                <span className="block font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                  {isExportingCharts 
                    ? `Exporting Global Charts (${exportProgress.current} / ${exportProgress.total})...` 
                    : 'Export Global Chart Backup (Folders & Subfolders)'}
                </span>
                <span className="text-[10px] text-zinc-500 block truncate">
                  {isExportingCharts && exportProgress.message
                    ? exportProgress.message
                    : 'Collections/[Category]/[Setup]/[Variant] & Executed Trades/[Year]/[Month]'}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1.5 font-bold text-cyan-400">
              {isExportingCharts ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-zinc-400 group-hover:text-cyan-300" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 5. DANGER ZONE */}
      <div className="p-4 rounded-2xl bg-rose-950/10 border border-rose-900/30 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-xs text-rose-300">Purge Complete Journal & Codex</h4>
          <p className="text-[11px] text-zinc-500">Permanently clears trades, playbook setups, and chart specimens.</p>
        </div>
        <button 
          onClick={() => {
            setWipePasswordInput('');
            setWipeError('');
            setIsWipeModalOpen(true);
          }} 
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-800 text-rose-400 hover:bg-rose-900 text-xs font-mono transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Wipe Clean</span>
        </button>
      </div>

      {/* RED DANGER WARNING POPUP MODAL WITH PASSWORD CHECK */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0D0507] border-2 border-rose-600/80 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-[0_0_50px_rgba(225,29,72,0.35)] animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/40">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-300 font-mono">
                    Permanent Purge Warning
                  </h3>
                  <span className="text-[10px] font-mono text-rose-400/80 uppercase tracking-widest font-bold">
                    Irreversible Action
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setIsWipeModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/30 text-rose-200/90 text-xs font-mono space-y-1.5">
              <p className="font-bold text-rose-300">
                Are you absolutely sure you want to wipe all records?
              </p>
              <p className="text-[11px] text-rose-200/70 leading-relaxed">
                This will irreversibly delete all executed trades, custom playbook collections, chart studies, and local database cache.
              </p>
            </div>

            <form onSubmit={handleConfirmWipe} className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-zinc-300 block mb-1 text-[11px]">
                  {securityPin ? 'Enter Master Security PIN / Password to authorize:' : 'Type DELETE in capital letters to confirm:'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoFocus
                    value={wipePasswordInput}
                    onChange={(e) => setWipePasswordInput(e.target.value)}
                    placeholder={securityPin ? 'Enter Security PIN' : 'Type DELETE'}
                    className="w-full bg-[#18080C] border border-rose-600/50 focus:border-rose-500 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none font-bold text-xs"
                  />
                </div>
                {wipeError && (
                  <p className="text-rose-400 text-[11px] mt-1.5 font-bold animate-in fade-in">
                    ⚠️ {wipeError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWipeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition-colors shadow-lg shadow-rose-600/30 flex items-center gap-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Authorize & Wipe Everything</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}