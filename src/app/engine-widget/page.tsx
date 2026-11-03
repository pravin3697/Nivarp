'use client';

import React, { useState, useEffect } from 'react';
import { EngineView, WATCHLIST_TICKERS } from '@/components/views/EngineView';
import { idbGet, idbSet } from '@/lib/storage';
import { NivarpLogo } from '@/components/ui/NivarpLogo';

const STORAGE_KEY = 'NIVARP_MASTER_STORAGE';
const ENGINE_WATCHLIST_KEY = 'NIVARP_ENGINE_WATCHLIST';

const DEFAULT_WATCHLIST_DATA: Record<string, { high: string; low: string }> = {
  DLF: { high: '', low: '' },
  HINDALCO: { high: '', low: '' },
  SBIN: { high: '', low: '' },
  TATAMOTORS: { high: '', low: '' }
};

export default function EngineWidgetPage() {
  const [watchlistData, setWatchlistData] = useState<Record<string, { high: string; low: string }>>(DEFAULT_WATCHLIST_DATA);
  const [activeTicker, setActiveTicker] = useState<string>('DLF');
  const [defaultRisk, setDefaultRisk] = useState<number>(600);
  const [tradingCapital, setTradingCapital] = useState<number>(70000);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [storedMaster, storedWatchlist] = await Promise.all([
          idbGet<any>(STORAGE_KEY),
          idbGet<Record<string, { high: string; low: string }>>(ENGINE_WATCHLIST_KEY)
        ]);

        if (storedMaster) {
          if (storedMaster.defaultRiskPerTrade) setDefaultRisk(storedMaster.defaultRiskPerTrade);
          if (storedMaster.tradingCapital) setTradingCapital(storedMaster.tradingCapital);
        }

        if (storedWatchlist) {
          setWatchlistData(prev => ({ ...prev, ...storedWatchlist }));
        }
      } catch (e) {
        console.warn('Failed to load storage in widget:', e);
      } finally {
        setIsLoaded(true);
      }
    }

    loadData();
  }, []);

  const handleUpdateZone = (ticker: string, high: string, low: string) => {
    setWatchlistData(prev => {
      const updated = { ...prev, [ticker]: { high, low } };
      idbSet(ENGINE_WATCHLIST_KEY, updated);
      return updated;
    });
  };

  const handleUpdateCapital = (val: number) => {
    setTradingCapital(val);
    idbGet<any>(STORAGE_KEY).then(master => {
      if (master) {
        idbSet(STORAGE_KEY, { ...master, tradingCapital: val });
      }
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4">
        <div className="h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] text-zinc-100 font-sans p-2 select-none overflow-y-auto">
      <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-white/[0.06]">
        <NivarpLogo size="sm" />
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
          Always-On-Top Engine
        </span>
      </div>

      <EngineView
        defaultRisk={defaultRisk}
        tradingCapital={tradingCapital}
        watchlistData={watchlistData}
        activeTicker={activeTicker}
        onSelectTicker={(t) => setActiveTicker(t)}
        onUpdateTickerZone={handleUpdateZone}
        onChangeTradingCapital={handleUpdateCapital}
        isWidgetMode={true}
      />
    </div>
  );
}