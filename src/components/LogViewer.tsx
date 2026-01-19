import { useEffect, useRef } from 'react';
import { ProcessLog } from '../types';
import { clsx } from 'clsx';

interface LogViewerProps {
    logs: ProcessLog[];
}

export function LogViewer({ logs }: LogViewerProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <div className="w-full bg-slate-900 rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto border border-slate-700 shadow-inner">
            {logs.length === 0 && (
                <div className="text-slate-500 italic text-center mt-20">Esperando inicio...</div>
            )}
            {logs.map((log, i) => (
                <div key={i} className="mb-1 flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">
                        [{new Date(log.timestamp * 1000).toLocaleTimeString()}]
                    </span>
                    <span className={clsx(
                        "break-all",
                        log.type === 'info' && "text-slate-300",
                        log.type === 'error' && "text-red-400 font-bold",
                        log.type === 'success' && "text-green-400",
                        log.type === 'warning' && "text-yellow-400",
                        log.type === 'progress' && "text-blue-400"
                    )}>
                        {log.type.toUpperCase()}: {log.message}
                    </span>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
}
