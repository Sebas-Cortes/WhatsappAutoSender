import { useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { FileSelector } from './components/FileSelector';
import { ProgressBar } from './components/ProgressBar';
import { LogViewer } from './components/LogViewer';
import { AppState, INITIAL_STATE, ProcessLog } from './types';
import { Monitor, Settings, AlertTriangle, Play, Square } from 'lucide-react';

function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [sidecarChild, setSidecarChild] = useState<any>(null); // Simplified type

  // Settings Form State
  const [phoneCol, setPhoneCol] = useState(INITIAL_STATE.config.phoneColumn);
  const [countryCol, setCountryCol] = useState(INITIAL_STATE.config.countryColumn);
  const [msgTemplate, setMsgTemplate] = useState(INITIAL_STATE.config.message);
  const [interval, setInterval] = useState(INITIAL_STATE.config.intervalSeconds);
  const [dryRun, setDryRun] = useState(INITIAL_STATE.config.dryRun);

  const addLog = (type: ProcessLog['type'], message: string, data?: any) => {
    setState(s => ({
      ...s,
      logs: [...s.logs, { type, message, data, timestamp: Date.now() / 1000 }]
    }));
  };

  const startProcess = async () => {
    if (!state.excelPath) {
      addLog('error', 'Por favor selecciona un archivo Excel.');
      return;
    }

    // Warn if interval < 60
    if (interval < 60 && !dryRun) {
      // In a real app we might show a modal confirmation. 
      // For now just logging warning but proceeding if user insists (or maybe block?)
      // Requirement says "show warning", but proceed.
      addLog('warning', 'Intervalo menor a 60s aumenta riesgo de bloqueo.');
    }

    try {
      setState(s => ({ ...s, status: 'ready', logs: [], progress: INITIAL_STATE.progress }));
      addLog('info', 'Iniciando proceso...');

      let child = sidecarChild;
      if (!child) {
        child = await spawnSidecar();
      }

      // Send Start Command
      const payload = {
        action: "start",
        payload: {
          excel_path: state.excelPath,
          phone_col: phoneCol,
          country_col: countryCol,
          message: msgTemplate,
          interval_seconds: interval,
          dry_run: dryRun
        }
      };

      await child.write(JSON.stringify(payload) + "\n");
      setState(s => ({ ...s, status: 'running' }));

    } catch (error) {
      addLog('error', `Error al iniciar: ${error}`);
    }
  };

  const handleBackendEvent = (event: any) => {
    const { type, message, data } = event;

    // Log it
    addLog(type as any, message, data);

    if (type === 'progress' && data) {
      setState(s => ({
        ...s,
        progress: {
          current: data.index + 1,
          total: data.total,
          sent: s.progress.sent + (data.status === 'sent' ? 1 : 0),
          failed: s.progress.failed + (data.status === 'fail' ? 1 : 0)
        }
      }));
    } else if (type === 'finished') {
      setState(s => ({ ...s, status: 'finished' }));
    }
  };



  const openBrowser = async () => {
    try {
      if (!sidecarChild) {
        // If sidecar not running (should be rare if we properly init), we might need to spawn it without args?
        // Actually, we designed spawn to happen on 'startProcess' usually. 
        // Logic change: We should spawn execution context early or spawn on demand.
        // Given current structure, let's spawn on first action.

        // Reuse spawn logic?
        // Ideally extract spawn logic.
        // For now, duplicate or refactor. Let's refactor slightly inline.

        // Wait, if we want to just Open Browser, we need to spawn the python process if not exists.
        if (!sidecarChild) {
          await spawnSidecar();
        }

        // Send command
        if (sidecarChild && sidecarChild.write) {
          await sidecarChild.write(JSON.stringify({ action: "open_browser" }) + "\n");
          addLog('info', 'Abriendo navegador para vinculación...');
        }
      } else {
        await sidecarChild.write(JSON.stringify({ action: "open_browser" }) + "\n");
        addLog('info', 'Abriendo navegador para vinculación...');
      }
    } catch (e) {
      addLog('error', `Error al abrir navegador: ${e}`);
    }
  };

  const spawnSidecar = async () => {
    try {
      // Use 'backend' command defined in shell.json (points to externalBin)
      const pythonCmd = Command.create('backend', ['run']);

      // Monitor stdout on command instance
      pythonCmd.stdout.on('data', (line) => {
        try {
          const event = JSON.parse(line);
          handleBackendEvent(event);
        } catch (e) {
          console.log("Raw stdout:", line);
        }
      });

      pythonCmd.stderr.on('data', (line) => {
        console.error("Stderr:", line);
        addLog('error', `STDERR: ${line}`);
      });

      pythonCmd.on('close', (data) => {
        addLog('info', `Proceso terminado con código ${data.code}.`);
        setState(s => ({ ...s, status: 'finished' }));
        setSidecarChild(null);
      });

      const child = await pythonCmd.spawn();
      setSidecarChild(child);

      return child;
    } catch (e) {
      throw e; // Propagate
    }
  };

  const cancelProcess = async () => {
    if (sidecarChild) {
      setState(s => ({ ...s, status: 'cancelling' }));
      try {
        await sidecarChild.write(JSON.stringify({ action: "cancel" }) + "\n");
        // Or kill
        // await sidecarChild.kill();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="min-h-screen p-8 text-slate-800 flex flex-col items-center">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-green-500 rounded-xl shadow-lg shadow-green-200">
            <Monitor className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">WhatsApp AutoSender</h1>
            <p className="text-slate-500">Automatización segura y controlada</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Config */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-8">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-800">
                <Settings className="w-5 h-5 text-slate-400" />
                Configuración
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Columna Celular</label>
                  <input
                    type="text"
                    value={phoneCol}
                    onChange={e => setPhoneCol(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none text-sm placeholder:text-slate-400"
                    placeholder="Ej: celular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Columna Cod. País (Opcional)</label>
                  <input
                    type="text"
                    value={countryCol}
                    onChange={e => setCountryCol(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none text-sm placeholder:text-slate-400"
                    placeholder="Ej: codigo_pais"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mensaje</label>
                  <textarea
                    rows={6}
                    value={msgTemplate}
                    onChange={e => setMsgTemplate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none text-sm resize-none placeholder:text-slate-400 leading-relaxed"
                    placeholder="Escribe tu mensaje aquí... 
Usa {{nombre}} para personalizar."
                  />
                  <p className="text-[10px] text-slate-400 mt-2 text-right">
                    Variables disponibles: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{"{{columna}}"}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Intervalo de seguridad</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={interval}
                      onChange={e => setInterval(parseInt(e.target.value) || 0)}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-lg focus:ring-2 outline-none transition-all text-sm
                        ${interval < 60
                          ? 'border-amber-300 focus:ring-amber-500 text-amber-700'
                          : 'border-slate-200 focus:ring-green-500'}`}
                    />
                    <span className="absolute right-4 top-3 text-sm text-slate-400 pointer-events-none">segundos</span>
                  </div>

                  {interval < 60 && (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 leading-tight">
                        Intervalos menores a 60s aumentan drásticamente el riesgo de bloqueo por parte de WhatsApp.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={dryRun}
                        onChange={e => setDryRun(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                    </div>
                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">Modo Simulación</span>
                  </label>
                  <p className="text-xs text-slate-400 mt-1 pl-12">No envía mensajes reales.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Actions & Status */}
          <div className="lg:col-span-2 space-y-6">

            <FileSelector
              selectedPath={state.excelPath}
              onSelect={(path) => setState(s => ({ ...s, excelPath: path }))}
              disabled={state.status === 'running'}
            />

            {(state.status === 'running' || state.status === 'finished' || state.status === 'paused' || state.progress.total > 0) && (
              <ProgressBar {...state.progress} status={state.status} />
            )}

            <div className="flex gap-4">
              {state.status === 'running' ? (
                <button
                  onClick={cancelProcess}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2"
                >
                  <Square className="w-5 h-5 fill-current" />
                  Cancelar Envío
                </button>
              ) : (
                <>
                  <button
                    onClick={openBrowser}
                    disabled={state.status !== 'idle' && state.status !== 'ready' && state.status !== 'finished' && state.status !== 'error'}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                    title="Abre WhatsApp Web para vincular tu dispositivo"
                  >
                    <div className="w-5 h-5 flex items-center justify-center border-2 border-white rounded-md">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    Vincular WhatsApp
                  </button>

                  <button
                    onClick={startProcess}
                    disabled={!state.excelPath || (state.status as string) === 'running'}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {state.status === 'finished' ? 'Iniciar Nuevo Envío' : 'Iniciar Proceso'}
                  </button>
                </>
              )}
            </div>

            <LogViewer logs={state.logs} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
