import { Trade, PlaybookCollection } from '@/types/trade';

// Institutional security name sanitizer for Indian NSE/BSE equities
export function cleanSecurityName(rawName: string): string {
  if (!rawName) return 'INSTRUMENT';
  
  const raw = rawName
    .replace(/^["']|["']$/g, '')
    .replace(/-EQ$/i, '')
    .replace(/\.NS$/i, '')
    .replace(/\.BO$/i, '')
    .trim()
    .toUpperCase();

  // Standardize DLF variants
  if (
    raw === 'DLF' || 
    raw.startsWith('DLF') || 
    raw.includes('DLF LTD') || 
    raw.includes('DLF LIMITED')
  ) {
    return 'DLF';
  }

  // Standardize Tata Motors / TATA variants into TATAMOTORS
  if (
    raw.includes('TATA MOTOR') || 
    raw.includes('TATAMOTOR') || 
    raw === 'TATA' || 
    raw === 'TATAMTR'
  ) {
    return 'TATAMOTORS';
  }

  // Standardize SBI / State Bank
  if (raw.includes('STATE BANK') || raw.includes('SBI') || raw === 'SBIN') {
    return 'SBIN';
  }
  if (raw.startsWith('HDFC BANK')) {
    return 'HDFCBANK';
  }
  if (raw.startsWith('ICICI BANK')) {
    return 'ICICIBANK';
  }
  if (raw.startsWith('AXIS BANK')) {
    return 'AXISBANK';
  }
  if (raw.startsWith('KOTAK MAH') || raw === 'KOTAK') {
    return 'KOTAKBANK';
  }
  if (raw.startsWith('HINDALCO')) {
    return 'HINDALCO';
  }

  // Remove whitespace and special characters
  const cleanToken = raw.replace(/\s+/g, '').replace(/[^A-Z0-9&_-]/gi, '');
  return cleanToken || raw;
}

// Strips "1 - ", "2 - ", "3 - "
export function displaySetupName(name?: string): string {
  if (!name) return 'General Setup';
  return name
    .trim()
    .replace(/^#?\d+\s*[-–—]\s*/, '')
    .replace(/^#?\d+[\s.:)]+/, '')
    .trim();
}

// Converts 24h military timestamps ("14:18:58") into 12h AM/PM ("02:18 PM")
export function convertTo12Hour(timeStr: string): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  if (/am|pm/i.test(clean)) return clean;

  const parts = clean.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const mins = parts[1].padStart(2, '0');
    if (isNaN(hours)) return clean;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hStr = String(hours).padStart(2, '0');
    return `${hStr}:${mins} ${ampm}`;
  }
  return clean;
}

// Converts ranged 24h strings ("14:18:58 - 14:40:30") into ("02:18 PM - 02:40 PM")
export function formatTo12HourRange(rangeStr?: string): string {
  if (!rangeStr) return '';
  if (rangeStr.includes('-')) {
    const [start, end] = rangeStr.split('-').map(s => s.trim());
    return `${convertTo12Hour(start)} - ${convertTo12Hour(end)}`;
  }
  return convertTo12Hour(rangeStr);
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const match = clean.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) || 0;
    const ampm = match[3] ? match[3].toUpperCase() : null;

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
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
  const timeIdx = findIdx(['trade time', 'order time']);
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
    const rawTime = timeIdx !== -1 ? row[timeIdx] : '';
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
    // Sort chronologically
    execList.sort((a, b) => a.time.localeCompare(b.time));

    let openSide: 'BUY' | 'SELL' | null = null;
    let entryFills: RawExecution[] = [];
    let exitFills: RawExecution[] = [];
    let openQty = 0;
    let closedQty = 0;

    for (const exec of execList) {
      if (openSide === null) {
        openSide = exec.side;
        entryFills.push(exec);
        openQty += exec.qty;
      } else if (exec.side === openSide) {
        entryFills.push(exec);
        openQty += exec.qty;
      } else {
        exitFills.push(exec);
        closedQty += exec.qty;

        if (closedQty >= openQty) {
          const isLong = openSide === 'BUY';
          const totalQty = openQty;

          const totalEntryCost = entryFills.reduce((acc, f) => acc + (f.price * f.qty), 0);
          const avgEntryPrice = Number((totalEntryCost / totalQty).toFixed(2));

          const totalExitCost = exitFills.reduce((acc, f) => acc + (f.price * f.qty), 0);
          const avgExitPrice = Number((totalExitCost / closedQty).toFixed(2));

          const totalFees = Number(
            (entryFills.reduce((acc, f) => acc + f.charges, 0) + exitFills.reduce((acc, f) => acc + f.charges, 0)).toFixed(2)
          );

          const entryTimeEarliest = entryFills[0].time;
          const exitTimeLatest = exitFills[exitFills.length - 1].time;

          const entryMins = parseTimeToMinutes(entryTimeEarliest);
          const exitMins = parseTimeToMinutes(exitTimeLatest);
          const durationMinutes = (entryMins && exitMins) ? Math.max(1, Math.abs(exitMins - entryMins)) : undefined;

          const formattedTimeRange = `${convertTo12Hour(entryTimeEarliest)} - ${convertTo12Hour(exitTimeLatest)}`;

          const grossPnl = isLong 
            ? (avgExitPrice - avgEntryPrice) * totalQty 
            : (avgEntryPrice - avgExitPrice) * totalQty;

          const netPnl = Number((grossPnl - totalFees).toFixed(2));
          const rMultiple = defaultRisk > 0 ? Number((netPnl / defaultRisk).toFixed(2)) : 0;

          const assignedSetup = collections.length > 0 
            ? collections[matchCounter % collections.length].name 
            : 'General Setup';
          matchCounter++;

          matchedTrades.push({
            id: `kotak-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            symbol: cleanSecurityName(entryFills[0].symbol),
            tradeDate: entryFills[0].date,
            tradeTime: formattedTimeRange,
            durationMinutes,
            direction: isLong ? 'LONG' : 'SHORT',
            quantity: totalQty,
            entryPrice: avgEntryPrice,
            exitPrice: avgExitPrice,
            slPrice: isLong 
              ? Number((avgEntryPrice - (defaultRisk / totalQty)).toFixed(2)) 
              : Number((avgEntryPrice + (defaultRisk / totalQty)).toFixed(2)),
            netPnl,
            fees: totalFees,
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

          openSide = null;
          entryFills = [];
          exitFills = [];
          openQty = 0;
          closedQty = 0;
        }
      }
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