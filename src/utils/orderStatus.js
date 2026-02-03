/**
 * Utilidades para estados de pedidos
 */

import { ORDER_STATUS } from '../services/orders';

/** Filtro especial: pedidos con incidencias (cantidad enviada ≠ solicitada) */
export const FILTER_INCIDENTS = 'incidents';

/**
 * Obtiene la etiqueta en español para un estado de pedido
 */
export const getStatusLabel = (status) => {
  const labels = {
    [ORDER_STATUS.PENDING]: 'Pendiente',
    [ORDER_STATUS.PROCESSING]: 'En Proceso',
    [ORDER_STATUS.COMPLETED]: 'Completado',
    [ORDER_STATUS.CANCELLED]: 'Cancelado',
    [FILTER_INCIDENTS]: 'Incidencias',
  };
  return labels[status] || status;
};

/**
 * Obtiene el color para un estado de pedido
 */
export const getStatusColor = (status) => {
  const colors = {
    [ORDER_STATUS.PENDING]: '#F59E0B',
    [ORDER_STATUS.PROCESSING]: '#3B82F6',
    [ORDER_STATUS.COMPLETED]: '#10B981',
    [ORDER_STATUS.CANCELLED]: '#DC2626',
    [FILTER_INCIDENTS]: '#DC2626',
  };
  return colors[status] || '#9CA3AF';
};

/**
 * Obtiene la clase CSS para un estado de pedido
 */
export const getStatusBadgeClass = (status, prefix = '') => {
  const classes = {
    [ORDER_STATUS.PENDING]: `${prefix}status-pending`,
    [ORDER_STATUS.PROCESSING]: `${prefix}status-processing`,
    [ORDER_STATUS.COMPLETED]: `${prefix}status-completed`,
    [ORDER_STATUS.CANCELLED]: `${prefix}status-cancelled`,
    [FILTER_INCIDENTS]: `${prefix}status-cancelled`,
  };
  return classes[status] || `${prefix}status-default`;
};
