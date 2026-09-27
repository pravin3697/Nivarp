'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical, 
  Copy, 
  Link2, 
  Download, 
  ExternalLink, 
  Info,
  Check,
  Loader2
} from 'lucide-react';

export interface ChartGalleryItem {
  url: string;
  title: string;
  htfUrl?: string;
  ltfUrl?: string;
}

interface ChartInspectorProps {
  isOpen: boolean;
  title: string;
  initialUrl: string;
  htfUrl?: string;
  ltfUrl?: string;
  items?: ChartGalleryItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function ChartInspector({ 
  isOpen, 
  title, 
  initialUrl, 
  htfUrl, 
  ltfUrl, 
  items = [], 
  initialIndex = 0,
  onClose 
}: ChartInspectorProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentHtf, setCurrentHtf] = useState(htfUrl);
  const [currentLtf, setCurrentLtf] = useState(ltfUrl);

  const [zoomScale, setZoomScale] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);

  // Context Menu & Details State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [copiedAction, setCopiedAction] = useState<'image' | 'link' | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number; sizeStr?: string }>({ width: 0, height: 0 });

  const menuRef = useRef<HTMLDivElement>(null);
  const hasMultiple = items && items.length > 1;

  useEffect(() => {
    if (isOpen) {
      if (items.length > 0 && initialIndex >= 0 && initialIndex < items.length) {
        setCurrentIndex(initialIndex);
        const target = items[initialIndex];
        setCurrentUrl(target.url);
        setCurrentTitle(target.title);
        setCurrentHtf(target.htfUrl);
        setCurrentLtf(target.ltfUrl);
      } else {
        setCurrentIndex(0);
        setCurrentUrl(initialUrl);
        setCurrentTitle(title);
        setCurrentHtf(htfUrl);
        setCurrentLtf(ltfUrl);
      }
      setZoomScale(1);
      setPanPosition({ x: 0, y: 0 });
      setIsMenuOpen(false);
      setIsDetailsOpen(false);
    }
  }, [isOpen, initialUrl, title, htfUrl, ltfUrl, items, initialIndex]);

  // Read natural image resolution
  useEffect(() => {
    if (!currentUrl) return;
    const img = new Image();
    img.src = currentUrl;
    img.onload = () => {
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [currentUrl]);

  // Close context menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  const navigateTo = useCallback((index: number) => {
    if (!items || index < 0 || index >= items.length) return;
    setCurrentIndex(index);
    const target = items[index];
    setCurrentUrl(target.url);
    setCurrentTitle(target.title);
    setCurrentHtf(target.htfUrl);
    setCurrentLtf(target.ltfUrl);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
    setIsMenuOpen(false);
    setIsDetailsOpen(false);
  }, [items]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) navigateTo(currentIndex - 1);
  }, [currentIndex, navigateTo]);

  const handleNext = useCallback(() => {
    if (items && currentIndex < items.length - 1) navigateTo(currentIndex + 1);
  }, [currentIndex, items, navigateTo]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Smart Copy Media Link (Converts base64 to real ImgBB URL on-the-fly)
  const handleCopyMediaLink = async () => {
    try {
      if (currentUrl.startsWith('http://') || currentUrl.startsWith('https://')) {
        await navigator.clipboard.writeText(currentUrl);
        setCopiedAction('link');
        // Fast snap close in 350ms
        setTimeout(() => {
          setCopiedAction(null);
          setIsMenuOpen(false);
        }, 350);
        return;
      }

      // Convert legacy base64 to real ImgBB image
      if (currentUrl.startsWith('data:image')) {
        setIsConverting(true);
        const resBlob = await fetch(currentUrl).then(r => r.blob());
        const formData = new FormData();
        formData.append('image', resBlob);

        const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=ef3caf5880f01c4c57d0ebc97cdaac10`, {
          method: 'POST',
          body: formData
        });

        const data = await uploadRes.json();
        setIsConverting(false);

        if (data?.data?.url) {
          setCurrentUrl(data.data.url);
          await navigator.clipboard.writeText(data.data.url);
        } else {
          await navigator.clipboard.writeText(currentUrl);
        }

        setCopiedAction('link');
        // Fast snap close in 350ms
        setTimeout(() => {
          setCopiedAction(null);
          setIsMenuOpen(false);
        }, 350);
      }
    } catch (err) {
      setIsConverting(false);
      console.warn('Copy link error:', err);
    }
  };

  // Copy Image directly to Clipboard for pasting
  const handleCopyImage = async () => {
    try {
      setCopiedAction('image');
      const response = await fetch(currentUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob })
      ]);
      // Fast snap close in 350ms
      setTimeout(() => {
        setCopiedAction(null);
        setIsMenuOpen(false);
      }, 350);
    } catch {
      await navigator.clipboard.writeText(currentUrl);
      setTimeout(() => {
        setCopiedAction(null);
        setIsMenuOpen(false);
      }, 350);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(currentUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanFileName = (currentTitle.replace(/[^a-z0-9_-]/gi, '_') || 'chart') + '.png';
      a.download = cleanFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setIsMenuOpen(false);
    } catch {
      window.open(currentUrl, '_blank');
    }
  };

  if (!isOpen || !currentUrl) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = { x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPanPosition({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y
      });
    } else if (e.touches.length === 2 && touchStartDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDistRef.current;
      setZoomScale(prev => Math.min(Math.max(prev * ratio, 0.7), 4));
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDistRef.current = null;
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomScale(prev => Math.min(prev + 0.15, 4));
    } else {
      setZoomScale(prev => Math.max(prev - 0.15, 0.5));
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none safe-bottom-padding"
      onWheel={handleWheelZoom}
    >
      {/* Top Header Bar */}
      <div className="relative px-3 sm:px-6 py-3 flex items-center justify-between border-b border-white/10 bg-black/60 backdrop-blur-md z-30 gap-2">
        
        {/* Left: Title */}
        <div className="flex items-center gap-2 max-w-[32%] truncate z-10">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] shrink-0" />
          <h4 className="text-xs sm:text-sm font-bold font-mono text-white tracking-wide truncate">{currentTitle}</h4>
        </div>

        {/* Absolute Dead-Center Counter */}
        {hasMultiple && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center justify-center w-28 sm:w-32 font-mono text-xs tabular-nums text-zinc-400 bg-white/[0.04] px-2 py-1 rounded-xl border border-white/10 shadow-md backdrop-blur-md z-20 pointer-events-auto">
            <button 
              onClick={handlePrev} 
              disabled={currentIndex === 0} 
              className="hover:text-cyan-300 disabled:opacity-20 p-1 rounded hover:bg-white/[0.06] transition-colors shrink-0"
              title="Previous Chart"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="font-bold text-cyan-300 w-6 text-center select-none shrink-0 inline-block">
              {currentIndex + 1}
            </span>
            <span className="text-zinc-600 select-none px-0.5 shrink-0">/</span>
            <span className="w-6 text-center select-none text-zinc-400 shrink-0 inline-block">
              {items.length}
            </span>

            <button 
              onClick={handleNext} 
              disabled={currentIndex === items.length - 1} 
              className="hover:text-cyan-300 disabled:opacity-20 p-1 rounded hover:bg-white/[0.06] transition-colors shrink-0"
              title="Next Chart"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: HTF/LTF Switcher + Quick Actions Menu + Close */}
        <div className="flex items-center gap-2 z-10" ref={menuRef}>
          {currentHtf && currentLtf && (
            <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] sm:text-xs">
              <button
                onClick={() => { setCurrentUrl(currentHtf); setZoomScale(1); setPanPosition({ x: 0, y: 0 }); }}
                className={`px-2 py-1 rounded font-mono font-bold transition-all ${
                  currentUrl === currentHtf ? 'bg-cyan-500 text-black' : 'text-zinc-400'
                }`}
              >
                HTF
              </button>
              <button
                onClick={() => { setCurrentUrl(currentLtf); setZoomScale(1); setPanPosition({ x: 0, y: 0 }); }}
                className={`px-2 py-1 rounded font-mono font-bold transition-all ${
                  currentUrl === currentLtf ? 'bg-emerald-500 text-black' : 'text-zinc-400'
                }`}
              >
                LTF
              </button>
            </div>
          )}

          {/* Options Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(prev => !prev)}
              className="p-1.5 sm:p-2 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 transition-all flex items-center justify-center"
              title="Image Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#0E1019]/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-2xl py-1.5 z-50 font-mono text-xs divide-y divide-white/[0.05] animate-in fade-in zoom-in-95 duration-100">
                <div className="p-1 space-y-0.5">
                  {/* Copy Image */}
                  <button
                    onClick={handleCopyImage}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/[0.06] text-zinc-200 hover:text-white transition-colors text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copy Image</span>
                    </span>
                    {copiedAction === 'image' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>

                  {/* Copy Media Link */}
                  <button
                    onClick={handleCopyMediaLink}
                    disabled={isConverting}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/[0.06] text-zinc-200 hover:text-white transition-colors text-left disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2.5">
                      <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isConverting ? 'Uploading to CDN...' : 'Copy Media Link'}</span>
                    </span>
                    {isConverting ? (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    ) : (
                      copiedAction === 'link' && <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>

                  {/* Download Image */}
                  <button
                    onClick={handleDownload}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/[0.06] text-zinc-200 hover:text-white transition-colors text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download Image</span>
                  </button>

                  {/* Open in New Tab */}
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/[0.06] text-zinc-200 hover:text-white transition-colors text-left"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                    <span>Open in New Tab</span>
                  </a>
                </div>

                {/* View Details */}
                <div className="p-1">
                  <button
                    onClick={() => setIsDetailsOpen(prev => !prev)}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/[0.06] text-zinc-300 hover:text-white transition-colors text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <Info className="w-3.5 h-3.5 text-amber-400" />
                      <span>View Details</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {isDetailsOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {isDetailsOpen && (
                    <div className="p-2.5 mt-1 rounded-xl bg-black/60 border border-white/10 space-y-2 text-[11px] text-zinc-400 animate-in fade-in duration-100">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block">Filename / Title</span>
                        <span className="text-white truncate block font-bold">{currentTitle}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block">Resolution</span>
                        <span className="text-cyan-300 font-bold">
                          {imageMeta.width ? `${imageMeta.width} x ${imageMeta.height}` : 'Calculating...'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block">Host Source</span>
                        <span className="text-zinc-400 truncate block">
                          {currentUrl.startsWith('data:') ? 'Local Screenshot' : 'Cloud CDN (ImgBB)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Close Fullscreen */}
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4 sm:w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Floating Prev/Next Buttons */}
      {hasMultiple && (
        <>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="hidden md:flex fixed left-5 top-1/2 -translate-y-1/2 z-20 p-3 rounded-2xl bg-black/75 hover:bg-zinc-900 text-zinc-200 hover:text-cyan-300 disabled:opacity-15 border border-white/15 backdrop-blur-xl shadow-2xl transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === items.length - 1}
            className="hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-20 p-3 rounded-2xl bg-black/75 hover:bg-zinc-900 text-zinc-200 hover:text-cyan-300 disabled:opacity-15 border border-white/15 backdrop-blur-xl shadow-2xl transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Canvas Viewport */}
      <div 
        className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          style={{
            transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
          className="relative max-w-full max-h-full pointer-events-none select-none"
        >
          <img
            src={currentUrl}
            alt={currentTitle}
            className="max-h-[82vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        </div>
      </div>

      {/* Zoom HUD */}
      <div className="py-3 flex items-center justify-center z-10">
        <div className="flex items-center gap-2 sm:gap-3 px-3.5 py-1.5 rounded-2xl bg-[#0D0E16]/90 border border-white/15 backdrop-blur-xl shadow-2xl font-mono text-xs">
          <button
            onClick={() => setZoomScale(prev => Math.max(prev - 0.25, 0.5))}
            className="p-1 rounded hover:bg-white/10 text-zinc-300"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="min-w-[42px] text-center font-bold text-cyan-400 tabular-nums">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={() => setZoomScale(prev => Math.min(prev + 0.25, 4))}
            className="p-1 rounded hover:bg-white/10 text-zinc-300"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-4 w-[1px] bg-white/20 mx-1" />
          <button
            onClick={() => { setZoomScale(1); setPanPosition({ x: 0, y: 0 }); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Fit</span>
          </button>
        </div>
      </div>
    </div>
  );
}