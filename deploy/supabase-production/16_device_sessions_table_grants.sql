-- ============================================
-- CocoStock - Permisos tabla cocostock_device_sessions
-- ============================================
-- Ejecutar si ya aplicaste 15_device_sessions.sql.
-- Sin GRANT sobre la tabla, las RPC SECURITY INVOKER pueden fallar al hacer
-- INSERT/UPDATE y el cliente vería error en register_or_refresh_device_session.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cocostock_device_sessions TO authenticated;
