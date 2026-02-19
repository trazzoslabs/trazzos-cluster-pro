# Prompt Maestro para Cursor AI — Frontend Test Harness + BFF

Eres un Senior Full-Stack. Construye una app en Next.js 14 (App Router) + TypeScript para probar Trazzos Cluster Pro V2.

## Reglas
- No inventes columnas: usa docs/01_DB_SCHEMA.md
- No inventes endpoints: usa docs/02_BFF_OPENAPI.yaml
- El frontend solo llama /api/* (BFF)
- El BFF usa Supabase service_role (solo servidor)
- Los workflows se ejecutan vía proxy a n8n (endpoints /api/workflows/*)

## Implementa BFF
Crea API routes en app/api siguiendo esta estructura:
- app/api/_lib/supabaseServer.ts (client con service role)
- app/api/_lib/http.ts (fetch helper con timeout)
- app/api/data/* (GET lectura Supabase)
- app/api/workflows/* (POST proxy a n8n)

## Data routes requeridas
GET:
- /api/data/clusters
- /api/data/synergies?cluster_id=
- /api/data/rfps?synergy_id=
- /api/data/offers?rfp_id=
- /api/data/purchase-orders?rfp_id=
- /api/data/evidence?entity_type=&entity_id=
- /api/data/audit?entity_id=
- /api/data/ingestion-jobs?upload_id=

## Workflow proxy routes requeridas
POST:
- /api/workflows/upload-session  -> {N8N_WEBHOOK_BASE}/api/upload/session
- /api/workflows/upload-confirm  -> {N8N_WEBHOOK_BASE}/api/upload/confirm
- /api/workflows/rfp-open        -> {N8N_WEBHOOK_BASE}/rfp/open
- /api/workflows/offer-submit    -> {N8N_WEBHOOK_BASE}/offers/submit
- /api/workflows/scoring-weights -> {N8N_WEBHOOK_BASE}/scoring/weights
- /api/workflows/committee-decide-> {N8N_WEBHOOK_BASE}/committee/decide

## Frontend (pantallas mínimas)
1) Home / Dashboard
- Seleccionar cluster
- Ir a Sinergias

2) /synergies?cluster_id=
- Lista de sinergias (synergies)
- Drawer detalle
- Botón: "Abrir RFP" -> POST /api/workflows/rfp-open
- Luego navegar a /rfp/{rfp_id}

3) /rfp/{rfp_id}
- Mostrar datos de rfps
- Link a rfp_pack_path si existe
- Listar ofertas con GET /api/data/offers?rfp_id=
- Botón: "Enviar oferta (modo proveedor)" -> abrir modal

4) Modal enviar oferta
- Campos: supplier_id, price_total, currency, lead_time_days
- (Opcional) adjunto PDF -> base64
- POST /api/workflows/offer-submit

5) /scoring/{rfp_id}
- Form de weights_json
- POST /api/workflows/scoring-weights
- Mostrar ranking

6) /committee/{rfp_id}
- decision approved/rejected + justification
- POST /api/workflows/committee-decide
- Iniciar polling cada 2s hasta 30s:
  - GET /api/data/purchase-orders?rfp_id=
  - GET /api/data/evidence?entity_type=...&entity_id=...
- Mostrar PO + evidencia hash + audit timeline

## Env vars
Usa:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- N8N_WEBHOOK_BASE
- N8N_WEBHOOK_TOKEN (opcional)

## Calidad
- Manejo de errores claro
- Loader + empty states
- Logs con correlation_id cuando exista
