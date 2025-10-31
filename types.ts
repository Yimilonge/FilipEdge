export enum AgentState {
  STOPPED = 'STOPPED',
  ANALYZING = 'ANALYZING',
  EXECUTING = 'EXECUTING',
  HOLDING = 'HOLDING',
  COOLDOWN = 'COOLDOWN',
  ERROR = 'ERROR',
}

export enum StrategyType {
  PROFIT = 'PROFIT',
  LOSS = 'LOSS',
}

export interface Agent {
  id: string;
  name: string;
  type: StrategyType;
  state: AgentState;
  balance: number;
  pnl: number;
  tradesToday: number;
}

export enum OrderSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export interface Position {
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  size: number;
  unrealizedPnl: number;
  agentId: string;
}

export interface LogEntry {
  timestamp: string;
  agentId: string;
  message: string;
}

export interface ApiStatusResponse {
  agents: Agent[];
  openPositions: Position[];
  logs: LogEntry[];
  reports: string[];
}