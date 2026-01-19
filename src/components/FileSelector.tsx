import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';

interface FileSelectorProps {
    selectedPath: string | null;
    onSelect: (path: string) => void;
    disabled?: boolean;
}

export function FileSelector({ selectedPath, onSelect, disabled }: FileSelectorProps) {
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        // Listen for global file drop events
        const unlisten = listen('tauri://file-drop', (event) => {
            if (disabled) return;
            // event.payload is an array of strings (paths)
            const paths = event.payload as string[];
            if (paths && paths.length > 0) {
                const path = paths[0];
                if (path.endsWith('.xlsx') || path.endsWith('.xls')) {
                    onSelect(path);
                }
            }
            setIsDragging(false);
        });

        // Listen for drag hover to show visual feedback
        const unlistenHover = listen('tauri://file-drop-hover', () => setIsDragging(true));
        const unlistenCancel = listen('tauri://file-drop-cancelled', () => setIsDragging(false));

        return () => {
            unlisten.then(f => f());
            unlistenHover.then(f => f());
            unlistenCancel.then(f => f());
        };
    }, [onSelect, disabled]);

    const handleSelect = async () => {
        if (disabled) return;
        try {
            const file = await open({
                multiple: false,
                filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
            });
            if (file) {
                onSelect(file as string);
            }
        } catch (error) {
            console.error('Error opening file dialog:', error);
        }
    };

    return (
        <div className="w-full mb-8">
            <div
                onClick={handleSelect}
                className={`
          relative overflow-hidden group
          border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ease-out
          ${isDragging ? 'border-blue-500 bg-blue-50 scale-105 shadow-xl' : ''}
          ${selectedPath
                        ? 'border-green-400 bg-green-50/30'
                        : 'border-slate-200 hover:border-green-400 hover:bg-slate-50 hover:shadow-md'}
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
        `}
            >
                {selectedPath ? (
                    <div className="flex flex-col items-center relative z-10">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3 shadow-sm">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-slate-800 font-semibold text-lg mb-1">Archivo Listo</span>
                        <span className="text-sm text-slate-500 font-mono bg-white/50 px-3 py-1 rounded-full border border-green-100 max-w-md truncate">
                            {selectedPath.split(/[\\/]/).pop()}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-slate-400 group-hover:text-slate-600 transition-colors">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                            {isDragging ? (
                                <svg className="w-10 h-10 text-blue-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            ) : (
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            )}
                        </div>
                        <span className="text-lg font-medium mb-1">
                            {isDragging ? 'Suelta el archivo aquí' : 'Seleccionar Archivo Excel'}
                        </span>
                        <span className="text-xs text-slate-400">
                            {isDragging ? 'Detectado .xlsx' : 'Arrastra o haz clic para buscar (.xlsx)'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
