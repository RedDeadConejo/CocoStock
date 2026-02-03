/**
 * Utilidades para estados de compras
 */

import { PURCHASE_STATUS } from '../services/purchases';

/** Filtro especial: compras con incidencias (cantidad recibida ≠ solicitada) */
export const FILTER_PURCHASE_INCIDENTS = 'incidents';

/**
 * Obtiene la etiqueta en español para un estado de compra
 */
export const getPurchaseStatusLabel = (status) => {
  const labels = {
    [PURCHASE_STATUS.PENDING]: 'Pendiente',
    [PURCHASE_STATUS.PROCESSING]: 'En Proceso',
    [PURCHASE_STATUS.COMPLETED]: 'Completado',
    [PURCHASE_STATUS.CANCELLED]: 'Cancelado',
    [FILTER_PURCHASE_INCIDENTS]: 'Incidencias',
  };
  return labels[status] || status;
};

/**
 * Obtiene el color para un estado de compra
 */
export const getPurchaseStatusColor = (status) => {
  const colors = {
    [PURCHASE_STATUS.PENDING]: '#F59E0B',
    [PURCHASE_STATUS.PROCESSING]: '#3B82F6',
    [PURCHASE_STATUS.COMPLETED]: '#10B981',
    [PURCHASE_STATUS.CANCELLED]: '#DC2626',
    [FILTER_PURCHASE_INCIDENTS]: '#DC2626',
  };
  return colors[status] || '#9CA3AF';
};

/**
 * Obtiene la clase CSS para un estado de compra
 */
export const getPurchaseStatusBadgeClass = (status, prefix = '') => {
  const classes = {
    [PURCHASE_STATUS.PENDING]: `${prefix}status-pending`,
    [PURCHASE_STATUS.PROCESSING]: `${prefix}status-processing`,
    [PURCHASE_STATUS.COMPLETED]: `${prefix}status-completed`,
    [PURCHASE_STATUS.CANCELLED]: `${prefix}status-cancelled`,
    [FILTER_PURCHASE_INCIDENTS]: `${prefix}status-cancelled`,
  };
  return classes[status] || `${prefix}status-default`;
};
