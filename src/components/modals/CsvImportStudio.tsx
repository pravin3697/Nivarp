'use client';

import React, { useState, useEffect } from 'react';
import { Trade, PlaybookCollection } from '@/types/trade';
import { CustomNumberInput, CustomSetupDropdown } from '@/components/ui/CustomControls';
import { uploadScreenshotToCloud } from '@/lib/cloudSync';
import { BEHAVIORAL_TAGS } from '@/components/modals/TradeModals';
import { FileSpreadsheet, X, UploadCloud, Sparkles, Clipboard, Check, Loader2, Clock } from 'lucide-react';

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
              <p className="text-xs text-zinc-500 mt-1">Trades will automatically extract entry & exit execution times.</p>
              <div className="mt-5">
                <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-mono font-bold shadow-lg hover:bg-emerald-400 transition-all">
                  <span>Browse CSV File</span>
                  <input type="file" accept=".csv" onChange={onFileUpload} className="hidden" />
                </label>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs font-mono text-zinc-400">
              <span className="text-zinc-300 font-bold">1R Capital Benchmark:</span> ₹{defaultRisk.toLocaleString('en-IN')}. Net P&L includes brokerage, GST, and STT deduction.
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono bg-white/[0.02] p-3 rounded-xl border border-white/[0.04] gap-1">
              <span className="text-emerald-400 font-bold">✓ Matched {csvPreview.length} Trades in {csvFileName}</span>
              <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                <Clipboard className="w-3 h-3 text-cyan-400" /> Focus chart box & press <strong>Ctrl + V</strong> to paste directly
              </span>
            </div>

            <div className="space-y-3">
              {csvPreview.map((trade, idx) => {
                const isGreen = trade.rMultiple >= 0;
                const isCurrentTrade = activePasteIndex === idx;

                return (
                  <div 
                    key={idx} 
                    className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] hover:border-white/20 transition-all space-y-3"
                  >
                    {/* Header Row: Symbol, Date, & Exact Execution Timing */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">#{idx + 1}</span>
                        <span className="text-sm font-black text-white">{trade.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          trade.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {trade.direction}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">({trade.tradeDate})</span>
                        
                        {/* Display Entry -> Exit Timing Badge */}
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-mono text-cyan-300">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>{trade.tradeTime || '09:15 - 15:30'}</span>
                          {trade.durationMinutes ? <span className="text-zinc-400">({trade.durationMinutes}m)</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-zinc-400 text-[11px]">{trade.quantity} QTY</span>
                        <span className={`font-bold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isGreen ? '+' : ''}{trade.rMultiple}R
                        </span>
                      </div>
                    </div>

                    {/* Behavioral Tag Pills */}
                    <div>
                      <label className="text-zinc-400 text-[11px] font-mono block mb-1">Behavioral Execution Tag</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {BEHAVIORAL_TAGS.map(tag => {
                          const isSelected = trade.behaviorTag === tag.label;
                          return (
                            <button
                              type="button"
                              key={tag.label}
                              onClick={() => onUpdateTrade(idx, 'behaviorTag', tag.label)}
                              className={`p-1.5 rounded-lg border text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1 ${
                                isSelected 
                                  ? `${tag.bg} ${tag.color} ${tag.border} ring-1 ring-white/20 shadow-sm` 
                                  : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 shrink-0" />}
                              <span className="truncate">{tag.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Playbook Setup Selection */}
                    <div>
                      <label className="text-zinc-400 text-[11px] font-mono block mb-1">Playbook Setup</label>
                      <CustomSetupDropdown
                        value={trade.setupType}
                        onChange={(val) => onUpdateTrade(idx, 'setupType', val)}
                        collections={collections}
                      />
                    </div>

                    {/* Execution Parameters (SL, MAE, MFE, and Trade Execution Time) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs font-mono">
                      <div>
                        <label className="text-zinc-400 text-[10px] block mb-1">Stoploss (SL)</label>
                        <CustomNumberInput
                          value={trade.slPrice || ''}
                          onChange={(val) => onUpdateTrade(idx, 'slPrice', val)}
                          step={0.05}
                          textColor="text-rose-400"
                        />
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
                          placeholder="e.g. 09:18 - 09:26"
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