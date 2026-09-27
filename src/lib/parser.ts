import { Trade, PlaybookCollection } from '@/types/trade';

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

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hours * 60 + mins;
  }
  return 0;
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
      const entryTime = isLong ? buy.time : sell.time;
      const exitTime = isLong ? sell.time : buy.time;

      // Accurate duration in minutes
      const entryMins = parseTimeToMinutes(entryTime);
      const exitMins = parseTimeToMinutes(exitTime);
      const durationMinutes = Math.max(1, Math.abs(exitMins - entryMins));

      const quantity = Math.min(buy.qty, sell.qty);
      const fees = Number((buy.charges + sell.charges).toFixed(2));

      const grossPnl = isLong 
        ? (exitPrice - entryPrice) * quantity 
        : (entryPrice - exitPrice) * quantity;

      const netPnl = Number((grossPnl - fees).toFixed(2));
      const rMultiple = defaultRisk > 0 ? Number((netPnl / defaultRisk).toFixed(2)) : 0;

      const assignedSetup = collections.length > 0 
        ? collections[matchCounter % collections.length].name 
        : 'General Setup';
      matchCounter++;

      matchedTrades.push({
        id: `kotak-${Date.now()}-${Math.random()}`,
        symbol: buy.symbol,
        tradeDate: buy.date,
        tradeTime: `${entryTime} - ${exitTime}`,
        durationMinutes,
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
        behaviorTag: 'Rules Followed',
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