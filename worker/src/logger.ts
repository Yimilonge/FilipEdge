
import { LogEntry } from './types';

const MAX_LOG_ENTRIES = 50;
const logs: LogEntry[] = [];

export const log = (agentId: string, message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${agentId}] ${message}`);
  
  logs.unshift({ timestamp, agentId, message });
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.pop();
  }
};

export const getLogs = (): LogEntry[] => {
  return logs;
};
