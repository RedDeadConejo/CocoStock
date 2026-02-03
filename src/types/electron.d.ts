/**
 * Declaraciones de tipos para las APIs de Electron
 */

interface ElectronAPI {
  localServer: {
    start: (port?: number) => Promise<{
      success: boolean;
      url?: string;
      port?: number;
      ip?: string;
      error?: string;
    }>;
    stop: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    getStatus: () => Promise<{
      running: boolean;
      port?: number;
      url?: string;
      ip?: string;
    }>;
  };
}

interface Window {
  electronAPI?: ElectronAPI;
}

