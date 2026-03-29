import { Capacitor } from '@capacitor/core';

/** URL de la ficha en Play Store (appId en capacitor.config). */
export const PLAY_STORE_APP_URL =
  'https://play.google.com/store/apps/details?id=com.cocostock.app';

/**
 * App nativa Android (Capacitor), no escritorio ni navegador.
 */
export function isNativeAndroidApp() {
  try {
    return Capacitor.isNativePlatform() === true && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}
