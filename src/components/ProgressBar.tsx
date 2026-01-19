import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ProgressBarProps {
    current: number;
    total: number;
    sent: number;
    failed: number;
    status: string;
}

export function ProgressBar({ current, total, sent, failed, status }: ProgressBarProps) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado del Proceso</span>
                    <div className="text-lg font-medium text-slate-800 flex items-center gap-2 capitalize mt-1">
                        <span className={clsx(
                            "w-2.5 h-2.5 rounded-full inline-block",
                            status === 'running' && "bg-blue-500 animate-pulse",
                            status === 'finished' && "bg-green-500",
                            status === 'error' && "bg-red-500",
                            (status === 'idle' || status === 'ready') && "bg-slate-300"
                        )}></span>
                        {status === 'running' ? 'Enviando...' : status}
                    </div>
                </div>
                <div className="text-4xl font-light text-slate-900">
                    {percentage}<span className="text-2xl text-slate-400">%</span>
                </div>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                <div
                    className={twMerge(clsx(
                        "h-3 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]",
                        status === 'error' ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-indigo-600",
                        status === 'finished' && "from-green-500 to-emerald-500"
                    ))}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="grid grid-cols-3 gap-8 text-center">
                <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Enviados</div>
                    <div className="text-2xl font-bold text-green-700">{sent}</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                    <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Fallidos</div>
                    <div className="text-2xl font-bold text-red-600">{failed}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total</div>
                    <div className="text-2xl font-bold text-slate-700">{total}</div>
                </div>
            </div>
        </div>
    );
}
