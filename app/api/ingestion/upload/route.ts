/**
 * Alias de la sesión de carga V2: mismo handler que /api/workflows/upload-session.
 * Inserciones en `uploads` / `ingestion_jobs` usan supabaseServer (service role), nunca anon.
 */
export { POST } from '../../workflows/upload-session/route';
