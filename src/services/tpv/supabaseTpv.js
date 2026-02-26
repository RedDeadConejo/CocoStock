/**
 * Cliente Supabase para el schema TPV (Punto de Venta)
 * Usa el mismo proyecto Supabase que el backoffice, con datos separados por schema.
 * Ver docs/DATABASES.md para la organización backoffice vs TPV.
 */

import { supabase } from '../supabase';

const TPV_SCHEMA = 'tpv';

/**
 * Devuelve el cliente de Supabase con el schema TPV activo.
 * Uso: getTpv().from('sales').select('*')  o  getTpv().from('sale_items').insert(...)
 * @returns {import('@supabase/supabase-js').PostgrestFilterBuilder} cliente con schema tpv
 */
export function getTpv() {
  return supabase.schema(TPV_SCHEMA);
}

/** Nombres de tablas del TPV (para evitar strings mágicos) */
export const TPV_TABLES = {
  SALES: 'sales',
  SALE_ITEMS: 'sale_items',
};
