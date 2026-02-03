/**
 * Paleta de colores de la aplicación
 * Colores primarios: Negro y Rojo
 */

export const colors = {
  // Colores primarios
  primary: {
    black: '#000000',
    red: '#DC2626',
    redDark: '#991B1B',
    redLight: '#EF4444',
  },

  // Colores secundarios
  secondary: {
    gray: '#1F2937',
    grayLight: '#374151',
    grayLighter: '#6B7280',
    white: '#FFFFFF',
    offWhite: '#F9FAFB',
  },

  // Colores de fondo
  background: {
    main: '#000000',
    card: '#1A1A1A',
    surface: '#0F0F0F',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },

  // Colores de texto
  text: {
    primary: '#FFFFFF',
    secondary: '#D1D5DB',
    muted: '#9CA3AF',
    inverse: '#000000',
  },

  // Colores de estado
  status: {
    success: '#10B981',
    error: '#DC2626',
    warning: '#F59E0B',
    info: '#3B82F6',
  },

  // Colores de bordes
  border: {
    default: '#374151',
    light: '#4B5563',
    dark: '#1F2937',
    accent: '#DC2626',
  },

  // Gradientes
  gradients: {
    primary: 'linear-gradient(135deg, #000000 0%, #DC2626 100%)',
    primaryReverse: 'linear-gradient(135deg, #DC2626 0%, #000000 100%)',
    red: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
    dark: 'linear-gradient(135deg, #000000 0%, #1F2937 100%)',
    overlay: 'linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(220, 38, 38, 0.8) 100%)',
  },

  // Sombras
  shadows: {
    sm: '0 2px 4px rgba(220, 38, 38, 0.1)',
    md: '0 4px 12px rgba(220, 38, 38, 0.2)',
    lg: '0 8px 24px rgba(220, 38, 38, 0.3)',
    xl: '0 20px 60px rgba(0, 0, 0, 0.5)',
    red: '0 4px 12px rgba(220, 38, 38, 0.4)',
    redHover: '0 6px 20px rgba(220, 38, 38, 0.5)',
  },
};

export default colors;

