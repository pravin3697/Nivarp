export type BehavioralTag = 
  | 'Rules Followed' 
  | 'SL Hunt (Clean Variance)' 
  | 'SL Hunt (Defense Abandoned)' 
  | 'SL Hunt / Slippage Hunt' // backward compatibility
  | 'No Confirmation Entry' 
  | 'Hallucinated Trade';

export type SetupVariantTag = 
  | 'Resistance' 
  | 'No Resistance' 
  | 'Standard Spring' 
  | 'Extended Spring' 
  | 'Pre 10AM' 
  | 'General';

export interface GatekeeperCheckItem {
  id: string;
  text: string;
}

export interface GatekeeperSetupConfig {
  setupKey: 'spring' | 'b2b' | 'origin' | 'pivot';
  label: string;
  tag: string;
  tagColor: string;
  trailingRule: string;
  items: GatekeeperCheckItem[];
}

export interface GatekeeperConfig {
  globalConstraints: GatekeeperCheckItem[];
  setups: Record<'spring' | 'b2b' | 'origin' | 'pivot', GatekeeperSetupConfig>;
}

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
  startDate: string; // e.g. "2026-11-04"
  targetEndDate: string; // e.g. "2027-05-04"
  totalTargetDays: number; // 180
  history: ContractAttempt[];
}

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
  setupSubtype?: SetupVariantTag; // Dynamic subheading variant tag
  mainzoneHeightPct?: number; // Exact Mainzone height/width in % (e.g. 0.138%)
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
  subtype?: SetupVariantTag;
  createdAt?: number;
}