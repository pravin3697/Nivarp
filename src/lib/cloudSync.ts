import { supabase } from './supabaseClient';
import { Trade, PlaybookCollection, ChartSpecimen } from '@/types/trade';

// Preferred master order strictly defined
export const MASTER_CATEGORY_ORDER = [
  'RETEST STRUCTURES',
  'LIQUIDITY SPRING MODELS',
  'BEAR TO BULL MODELS',
  'BULL TO BEAR MODELS',
  'OVEREXTENDED PIVOT MODELS',
  'BEHAVIOURAL MODELS',
  'EXECUTION STOPPED OUT/ BAD ENTRY'
];

export async function uploadScreenshotToCloud(file: File, folder: string = 'live'): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chart-vault')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('chart-vault').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.error('Failed to upload image to cloud:', err);
    return null;
  }
}

// Sync all trades to PostgreSQL
export async function syncTradesToCloud(trades: Trade[]): Promise<{ success: boolean; error?: string }> {
  if (!trades.length) return { success: true };
  try {
    const payload = trades.map(t => ({
      id: String(t.id),
      symbol: t.symbol,
      trade_date: t.tradeDate,
      direction: t.direction,
      quantity: t.quantity,
      entry_price: t.entryPrice,
      exit_price: t.exitPrice,
      sl_price: t.slPrice || null,
      r_multiple: t.rMultiple,
      net_pnl: t.netPnl,
      fees: t.fees,
      setup_type: t.setupType,
      regime: t.regime || 'Bullish',
      mae: t.mae || null,
      mfe: t.mfe || null,
      image1: t.image1 || null,
      image2: t.image2 || null,
      notes: t.notes || null
    }));

    const { error } = await supabase.from('trades').upsert(payload, { onConflict: 'id' });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

// Fetch all trades from PostgreSQL
export async function fetchTradesFromCloud(): Promise<Trade[]> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('trade_date', { ascending: false });
    if (error || !data) return [];

    return data.map(d => ({
      id: String(d.id),
      symbol: d.symbol,
      tradeDate: d.trade_date,
      tradeTime: d.trade_time || undefined,
      direction: d.direction as 'LONG' | 'SHORT',
      quantity: Number(d.quantity) || 1,
      entryPrice: Number(d.entry_price) || 0,
      exitPrice: Number(d.exit_price) || 0,
      slPrice: d.sl_price ? Number(d.sl_price) : undefined,
      rMultiple: Number(d.r_multiple) || 0,
      netPnl: Number(d.net_pnl) || 0,
      fees: Number(d.fees) || 0,
      setupType: d.setup_type || 'General Setup',
      regime: d.regime as any,
      mae: d.mae || undefined,
      mfe: d.mfe || undefined,
      image1: d.image1 || undefined,
      image2: d.image2 || undefined,
      notes: d.notes || undefined
    }));
  } catch {
    return [];
  }
}

// Sync Collections to PostgreSQL
export async function syncCollectionsToCloud(collections: PlaybookCollection[]): Promise<{ success: boolean; error?: string }> {
  if (!collections.length) return { success: true };
  try {
    const payload = collections.map(c => ({
      id: String(c.id),
      name: c.name.trim(),
      category: c.category.trim().toUpperCase(),
      description: c.description || ''
    }));

    const { error } = await supabase.from('collections').upsert(payload, { onConflict: 'id' });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

// Fetch Collections from PostgreSQL and return them strictly pre-sorted by your preferred order
export async function fetchCollectionsFromCloud(): Promise<PlaybookCollection[]> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*');
    if (error || !data || data.length === 0) return [];

    const mapped = data.map(d => ({
      id: String(d.id),
      name: d.name.trim(),
      category: d.category ? d.category.trim().toUpperCase() : 'GENERAL',
      description: d.description || ''
    }));

    // Pre-sort by preferred master categories
    return mapped.sort((a, b) => {
      const idxA = MASTER_CATEGORY_ORDER.indexOf(a.category);
      const idxB = MASTER_CATEGORY_ORDER.indexOf(b.category);
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

// Sync Study Specimens to PostgreSQL
export async function syncSpecimensToCloud(specimens: ChartSpecimen[]): Promise<{ success: boolean; error?: string }> {
  if (!specimens.length) return { success: true };
  try {
    const payload = specimens.map(s => ({
      id: String(s.id),
      collection_name: s.collectionName.trim(),
      type: s.type || 'STUDY_SETUP',
      title: s.title || '',
      date: s.date || '',
      image_url: s.imageUrl
    }));

    const { error } = await supabase.from('study_specimens').upsert(payload, { onConflict: 'id' });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

// Fetch Study Specimens from PostgreSQL
export async function fetchSpecimensFromCloud(): Promise<ChartSpecimen[]> {
  try {
    const { data, error } = await supabase
      .from('study_specimens')
      .select('*')
      .order('id', { ascending: false });
    if (error || !data || data.length === 0) return [];
    return data.map(d => ({
      id: String(d.id),
      collectionName: d.collection_name.trim(),
      type: d.type || 'STUDY_SETUP',
      title: d.title || '',
      date: d.date || '',
      imageUrl: d.image_url,
      rMultiple: d.r_multiple != null ? Number(d.r_multiple) : undefined
    }));
  } catch {
    return [];
  }
}

// Master Force Sync
export async function forcePushAllToCloud(
  trades: Trade[], 
  collections: PlaybookCollection[], 
  specimens: ChartSpecimen[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const [tradesRes, colsRes, specsRes] = await Promise.all([
      syncTradesToCloud(trades),
      syncCollectionsToCloud(collections),
      syncSpecimensToCloud(specimens)
    ]);

    const errors: string[] = [];
    if (!tradesRes.success && tradesRes.error) errors.push(`Trades: ${tradesRes.error}`);
    if (!colsRes.success && colsRes.error) errors.push(`Collections: ${colsRes.error}`);
    if (!specsRes.success && specsRes.error) errors.push(`Study: ${specsRes.error}`);

    if (errors.length > 0) {
      return { success: false, error: errors.join(' | ') };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function purgeCloudData(): Promise<boolean> {
  try {
    await Promise.allSettled([
      supabase.from('trades').delete().neq('id', '___all___'),
      supabase.from('collections').delete().neq('id', '___all___'),
      supabase.from('study_specimens').delete().neq('id', '___all___')
    ]);
    return true;
  } catch (err) {
    console.error('Failed to purge cloud data:', err);
    return false;
  }
}