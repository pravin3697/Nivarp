'use client';

import React, { useState, useEffect } from 'react';
import { Trade, PlaybookCollection, BehavioralTag } from '@/types/trade';
import { CustomNumberInput, CustomSetupDropdown } from '@/components/ui/CustomControls';
import { uploadScreenshotToCloud } from '@/lib/cloudSync';
import { X, ImagePlus, Sparkles, Pencil, Clipboard, Check, Loader2 } from 'lucide-react';

export const BEHAVIORAL_TAGS: { label: BehavioralTag; color: string; border: string; bg: string }[] = [
  { label: 'Rules Followed', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  { label: 'No Confirmation Entry', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { label: 'SL Hunt / Slippage Hunt', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
  { label: 'Hallucinated Trade', color: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/10' },
];

export function EditDebriefModal({
  isOpen,
  trade,
  collections,
  onClose,
  onSave
}: {
  isOpen: boolean;
  trade: Trade | null;
  collections: PlaybookCollection[];
  onClose: () => void;
  onSave: (updated: Trade) => void;
}) {
  const [form, setForm] = useState<Trade | null>(trade);
  const [isUploading, setIsUploading] = useState<'image1' | 'image2' | null>(null);

  useEffect(() => {
    setForm(trade);
  }, [trade]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;

          e.preventDefault();
          const targetField = !form?.image2 ? 'image2' : 'image1';
          setIsUploading(targetField);

          const cloudUrl = await uploadScreenshotToCloud(file);
          if (cloudUrl) {
            setForm(prev => prev ? { ...prev, [targetField]: cloudUrl } : null);
          } else {
            const reader = new FileReader();
            reader.onload = (event) => {
              const b64 = event.target?.result as string;
              setForm(prev => prev ? { ...prev, [targetField]: b64 } : null);
            };
            reader.readAsDataURL(file);
          }
          setIsUploading(null);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, form]);

  if (!isOpen || !form) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#090A10] border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">{form.symbol}</span>
            <span className="text-xs text-zinc-400 font-mono">({form.tradeDate})</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4 text-xs font-mono">
          <div>
            <label className="text-zinc-400 block mb-1.5 flex items-center justify-between">
              <span>Behavioral Execution Tag</span>
              <span className="text-[10px] text-zinc-500">Pick discipline state</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BEHAVIORAL_TAGS.map(tag => {
                const isSelected = form.behaviorTag === tag.label;
                return (
                  <button
                    type="button"
                    key={tag.label}
                    onClick={() => setForm({ ...form, behaviorTag: tag.label })}
                    className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all flex items-center justify-center gap-1.5 ${
                      isSelected 
                        ? `${tag.bg} ${tag.color} ${tag.border} ring-1 ring-white/20 shadow-md` 
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Playbook Setup</label>
            <CustomSetupDropdown
              value={form.setupType}
              onChange={(val) => setForm({ ...form, setupType: val })}
              collections={collections}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div>
              <label className="text-zinc-400 block mb-1 text-[11px]">Stoploss Price (SL)</label>
              <CustomNumberInput
                value={form.slPrice || ''}
                onChange={(val) => setForm({ ...form, slPrice: val })}
                step={0.05}
                textColor="text-rose-400"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1 text-[11px]">MAE (Max Heat)</label>
              <input
                type="text"
                value={form.mae || ''}
                onChange={(e) => setForm({ ...form, mae: e.target.value })}
                placeholder="-0.5R"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white outline-none"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1 text-[11px]">MFE (Max Peak)</label>
              <input
                type="text"
                value={form.mfe || ''}
                onChange={(e) => setForm({ ...form, mfe: e.target.value })}
                placeholder="+2.0R"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-emerald-400 font-bold outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-400 text-[11px]">Chart 1 (HTF Context Link)</label>
                <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                  <Clipboard className="w-2.5 h-2.5" /> Direct paste supported
                </span>
              </div>
              <input
                type="text"
                value={form.image1 || ''}
                onChange={(e) => setForm({ ...form, image1: e.target.value })}
                placeholder="Paste URL or press Ctrl + V anywhere"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-emerald-400 text-[11px] flex items-center gap-1">
                  <span>Chart 2 (LTF Execution Link — Syncs to Codex)</span>
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                </label>
                {isUploading === 'image2' && (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading pasted screenshot...
                  </span>
                )}
              </div>
              <input
                type="text"
                value={form.image2 || ''}
                onChange={(e) => setForm({ ...form, image2: e.target.value })}
                placeholder="Paste URL or press Ctrl + V anywhere"
                className="w-full bg-zinc-900 border border-emerald-500/30 rounded-xl p-2.5 text-emerald-400 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Debrief & Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Execution review, psychological triggers, takeaways..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white outline-none h-20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 shadow-lg"
            >
              Save Debrief
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditCollectionModal({
  isOpen,
  collection,
  onClose,
  onSave
}: {
  isOpen: boolean;
  collection: PlaybookCollection | null;
  onClose: () => void;
  onSave: (updated: PlaybookCollection) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setCategory(collection.category);
      setDescription(collection.description || '');
    }
  }, [collection]);

  if (!isOpen || !collection) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#090A10] border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Pencil className="w-4 h-4 text-cyan-400" />
            Edit Setup Collection
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !category.trim()) return;
            onSave({
              ...collection,
              name: name.trim(),
              category: category.trim().toUpperCase(),
              description: description.trim()
            });
          }}
          className="space-y-4 text-xs font-mono"
        >
          <div>
            <label className="text-zinc-400 block mb-1">Category / Group Heading</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. BREAKOUT MODELS"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Setup Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invalidation Retest"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Rules / Strategy Trigger</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rules, trigger conditions..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-white outline-none h-24"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cyan-500 text-black font-bold rounded-lg shadow-lg"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddStudyModal({
  isOpen,
  collectionName,
  suggestedSymbols,
  onClose,
  onSave
}: {
  isOpen: boolean;
  collectionName: string;
  suggestedSymbols: string[];
  onClose: () => void;
  onSave: (symbol: string, url: string) => void;
}) {
  const [symbol, setSymbol] = useState('');
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;

          e.preventDefault();
          setIsUploading(true);

          const cloudUrl = await uploadScreenshotToCloud(file);
          if (cloudUrl) {
            setUrl(cloudUrl);
          } else {
            const reader = new FileReader();
            reader.onload = (event) => {
              setUrl(event.target?.result as string);
            };
            reader.readAsDataURL(file);
          }

          setIsUploading(false);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#090A10] border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-amber-400" />
          Add Study Chart to "{collectionName}"
        </h3>
        
        <form onSubmit={(e) => { e.preventDefault(); onSave(symbol.trim(), url.trim()); setSymbol(''); setUrl(''); }} className="space-y-4 text-xs font-mono">
          <div>
            <label className="text-zinc-400 block mb-1">Symbol / Asset</label>
            <input 
              type="text" 
              list="ticker-suggestions"
              value={symbol} 
              onChange={e => setSymbol(e.target.value)} 
              placeholder="e.g. DLF, TATAMOTORS, HINDALCO..." 
              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-white outline-none"
              required 
            />

            <datalist id="ticker-suggestions">
              {suggestedSymbols.map(sym => (
                <option key={sym} value={sym} />
              ))}
            </datalist>

            {suggestedSymbols.length > 0 && (
              <div className="pt-2 space-y-1">
                <div className="text-[10px] text-zinc-500">Recent Tickers:</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {suggestedSymbols.slice(0, 6).map((sym) => (
                    <button
                      type="button"
                      key={sym}
                      onClick={() => setSymbol(sym)}
                      className="px-2 py-0.5 rounded bg-white/[0.04] text-[10px] font-mono text-zinc-300 border border-white/10 hover:border-amber-400"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-zinc-400">Screenshot Image Link / Paste</label>
              {isUploading && (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading screenshot...
                </span>
              )}
            </div>

            <div 
              className={`p-3 rounded-xl border border-dashed text-center transition-all cursor-pointer ${
                url 
                  ? 'border-emerald-500/40 bg-emerald-500/5' 
                  : 'border-white/15 bg-white/[0.02] hover:border-amber-400/50'
              }`}
              onClick={() => {
                navigator.clipboard?.read().then(async items => {
                  for (const item of items) {
                    const imgType = item.types.find(t => t.startsWith('image/'));
                    if (imgType) {
                      const blob = await item.getType(imgType);
                      const file = new File([blob], 'screenshot.png', { type: imgType });
                      setIsUploading(true);
                      const cloudUrl = await uploadScreenshotToCloud(file);
                      setUrl(cloudUrl || URL.createObjectURL(blob));
                      setIsUploading(false);
                      break;
                    }
                  }
                }).catch(() => {});
              }}
            >
              {url ? (
                <div className="space-y-2">
                  <img src={url} alt="Preview" className="h-28 mx-auto rounded-lg object-contain shadow-md" />
                  <span className="text-[10px] text-emerald-400 font-bold block">✓ Screenshot Loaded (Click or press Ctrl + V to replace)</span>
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  <Clipboard className="w-6 h-6 text-amber-400 mx-auto" />
                  <span className="text-xs font-bold text-zinc-200 block">Press Ctrl + V anywhere to paste screenshot</span>
                  <span className="text-[10px] text-zinc-500 block">or paste a direct image / TradingView URL below</span>
                </div>
              )}
            </div>

            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="Or paste https://www.tradingview.com/x/... link here" 
              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-white outline-none mt-2"
              required 
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={!url || isUploading}
              className="px-5 py-2 rounded-lg bg-amber-400 text-black font-bold hover:bg-amber-300 transition-colors disabled:opacity-40"
            >
              Save Specimen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}