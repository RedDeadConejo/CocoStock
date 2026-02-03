/**
 * Hook para manejar la limpieza de sesión al cerrar la aplicación
 * Funciona tanto en Electron como en web
 */

import { useEffect } from 'react';
import { supabase } from '../services/supabase';

/**
 * Detecta si la aplicación está corriendo en Electron
 */
function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

/**
 * Limpia el localStorage y sessionStorage relacionado con Supabase
 * Esta función es síncrona para poder usarse en beforeunload
 */
function cleanupStorage() {
  if (typeof window === 'undefined') return;
  
  // Limpiar localStorage
  if (window.localStorage) {
    const keys = Object.keys(window.localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        window.localStorage.removeItem(key);
      }
    });
  }
  
  // Limpiar sessionStorage
  if (window.sessionStorage) {
    const keys = Object.keys(window.sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        window.sessionStorage.removeItem(key);
      }
    });
  }
}

/**
 * Hook para cerrar sesión automáticamente al cerrar la aplicación
 */
export function useSessionCleanup() {
  useEffect(() => {
    // Función para manejar el cierre
    const handleBeforeUnload = () => {
      // Limpiar el storage de forma síncrona (esto es lo único que funciona en beforeunload)
      cleanupStorage();
    };

    // Escuchar el evento beforeunload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // También escuchar el evento unload como respaldo
    window.addEventListener('unload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
    };
  }, []);
}

