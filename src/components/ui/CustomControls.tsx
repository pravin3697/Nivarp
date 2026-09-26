'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlaybookCollection } from '@/types/trade';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

export function CustomNumberInput({
  value,
  onChange,
  step = 0.05,
  placeholder = '0.00',
  textColor = 'text-white',
  min,
  max
}: {
  value: number | string;
  onChange: (val: number) => void;
  step?: number;
  placeholder?: string;
  textColor?: string;
  min?: number;
  max?: number;
}) {
  const handleStep = (direction: 1 | -1) => {
    const current = typeof value === 'number' ? value : parseFloat(value as string) || 0;
    const next = Number((current + direction * step).toFixed(2));
    if (min !== undefined && next < min) return;
    if (max !== undefined && next > max) return;
    onChange(next);
  };

  return (
    <div className="relative flex items-center bg-[#090A10] border border-white/10 hover:border-white/20 focus-within:border-cyan-400/80 rounded-xl overflow-hidden transition-all shadow-inner group">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder={placeholder}
        className={`w-full bg-transparent px-3 py-2 text-xs font-mono font-bold ${textColor} outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
      <div className="flex flex-col border-l border-white/10 shrink-0 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => handleStep(1)}
          className="px-2 py-0.5 hover:bg-cyan-500/20 text-zinc-400 hover:text-cyan-300 transition-colors flex items-center justify-center"
          title="Increase"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => handleStep(-1)}
          className="px-2 py-0.5 hover:bg-cyan-500/20 text-zinc-400 hover:text-cyan-300 transition-colors border-t border-white/5 flex items-center justify-center"
          title="Decrease"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function CustomSetupDropdown({
  value,
  onChange,
  collections,
  categoryOrder
}: {
  value: string;
  onChange: (val: string) => void;
  collections: PlaybookCollection[];
  categoryOrder?: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sort collections strictly in the order of the Playbook Codex categories
  const orderedCollections = useMemo(() => {
    if (!categoryOrder || !categoryOrder.length) return collections;

    return [...collections].sort((a, b) => {
      const idxA = categoryOrder.indexOf(a.category);
      const idxB = categoryOrder.indexOf(b.category);

      const rankA = idxA === -1 ? 9999 : idxA;
      const rankB = idxB === -1 ? 9999 : idxB;

      if (rankA !== rankB) return rankA - rankB;
      return 0; // maintain setup order within category
    });
  }, [collections, categoryOrder]);

  const selectedCol = collections.find(c => c.name.toLowerCase() === value.toLowerCase());

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#090A10] border border-white/10 hover:border-cyan-500/50 focus:border-cyan-400 rounded-xl p-2.5 text-left text-xs font-mono flex items-center justify-between transition-all group shadow-inner"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
            {selectedCol ? selectedCol.name : (value || 'Select Codex Setup...')}
          </span>
          {selectedCol && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
              {selectedCol.category}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0C0D16] border border-white/15 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl max-h-64 overflow-y-auto py-1 divide-y divide-white/[0.04]">
          {orderedCollections.length === 0 ? (
            <div className="p-3 text-center text-zinc-500 text-xs font-mono">
              No setups found in Codex.
            </div>
          ) : (
            orderedCollections.map((col, idx) => {
              const isSelected = col.name.toLowerCase() === value.toLowerCase();
              const showCategoryHeader = idx === 0 || orderedCollections[idx - 1].category !== col.category;

              return (
                <React.Fragment key={col.id}>
                  {/* Category Section Heading matching Codex */}
                  {showCategoryHeader && (
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold bg-white/[0.02] flex items-center gap-1.5 border-t border-white/[0.04] first:border-t-0">
                      <span className="h-1 w-1 rounded-full bg-cyan-400" />
                      <span>{col.category}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onChange(col.name);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between transition-all ${
                      isSelected 
                        ? 'bg-cyan-500/10 text-cyan-300 font-bold' 
                        : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{col.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}