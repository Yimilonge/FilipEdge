
import React from 'react';
import { LogEntry } from '../types';

interface LogViewerProps {
  logs: LogEntry[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-200 p-4 border-b border-gray-700">Live Logs</h2>
      <div className="overflow-y-auto p-4 flex-grow font-mono text-xs text-gray-400">
        {logs.map((log, index) => (
          <div key={index} className="flex">
            <span className="text-gray-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-purple-400 mr-2">[{log.agentId}]</span>
            <span className="text-gray-300">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogViewer;
