/**
 * Declaraciones de tipos para las APIs de Electron
 */

interface ElectronAPI {
  localServer: {
    start: (serversConfig?: unknown[], supabaseUrl?: string | null, supabaseAnonKey?: string | null) => Promise<{
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
  updater?: {
    download: (downloadUrl: string, fileName?: string | null) => Promise<{
      success: boolean;
      localPath?: string;
      error?: string;
    }>;
    getProgress: () => Promise<{ percent: number; bytesDownloaded: number; totalBytes: number }>;
    cancelDownload: () => Promise<{ success: boolean }>;
    openInstaller: (localPath: string) => Promise<{ success: boolean; error?: string }>;
  };
  platform?: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}

