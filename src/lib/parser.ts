import { Trade, PlaybookCollection } from '@/types/trade';

// Generic security name sanitizer (no hardcoded stocks)
export function cleanSecurityName(rawName: string): string {
  if (!rawName) return 'INSTRUMENT';
  const cleaned = rawName
    .replace(/^["']|["']$/g, '')
    .replace(/-EQ$/i, '')
    .replace(/\.NS$/i, '')
    .replace(/\.BO$/i, '')
    .trim();
  
  const token = cleaned.split(/\s+/)[0].replace(/[^A-Z0-9&_-]/gi, '').toUpperCase();
  return token || cleaned.toUpperCase();
}

export function parseKotakNeoCsv(
  csvText: string, 
  defaultRisk: number, 
  collections: PlaybookCollection[]
): Trade[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"﻿]/g, ''));
  const findIdx = (terms: string[]) => headers.findIndex(h => terms.some(t => h.includes(t)));

  const dateIdx = findIdx(['trade date']);
  const timeIdx = findIdx(['trade time']);
  const secIdx = findIdx(['security name', 'symbol']);
  const typeIdx = findIdx(['transaction type', 'type']);
  const qtyIdx = findIdx(['quantity', 'qty']);
  const priceIdx = findIdx(['market rate', 'price']);
  const totalChargesIdx = findIdx(['total charges']);
  const sttIdx = findIdx(['stt/ctt', 'stt']);

  interface RawExecution {
    date: string;
    time: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    price: number;
    charges: number;
  }

  const executions: RawExecution[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (row.length <= 1) continue;

    const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
    const rawTime = timeIdx !== -1 ? row[timeIdx] : '00:00:00';
    const rawSec = secIdx !== -1 ? row[secIdx] : 'INSTRUMENT';
    const rawSide = typeIdx !== -1 && row[typeIdx].toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
    const qty = qtyIdx !== -1 ? parseFloat(row[qtyIdx]) || 0 : 0;
    const price = priceIdx !== -1 ? parseFloat(row[priceIdx]) || 0 : 0;
    const totalCharges = totalChargesIdx !== -1 ? parseFloat(row[totalChargesIdx]) || 0 : 0;
    const stt = sttIdx !== -1 ? parseFloat(row[sttIdx]) || 0 : 0;

    executions.push({
      date: rawDate,
      time: rawTime,
      symbol: cleanSecurityName(rawSec),
      side: rawSide,
      qty,
      price,
      charges: totalCharges + stt
    });
  }

  const matchedTrades: Trade[] = [];
  const grouped = new Map<string, RawExecution[]>();

  executions.forEach(exec => {
    const key = `${exec.date}_${exec.symbol}`;
    const list = grouped.get(key) || [];
    list.push(exec);
    grouped.set(key, list);
  });

  let matchCounter = 0;
  grouped.forEach((execList) => {
    const buys = execList.filter(e => e.side === 'BUY').sort((a, b) => a.time.localeCompare(b.time));
    const sells = execList.filter(e => e.side === 'SELL').sort((a, b) => a.time.localeCompare(b.time));

    while (buys.length > 0 && sells.length > 0) {
      const buy = buys.shift()!;
      const sell = sells.shift()!;

      const isLong = buy.time <= sell.time;
      const entryPrice = isLong ? buy.price : sell.price;
      const exitPrice = isLong ? sell.price : buy.price;
      const quantity = Math.min(buy.qty, sell.qty);
      const fees = Number((buy.charges + sell.charges).toFixed(2));

      const grossPnl = isLong 
        ? (exitPrice - entryPrice) * quantity 
        : (entryPrice - exitPrice) * quantity;

      const netPnl = Number((grossPnl - fees).toFixed(2));
      const rMultiple = defaultRisk > 0 ? Number((netPnl / defaultRisk).toFixed(2)) : 0;

      // Assign setup dynamically from user's collections or generic placeholder
      const assignedSetup = collections.length > 0 
        ? collections[matchCounter % collections.length].name 
        : 'General Setup';
      matchCounter++;

      matchedTrades.push({
        id: `kotak-${Date.now()}-${Math.random()}`,
        symbol: buy.symbol,
        tradeDate: buy.date,
        direction: isLong ? 'LONG' : 'SHORT',
        quantity,
        entryPrice,
        exitPrice,
        slPrice: isLong 
          ? Number((entryPrice - (defaultRisk / quantity)).toFixed(2)) 
          : Number((entryPrice + (defaultRisk / quantity)).toFixed(2)),
        netPnl,
        fees,
        rMultiple,
        regime: isLong ? 'Bullish' : 'Bearish',
        setupType: assignedSetup,
        mae: '',
        mfe: '',
        image1: '',
        image2: '',
        notes: ''
      });
    }
  });

  return matchedTrades;
}

// Helper: Robust date parser for Indian DD/MM/YYYY and ISO timestamps
export function parseDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }
  }
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? 0 : t;
}

// Generic matcher: Maps backup data directly against active collections
export function syncChartsToExistingCollections(
  rawTrades: any[],
  existingCollections: PlaybookCollection[],
  defaultRisk: number
): Trade[] {
  const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  return rawTrades.map((t, idx) => {
    const rawTag = (t.strategyTag || t.setup || '').trim();
    const cleanedTag = clean(rawTag);

    // Exact or normalized match
    const matchedCol = existingCollections.find(c => clean(c.name) === cleanedTag);
    const finalSetupName = matchedCol ? matchedCol.name : (rawTag || 'General Setup');

    const dateObj = new Date(t.date);
    const dateFormatted = isNaN(dateObj.getTime())
      ? (t.date || 'Trade')
      : dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    let rVal = 0;
    if (typeof t.rrr === 'number') rVal = t.rrr;
    else if (typeof t.rrr === 'string') {
      const num = parseFloat(t.rrr.replace(/[^0-9.-]/g, ''));
      rVal = isNaN(num) ? 0 : num;
    }

    return {
      id: String(t.id || `trade-${idx}-${Date.now()}`),
      symbol: cleanSecurityName(t.asset || t.symbol || 'INSTRUMENT'),
      tradeDate: dateFormatted,
      direction: (t.direction && t.direction.toUpperCase() === 'SHORT') ? 'SHORT' : 'LONG',
      quantity: t.qty || 1,
      entryPrice: t.entry || 0,
      exitPrice: t.exit || 0,
      slPrice: t.sl ? parseFloat(t.sl) : undefined,
      rMultiple: rVal,
      netPnl: typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0'),
      fees: typeof t.fees === 'number' ? t.fees : parseFloat(t.fees || '0'),
      setupType: finalSetupName,
      regime: t.regime || (t.direction === 'Short' ? 'Bearish' : 'Bullish'),
      image1: t.image1 || undefined,
      image2: t.image2 || undefined,
      notes: t.notes ? t.notes.replace(/<[^>]*>?/gm, '').trim() : ''
    };
  });
}