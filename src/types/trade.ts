export type BehavioralTag = 
  | 'Rules Followed' 
  | 'No Confirmation Entry' 
  | 'SL Hunt / Slippage Hunt' 
  | 'Hallucinated Trade';

export interface Trade {
  id: string;
  symbol: string;
  tradeDate: string;
  tradeTime?: string;
  durationMinutes?: number; // Exact holding time in minutes
  direction: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  slPrice?: number;
  rMultiple: number;
  netPnl: number;
  fees: number;
  setupType: string;
  regime?: 'Bullish' | 'Bearish' | 'Choppy';
  behaviorTag?: BehavioralTag;
  mae?: string;
  mfe?: string;
  image1?: string; // HTF Context
  image2?: string; // LTF Execution (Synced to Codex)
  notes?: string;
}

export interface PlaybookCollection {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface ChartSpecimen {
  id: string;
  collectionId?: string;
  collectionName: string;
  type: 'LIVE_TRADE' | 'STUDY_SETUP';
  title: string;
  date: string;
  imageUrl: string;
  rMultiple?: number;
  direction?: 'LONG' | 'SHORT';
}