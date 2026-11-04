'use client';

import React, { useState, useEffect } from 'react';
import { Trade, PlaybookCollection } from '@/types/trade';
import { CustomSetupDropdown } from '@/components/ui/CustomControls';
import { uploadScreenshotToCloud } from '@/lib/cloudSync';
import { FileSpreadsheet, X, UploadCloud, Sparkles, Clipboard, Check, Loader2, Clock, ShieldCheck, Zap, Ruler } from 'lucide-react';

interface CsvImportStudioProps {
  isOpen: boolean;
  onClose: () => void;
  csvPreview: Trade[];
  csvFileName: string;
  defaultRisk: number;
  collections: PlaybookCollection[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdateTrade: (index: number, field: keyof Trade, value: any) => void;
  onResetPreview: () => void;
  onConfirmImport: () => void;
}

export function CsvImportStudio({
  isOpen,
  onClose,
  csvPreview,
  csvFileName,
  defaultRisk,
  collections,
  onFileUpload,
  onUpdateTrade,
  onResetPreview,
  onConfirmImport
}: CsvImportStudioProps) {
  const [activePasteIndex, setActivePasteIndex] = useState<number | null>(null);
  const [activePasteField, setActivePasteField] = useState<'image1' | 'image2'>('image1');
  const [uploadingState, setUploadingState] = useState<{ idx: number; field: 'image1' | 'image2' } | null>(null);

  useEffect(() => {
    if (!isOpen || csvPreview.length === 0) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;

          e.preventDefault();
          const targetIndex = activePasteIndex !== null ? activePasteIndex : 0;
          const targetField = activePasteField;

          setUploadingState({ idx: targetIndex, field: targetField });

          const cloudUrl = await uploadScreenshotToCloud(file);
          if (cloudUrl) {
            onUpdateTrade(targetIndex, targetField, cloudUrl);
          } else {
            const reader = new FileReader();
            reader.onload = (event) => {
              onUpdateTrade(targetIndex, targetField, event.target?.result as string);
            };
            reader.readAsDataURL(file);
          }

          if (targetField === 'image1') {
            setActivePasteField('image2');
          }

          setUploadingState(null);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, csvPreview, activePasteIndex, activePasteField, onUpdateTrade]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#090A10] border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
        
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
            <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span className="truncate">Kotak Neo Statement Importer</span>
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {csvPreview.length === 0 ? (
          <div className="space-y-4 py-8 flex-1 flex flex-col justify-center">
            <div className="border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl p-6 sm:p-10 text-center transition-all bg-white/[0.01]">
              <UploadCloud className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-white">Select Kotak Neo Transaction_Statement.csv</p>
              <p className="text-xs text-zinc-500 mt-1">Automatic order matching, volume-weighted averaging & raw net P&L auditing.</p>
              <div className="mt-5">
                <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-mono font-bold shadow-lg hover:bg-emerald-400 transition-all">
                  <span>Browse CSV File</span>
                  <input type="file" accept=".csv" onChange={onFileUpload} className="hidden" />
                </label>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs font-mono text-zinc-400">
              <span className="text-zinc-300 font-bold">1R Capital Benchmark:</span> ₹{defaultRisk.toLocaleString('en-IN')}. Net P&L preserves your exact broker statement P&L after all taxes and brokerage deductions.
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono bg-white/[0.02] p-3 rounded-xl border border-white/[0.04] gap-1">
              <span className="text-emerald-400 font-bold">✓ Matched {csvPreview.length} Completed Trades in {csvFileName}</span>
              <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                <Clipboard className="w-3 h-3 text-cyan-400" /> Focus chart box & press <strong>Ctrl + V</strong> to paste directly
              </span>
            </div>

            <div className="space-y-3">
              {csvPreview.map((trade, idx) => {
                const isGreen = trade.netPnl >= 0;
                const isCurrentTrade = activePasteIndex === idx;

                const isBearToBull = /bearish\s+to\s+bullish|bull\s+to\s+bear/i.test(trade.setupType || '');
                const isLiquiditySpring = /liquidity\s+spring/i.test(trade.setupType || '');

                const isSlHuntActive = 
                  trade.behaviorTag === 'SL Hunt (Clean Variance)' || 
                  trade.behaviorTag === 'SL Hunt (Defense Abandoned)' || 
                  trade.behaviorTag === 'SL Hunt / Slippage Hunt';

                return (
                  <div 
                    key={idx} 
                    className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] hover:border-white/20 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">#{idx + 1}</span>
                        <span className="text-sm font-black text-white">{trade.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          trade.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {trade.direction}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">({trade.tradeDate})</span>
                        
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-mono text-cyan-300">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>{trade.tradeTime || '09:15 - 15:30'}</span>
                          {trade.durationMinutes ? <span className="text-zinc-400">({trade.durationMinutes}m)</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-zinc-400 text-[11px]">{trade.quantity} QTY</span>
                        <span className="text-zinc-500 text-[10px]">Taxes: ₹{trade.fees}</span>

                        <span className={`font-bold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isGreen ? '+₹' : '-₹'}{Math.abs(trade.netPnl).toLocaleString('en-IN')}
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                          isGreen ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isGreen ? '+' : ''}{trade.rMultiple}R
                        </span>
                      </div>
                    </div>

                    {/* BEHAVIORAL TAG SELECTOR (WITH SPLIT SL HUNT) */}
                    <div>
                      <label className="text-zinc-400 text-[11px] font-mono block mb-1">Behavioral Execution Tag</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {/* Rules Followed */}
                        <button
                          type="button"
                          onClick={() => onUpdateTrade(idx, 'behaviorTag', 'Rules Followed')}
                          className={`p-1.5 rounded-lg border text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1 ${
                            trade.behaviorTag === 'Rules Followed'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                              : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {trade.behaviorTag === 'Rules Followed' && <Check className="w-2.5 h-2.5 shrink-0" />}
                          <span className="truncate">Rules Followed</span>
                        </button>

                        {/* SL Hunt */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isSlHuntActive) {
                              onUpdateTrade(idx, 'behaviorTag', 'SL Hunt (Clean Variance)');
                            }
                          }}
                          className={`p-1.5 rounded-lg border text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1 ${
                            isSlHuntActive
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                              : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {isSlHuntActive && <Check className="w-2.5 h-2.5 shrink-0" />}
                          <span className="truncate">SL Hunt / Slippage</span>
                        </button>

                        {/* No Confirmation */}
                        <button
                          type="button"
                          onClick={() => onUpdateTrade(idx, 'behaviorTag', 'No Confirmation Entry')}
                          className={`p-1.5 rounded-lg border text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1 ${
                            trade.behaviorTag === 'No Confirmation Entry'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                              : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {trade.behaviorTag === 'No Confirmation Entry' && <Check className="w-2.5 h-2.5 shrink-0" />}
                          <span className="truncate">No Confirmation</span>
                        </button>

                        {/* Hallucinated */}
                        <button
                          type="button"
                          onClick={() => onUpdateTrade(idx, 'behaviorTag', 'Hallucinated Trade')}
                          className={`p-1.5 rounded-lg border text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1 ${
                            trade.behaviorTag === 'Hallucinated Trade'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-sm'
                              : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {trade.behaviorTag === 'Hallucinated Trade' && <Check className="w-2.5 h-2.5 shrink-0" />}
                          <span className="truncate">Hallucinated</span>
                        </button>
                      </div>

                      {/* SL Hunt Sub-selection */}
                      {isSlHuntActive && (
                        <div className="mt-1.5 p-2 rounded-lg bg-purple-950/20 border border-purple-500/25 grid grid-cols-2 gap-1.5 animate-in fade-in duration-100">
                          <button
                            type="button"
                            onClick={() => onUpdateTrade(idx, 'behaviorTag', 'SL Hunt (Clean Variance)')}
                            className={`p-1 rounded text-[10px] font-mono text-center border transition-all ${
                              trade.behaviorTag === 'SL Hunt (Clean Variance)' || trade.behaviorTag === 'SL Hunt / Slippage Hunt'
                                ? 'bg-purple-500/25 text-purple-200 border-purple-400 font-bold'
                                : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            🟣 Clean Variance (Pre-move)
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateTrade(idx, 'behaviorTag', 'SL Hunt (Defense Abandoned)')}
                            className={`p-1 rounded text-[10px] font-mono text-center border transition-all ${
                              trade.behaviorTag === 'SL Hunt (Defense Abandoned)'
                                ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 font-bold'
                                : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            ⚠️ Defense Abandoned (Slept/Trail)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Playbook Setup Selection */}
                    <div>
                      <label className="text-zinc-400 text-[11px] font-mono block mb-1">Playbook Setup</label>
                      <CustomSetupDropdown
                        value={trade.setupType}
                        onChange={(val) => {
                          onUpdateTrade(idx, 'setupType', val);
                          if (/bearish\s+to\s+bullish|bull\s+to\s+bear/i.test(val)) {
                            onUpdateTrade(idx, 'setupSubtype', 'Resistance');
                          } else if (/liquidity\s+spring/i.test(val)) {
                            onUpdateTrade(idx, 'setupSubtype', 'Standard Spring');
                          } else {
                            onUpdateTrade(idx, 'setupSubtype', 'General');
                          }
                        }}
                        collections={collections}
                      />
                    </div>

                    {/* DYNAMIC SUBHEADING SELECTORS */}
                    {isBearToBull && (
                      <div className="p-2.5 rounded-xl bg-white/[0.015] border border-white/[0.06] space-y-1.5 animate-in fade-in duration-150">
                        <label className="text-cyan-400 text-[11px] font-mono font-bold flex items-center justify-between">
                          <span>Subheading Variant (Bearish To Bullish)</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Zone confirmation behavior</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateTrade(idx, 'setupSubtype', 'Resistance')}
                            className={`p-2 rounded-xl border text-xs font-bold text-left transition-all flex items-center justify-between ${
                              trade.setupSubtype === 'Resistance'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 ring-1 ring-cyan-500/30'
                                : 'bg-[#090A10] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <div>
                                <span className="block font-bold">Resistance</span>
                                <span className="text-[9px] text-zinc-500 font-normal">Mainzone entry</span>
                              </div>
                            </div>
                            {trade.setupSubtype === 'Resistance' && <Check className="w-3 h-3 text-cyan-400" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateTrade(idx, 'setupSubtype', 'No Resistance')}
                            className={`p-2 rounded-xl border text-xs font-bold text-left transition-all flex items-center justify-between ${
                              trade.setupSubtype === 'No Resistance'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 ring-1 ring-purple-500/30'
                                : 'bg-[#090A10] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <div>
                                <span className="block font-bold">No Resistance</span>
                                <span className="text-[9px] text-zinc-500 font-normal">Liquidity sweep</span>
                              </div>
                            </div>
                            {trade.setupSubtype === 'No Resistance' && <Check className="w-3 h-3 text-purple-400" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {isLiquiditySpring && (
                      <div className="p-2.5 rounded-xl bg-white/[0.015] border border-white/[0.06] space-y-1.5 animate-in fade-in duration-150">
                        <label className="text-emerald-400 text-[11px] font-mono font-bold flex items-center justify-between">
                          <span>Subheading Variant (Liquidity Spring)</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Sweep depth & timing</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateTrade(idx, 'setupSubtype', 'Standard Spring')}
                            className={`p-2 rounded-xl border text-xs font-bold text-left transition-all flex items-center justify-between ${
                              trade.setupSubtype === 'Standard Spring'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                : 'bg-[#090A10] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div>
                              <span className="block font-bold text-[11px]">Standard</span>
                              <span className="text-[9px] text-zinc-500 font-normal">Clean sweep</span>
                            </div>
                            {trade.setupSubtype === 'Standard Spring' && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateTrade(idx, 'setupSubtype', 'Extended Spring')}
                            className={`p-2 rounded-xl border text-xs font-bold text-left transition-all flex items-center justify-between ${
                              trade.setupSubtype === 'Extended Spring'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 ring-1 ring-cyan-500/30'
                                : 'bg-[#090A10] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div>
                              <span className="block font-bold text-[11px]">Extended</span>
                              <span className="text-[9px] text-zinc-500 font-normal">Deep wick</span>
                            </div>
                            {trade.setupSubtype === 'Extended Spring' && <Check className="w-3 h-3 text-cyan-400" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateTrade(idx, 'setupSubtype', 'Pre 10AM')}
                            className={`p-2 rounded-xl border text-xs font-bold text-left transition-all flex items-center justify-between ${
                              trade.setupSubtype === 'Pre 10AM'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/30'
                                : 'bg-[#090A10] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div>
                              <span className="block font-bold text-[11px]">Pre 10 AM</span>
                              <span className="text-[9px] text-zinc-500 font-normal">09:15 - 10:00</span>
                            </div>
                            {trade.setupSubtype === 'Pre 10AM' && <Check className="w-3 h-3 text-amber-400" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PARAMETERS + MAINZONE HEIGHT (%) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs font-mono">
                      <div>
                        <label className="text-zinc-400 text-[10px] block mb-1 flex items-center gap-1">
                          <Ruler className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Mainzone Height (%)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.001"
                            value={trade.mainzoneHeightPct !== undefined ? trade.mainzoneHeightPct : ''}
                            onChange={(e) => onUpdateTrade(idx, 'mainzoneHeightPct', parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 0.138"
                            className={`w-full bg-[#090A10] border rounded-xl p-2 font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              trade.mainzoneHeightPct && trade.mainzoneHeightPct > 0.33 
                                ? 'border-rose-500/60 text-rose-400' 
                                : 'border-white/10 text-cyan-300 focus:border-cyan-400'
                            }`}
                          />
                          {trade.mainzoneHeightPct !== undefined && trade.mainzoneHeightPct > 0 && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">
                              %
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-zinc-400 text-[10px] block mb-1">MAE (Heat Taken)</label>
                        <input
                          type="text"
                          value={trade.mae || ''}
                          onChange={(e) => onUpdateTrade(idx, 'mae', e.target.value)}
                          placeholder="-0.5R"
                          className="w-full bg-[#090A10] border border-white/10 rounded-xl p-2 text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 text-[10px] block mb-1">MFE (Peak Run)</label>
                        <input
                          type="text"
                          value={trade.mfe || ''}
                          onChange={(e) => onUpdateTrade(idx, 'mfe', e.target.value)}
                          placeholder="+2.0R"
                          className="w-full bg-[#090A10] border border-white/10 rounded-xl p-2 text-emerald-400 font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 text-[10px] block mb-1">Execution Time Range</label>
                        <input
                          type="text"
                          value={trade.tradeTime || ''}
                          onChange={(e) => onUpdateTrade(idx, 'tradeTime', e.target.value)}
                          placeholder="e.g. 10:12 AM - 10:14 AM"
                          className="w-full bg-[#090A10] border border-white/10 rounded-xl p-2 text-cyan-300 font-bold outline-none"
                        />
                      </div>
                    </div>

                    {/* Dual Chart Links */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-zinc-400 text-[10px]">Chart 1 (HTF Context Link)</label>
                          {uploadingState?.idx === idx && uploadingState?.field === 'image1' && (
                            <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Pasting...
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={trade.image1 || ''}
                          onFocus={() => {
                            setActivePasteIndex(idx);
                            setActivePasteField('image1');
                          }}
                          onChange={(e) => onUpdateTrade(idx, 'image1', e.target.value)}
                          placeholder="Click & press Ctrl + V (or paste URL)"
                          className={`w-full bg-[#090A10] rounded-xl p-2 text-cyan-400 outline-none transition-all ${
                            isCurrentTrade && activePasteField === 'image1' 
                              ? 'border border-cyan-400 ring-1 ring-cyan-400/40' 
                              : 'border border-white/10 focus:border-cyan-400'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-emerald-400 text-[10px] flex items-center gap-1">
                            <span>Chart 2 (LTF Execution Link)</span>
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                          </label>
                          {uploadingState?.idx === idx && uploadingState?.field === 'image2' && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Pasting...
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={trade.image2 || ''}
                          onFocus={() => {
                            setActivePasteIndex(idx);
                            setActivePasteField('image2');
                          }}
                          onChange={(e) => onUpdateTrade(idx, 'image2', e.target.value)}
                          placeholder="Click & press Ctrl + V (or paste URL)"
                          className={`w-full bg-[#090A10] rounded-xl p-2 text-emerald-400 outline-none transition-all ${
                            isCurrentTrade && activePasteField === 'image2' 
                              ? 'border border-emerald-400 ring-1 ring-emerald-400/40' 
                              : 'border border-emerald-500/30 focus:border-emerald-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] shrink-0 gap-3">
              <button
                onClick={onResetPreview}
                className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs font-mono"
              >
                Change File
              </button>
              <button
                onClick={onConfirmImport}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-mono font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
              >
                Import All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}