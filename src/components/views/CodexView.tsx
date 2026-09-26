'use client';

import React, { useState } from 'react';
import { Trade, PlaybookCollection, ChartSpecimen } from '@/types/trade';
import { ChartGalleryItem } from '@/components/modals/ChartInspector';
import { 
  BookMarked, 
  FolderOpen, 
  Plus, 
  ArrowLeft, 
  ImagePlus, 
  Trash2, 
  Pencil, 
  GripVertical,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

export interface CodexViewProps {
  collections: PlaybookCollection[];
  uniqueCategories: string[];
  selectedCollection: PlaybookCollection | null;
  activeCollectionSpecimens: ChartSpecimen[];
  trades: Trade[];
  studySpecimens: ChartSpecimen[];
  onSelectCollection: (col: PlaybookCollection | null) => void;
  onOpenAddCollection: () => void;
  onOpenEditCollection: (col: PlaybookCollection) => void;
  onOpenAddStudy: () => void;
  onDeleteCollection: (id: string, name: string) => void;
  onDeleteSpecimen: (id: string) => void;
  onReorderSpecimens: (reordered: ChartSpecimen[]) => void;
  onReorderCategories: (reordered: string[]) => void;
  onReorderCollections?: (reordered: PlaybookCollection[]) => void;
  onOpenInspector: (url: string, title: string, index?: number, items?: ChartGalleryItem[]) => void;
}

const cleanStr = (s?: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

export function sortSetupsSmartly(a: PlaybookCollection, b: PlaybookCollection): number {
  const nameA = cleanStr(a.name);
  const nameB = cleanStr(b.name);

  const baseA = nameA.replace(/^(failed|extended)\s+/i, '');
  const baseB = nameB.replace(/^(failed|extended)\s+/i, '');

  const getRank = (name: string) => {
    if (name.includes('failed')) return 3;
    if (name.includes('extended')) return 2;
    return 1;
  };

  if (baseA === baseB) {
    return getRank(nameA) - getRank(nameB);
  }

  const isFailedA = nameA.includes('failed');
  const isFailedB = nameB.includes('failed');
  if (isFailedA !== isFailedB) {
    return isFailedA ? 1 : -1;
  }

  return baseA.localeCompare(baseB);
}

export function CodexView({
  collections,
  uniqueCategories,
  selectedCollection,
  activeCollectionSpecimens,
  trades,
  studySpecimens,
  onSelectCollection,
  onOpenAddCollection,
  onOpenEditCollection,
  onOpenAddStudy,
  onDeleteCollection,
  onDeleteSpecimen,
  onReorderSpecimens,
  onReorderCategories,
  onReorderCollections,
  onOpenInspector
}: CodexViewProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [draggedCatIdx, setDraggedCatIdx] = useState<number | null>(null);
  const [dragOverCatIdx, setDragOverCatIdx] = useState<number | null>(null);

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIdx !== index) setDragOverIdx(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...activeCollectionSpecimens];
    const [movedItem] = updated.splice(draggedIdx, 1);
    updated.splice(dropIndex, 0, movedItem);
    onReorderSpecimens(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleCatDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCatIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCatDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverCatIdx !== index) setDragOverCatIdx(index);
  };

  const handleCatDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedCatIdx === null || draggedCatIdx === dropIndex) {
      setDraggedCatIdx(null);
      setDragOverCatIdx(null);
      return;
    }
    const updated = [...uniqueCategories];
    const [moved] = updated.splice(draggedCatIdx, 1);
    updated.splice(dropIndex, 0, moved);
    onReorderCategories(updated);
    setDraggedCatIdx(null);
    setDragOverCatIdx(null);
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= uniqueCategories.length) return;
    const updated = [...uniqueCategories];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    onReorderCategories(updated);
  };

  const handleCardDragStart = (e: React.DragEvent, colId: string) => {
    e.stopPropagation();
    setDraggedCardId(colId);
  };

  const handleCardDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverCardId !== colId) setDragOverCardId(colId);
  };

  const handleCardDrop = (e: React.DragEvent, targetCol: PlaybookCollection, categoryCollections: PlaybookCollection[]) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCardId || draggedCardId === targetCol.id || !onReorderCollections) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }
    const fromIdx = categoryCollections.findIndex(c => c.id === draggedCardId);
    const toIdx = categoryCollections.findIndex(c => c.id === targetCol.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const reorderedCat = [...categoryCollections];
    const [moved] = reorderedCat.splice(fromIdx, 1);
    reorderedCat.splice(toIdx, 0, moved);

    const otherCols = collections.filter(c => cleanStr(c.category) !== cleanStr(targetCol.category));
    onReorderCollections([...reorderedCat, ...otherCols]);
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const currentSetupGallery: ChartGalleryItem[] = activeCollectionSpecimens.map(s => ({
    url: s.imageUrl,
    title: s.title
  }));

  return (
    <div className="space-y-6">
      {!selectedCollection ? (
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-cyan-400" />
                The Playbook Codex
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Visual trading blueprints & verified setup models.</p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={onOpenAddCollection} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold"
              >
                <Plus className="w-3.5 h-3.5" /><span>New Setup</span>
              </button>
            </div>
          </div>

          {collections.length === 0 ? (
            <div className="p-10 sm:p-16 text-center rounded-2xl bg-[#090A10] border border-dashed border-white/10 space-y-3">
              <FolderOpen className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400/50 mx-auto" />
              <h3 className="text-base font-bold text-white">Your Codex is Empty</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                No playbook collections created yet. Add your strategies to categorize charts.
              </p>
              <button
                onClick={onOpenAddCollection}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-mono font-bold"
              >
                <Plus className="w-4 h-4" /><span>Create Setup</span>
              </button>
            </div>
          ) : (
            uniqueCategories.map((cat, catIdx) => {
              const catCollections = collections
                .filter(c => cleanStr(c.category) === cleanStr(cat))
                .sort(sortSetupsSmartly);

              const isBeingDragged = draggedCatIdx === catIdx;
              const isDragOver = dragOverCatIdx === catIdx && draggedCatIdx !== catIdx;

              return (
                <div 
                  key={cat} 
                  onDragOver={(e) => handleCatDragOver(e, catIdx)}
                  onDrop={(e) => handleCatDrop(e, catIdx)}
                  className={`space-y-3.5 p-2.5 sm:p-3 rounded-2xl transition-all ${
                    isBeingDragged 
                      ? 'opacity-35 border-2 border-dashed border-cyan-500/50' 
                      : isDragOver 
                        ? 'border-2 border-cyan-400/80 bg-cyan-500/5' 
                        : 'border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1">
                    <div 
                      draggable
                      onDragStart={(e) => handleCatDragStart(e, catIdx)}
                      onDragEnd={() => { setDraggedCatIdx(null); setDragOverCatIdx(null); }}
                      className="flex items-center gap-2 cursor-grab select-none"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline" />
                      <h3 className="font-mono text-xs uppercase tracking-wider text-cyan-400 font-bold">
                        {cat}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                        {catCollections.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-[#0C0E18] border border-white/10 rounded-lg p-0.5">
                      <button
                        onClick={() => handleMoveCategory(catIdx, 'up')}
                        disabled={catIdx === 0}
                        className="p-1 text-zinc-400 hover:text-cyan-300 disabled:opacity-20"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveCategory(catIdx, 'down')}
                        disabled={catIdx === uniqueCategories.length - 1}
                        className="p-1 text-zinc-400 hover:text-cyan-300 disabled:opacity-20"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {catCollections.map(col => {
                      const colClean = cleanStr(col.name);
                      const tradedForThis = trades.filter(t => cleanStr(t.setupType) === colClean);
                      const studyForThis = studySpecimens.filter(s => {
                        if (s.collectionId && col.id && s.collectionId === col.id) return true;
                        return cleanStr(s.collectionName) === colClean;
                      });

                      let chartCount = studyForThis.length;
                      tradedForThis.forEach(t => { if (t.image2 || t.image1) chartCount++; });

                      const previewImage = studyForThis[0]?.imageUrl || tradedForThis.find(t => t.image2 || t.image1)?.image2;

                      return (
                        <div 
                          key={col.id} 
                          draggable
                          onDragStart={(e) => handleCardDragStart(e, col.id)}
                          onDragOver={(e) => handleCardDragOver(e, col.id)}
                          onDrop={(e) => handleCardDrop(e, col, catCollections)}
                          onDragEnd={() => { setDraggedCardId(null); setDragOverCardId(null); }}
                          onClick={() => onSelectCollection(col)} 
                          className="relative p-3.5 sm:p-4 rounded-2xl bg-[#090A10] border border-white/[0.08] hover:border-cyan-500/50 cursor-pointer flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-center justify-between pb-1">
                              <h4 className="font-bold text-sm text-white group-hover:text-cyan-400 truncate">
                                {col.name}
                              </h4>
                              <div className="flex items-center gap-1 shrink-0">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onOpenEditCollection(col); }} 
                                  className="text-zinc-500 hover:text-cyan-400 p-1"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onDeleteCollection(col.id, col.name); }} 
                                  className="text-zinc-500 hover:text-rose-400 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 w-full h-28 sm:h-32 rounded-xl bg-black/40 overflow-hidden relative flex items-center justify-center">
                              {previewImage ? (
                                <img
                                  src={previewImage}
                                  alt={col.name}
                                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100"
                                />
                              ) : (
                                <span className="text-[10px] font-mono text-zinc-500">
                                  No specimen archived
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-white/[0.05] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                            <span>{chartCount} Charts</span>
                            <span className="text-cyan-400">Open →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onSelectCollection(null)} 
                className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-black text-white">{selectedCollection.name}</h2>
                  <button 
                    onClick={() => onOpenEditCollection(selectedCollection)}
                    className="p-1 rounded text-zinc-400 hover:text-cyan-400"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            
            <button 
              onClick={onOpenAddStudy} 
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-mono font-bold w-full sm:w-auto justify-center"
            >
              <ImagePlus className="w-4 h-4" /><span>Add Study Chart</span>
            </button>
          </div>

          {activeCollectionSpecimens.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#090A10] border border-white/[0.06] text-zinc-500 font-mono text-xs">
              No chart specimens archived for this setup yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {activeCollectionSpecimens.map((specimen, idx) => (
                <div 
                  key={specimen.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className="group relative rounded-xl bg-[#090A10] border border-white/[0.08] overflow-hidden"
                >
                  <div className="relative h-56 sm:h-60 w-full bg-black select-none">
                    <img 
                      src={specimen.imageUrl} 
                      alt={specimen.title} 
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100" 
                      onClick={() => onOpenInspector(specimen.imageUrl, specimen.title, idx, currentSetupGallery)} 
                    />

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSpecimen(specimen.id);
                      }}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-white/15 z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 flex items-center justify-between text-[11px] font-mono pointer-events-none">
                      <span className="font-bold text-white truncate max-w-[70%]">{specimen.title}</span>
                      <span className="text-zinc-400 text-[10px]">{specimen.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}