export interface ProcessLog {
  type: 'info' | 'error' | 'success' | 'warning' | 'progress';
  message: string;
  data?: any;
  timestamp: number;
}

export type SenderStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished' | 'error' | 'cancelling';

export interface AppState {
  status: SenderStatus;
  excelPath: string | null;
  logs: ProcessLog[];
  progress: {
    current: number;
    total: number;
    sent: number;
    failed: number;
  };
  config: {
    phoneColumn: string;
    countryColumn: string; // New field
    message: string;
    intervalSeconds: number;
    dryRun: boolean;
  };
}

export const INITIAL_STATE: AppState = {
  status: 'idle',
  excelPath: null,
  logs: [],
  progress: { current: 0, total: 0, sent: 0, failed: 0 },
  config: {
    phoneColumn: 'celular',
    countryColumn: '', // Default empty
    message: 'Hola, saludos!',
    intervalSeconds: 60,
    dryRun: false,
  },
};
