'use client';

import React, { useState } from 'react';
import { CustomNumberInput } from '@/components/ui/CustomControls';
import { User } from 'firebase/auth';
import { Sliders, Database, Download, Upload, Trash2, Cloud, RefreshCw, Smartphone, LogIn, LogOut, CheckCircle } from 'lucide-react';

interface SettingsViewProps {
  defaultRisk: number;
  currentUser: User | null;
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
  onGoogleLogin,
  onLogout,
  onChangeDefaultRisk,
  onExport,
  onRestore,
  onReset,
  onForceSync
}: SettingsViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onForceSync();
    setIsSyncing(false);
  };

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      {/* GOOGLE ACCOUNT & CLOUD SYNC SECTION */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
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
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-mono text-xs transition-all w-full sm:w-auto"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch / Sign Out</span>
              </button>
            ) : (
              <button
                onClick={onGoogleLogin}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs transition-all shadow-md w-full sm:w-auto"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in with Google</span>
              </button>
            )}

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all w-full sm:w-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Force Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1R Risk Benchmark */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">1R Capital Benchmark</h3>
              <p className="text-xs text-zinc-500">
                Denominator used to normalize Kotak Neo net P&L into R-multiples across your journal.
              </p>
            </div>
          </div>

          <div className="w-full sm:w-48 shrink-0">
            <CustomNumberInput 
              value={defaultRisk} 
              onChange={onChangeDefaultRisk} 
              step={100} 
              textColor="text-emerald-400" 
            />
          </div>
        </div>
      </div>

      {/* Full Database Backup & Restore */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Database Backup & Portability</h3>
            <p className="text-xs text-zinc-500">Download or restore complete JSON data snapshot.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onExport}
            className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-cyan-400" /><span>Download JSON Backup</span>
          </button>
          <label className="cursor-pointer p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono flex items-center justify-center gap-2 transition-colors">
            <Upload className="w-4 h-4 text-emerald-400" /><span>Upload & Restore Backup</span>
            <input type="file" accept=".json" onChange={onRestore} className="hidden" />
          </label>
        </div>
      </div>

      {/* App Installation Guide Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#090A10] border border-white/[0.06] space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Install on Mobile (Android / iOS) & Windows</h3>
            <p className="text-xs text-zinc-500">Run Nivarp OS natively without browser address bars.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono text-zinc-400">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
            <strong className="text-white block font-sans">Android / Chrome:</strong>
            Tap the 3 dots menu in your browser & select <span className="text-cyan-400">"Install app"</span> or <span className="text-cyan-400">"Add to Home screen"</span>.
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
            <strong className="text-white block font-sans">Windows / Edge / Chrome:</strong>
            Click the install icon on the right side of the URL bar to run as a standalone Windows desktop app.
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-4 sm:p-6 rounded-2xl bg-rose-950/10 border border-rose-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-xs text-rose-300">Purge Complete Journal & Codex</h4>
          <p className="text-[11px] text-zinc-500">Permanently clears all trades, playbook setups, and chart specimens from both local storage and cloud database.</p>
        </div>
        <button 
          onClick={onReset} 
          className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-800 text-rose-400 hover:bg-rose-900 text-xs font-mono transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Wipe Clean</span>
        </button>
      </div>
    </div>
  );
}