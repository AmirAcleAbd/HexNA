import React, { useState, useEffect } from 'react';

interface LogEntry {
  message: string;
  timestamp: number;
}

// Create a global event system for logging
interface LogEvent extends CustomEvent {
  detail: LogEntry;
}

// Create a global performance logger
export const perfLogger = {
  log: (message: string) => {
    const event = new CustomEvent('webConsoleLog', {
      detail: { message, timestamp: performance.now() }
    }) as LogEvent;
    window.dispatchEvent(event);
  }
};

const WebConsole = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const maxLogs = 100; // Maximum number of logs to keep

  useEffect(() => {
    const handleLog = (event: Event) => {
      const logEvent = event as LogEvent;
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, logEvent.detail];
        return newLogs.slice(-maxLogs); // Keep only the last maxLogs entries
      });
    };

    window.addEventListener('webConsoleLog', handleLog);
    return () => window.removeEventListener('webConsoleLog', handleLog);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 w-96 h-64 bg-black bg-opacity-80 text-green-400 font-mono text-sm overflow-y-auto p-2 border border-green-500">
      {logs.map((log, index) => (
        <div key={index} className="whitespace-pre-wrap">
          <span className="opacity-50">[{log.timestamp.toFixed(2)}ms]</span> {log.message}
        </div>
      ))}
    </div>
  );
};

export default WebConsole;