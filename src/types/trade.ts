export type BehavioralTag = 
  | 'Rules Followed' 
  | 'SL Hunt (Clean Variance)' 
  | 'SL Hunt (Defense Abandoned)' 
  | 'SL Hunt / Slippage Hunt' 
  | 'No Confirmation Entry' 
  | 'Hallucinated Trade';

export type SetupVariantTag = 
  | 'Resistance' 
  | 'No Resistance' 
  | 'Standard Spring' 
  | 'Extended Spring' 
  | 'Pre 10AM' 
  | 'General';

export interface ContractAttempt {
  attemptNumber: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'FAILED' | 'COMPLETED';
  failedDay?: number;
  failureReason?: string;
  costNote?: string;
  cleanTradesCount: number;
}

export interface ExecutionContractState {
  currentAttempt: number;
  startDate: string;
  targetEndDate: string;
  totalTargetDays: number;
  history: ContractAttempt[];
}

export interface Trade {
  id: string;
  symbol: string;
  tradeDate: string;
  tradeTime?: string;
  durationMinutes?: number;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  slPrice?: number;
  rMultiple: number;
  netPnl: number;
  fees: number;
  setupType: string;
  setupSubtype?: SetupVariantTag;
  mainzoneHeightPct?: number;
  regime?: 'Bullish' | 'Bearish' | 'Choppy';
  behaviorTag?: BehavioralTag;
  mae?: string;
  mfe?: string;
  image1?: string;
  image2?: string;
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
  subtype?: SetupVariantTag;
  createdAt?: number;
}