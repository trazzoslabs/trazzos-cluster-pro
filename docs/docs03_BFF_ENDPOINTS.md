# BFF Endpoints — Trazzos Cluster Pro V2

## Principio
El frontend solo llama /api/*
El BFF:
- Lee Supabase con SERVICE_ROLE
- Proxya workflows hacia n8n cuando aplica

---

## Data endpoints (lectura Supabase)

### GET /api/data/clusters
Tabla: clusters

### GET /api/data/synergies?cluster_id=...
Tabla: synergies
Filtro: cluster_id

### GET /api/data/rfps?synergy_id=...
Tabla: rfps
Filtro opcional: synergy_id

### GET /api/data/offers?rfp_id=...
Tabla: offers
Filtro: rfp_id

### GET /api/data/purchase-orders?rfp_id=...
Tabla: purchase_orders
Filtro: rfp_id

### GET /api/data/evidence?entity_type=...&entity_id=...
Tabla: evidence_records
Filtro: entity_type + entity_id

### GET /api/data/audit?entity_id=...
Tabla: audit_events
Filtro: entity_id
Orden: created_at desc

### GET /api/data/ingestion-jobs?upload_id=...
Tabla: ingestion_jobs
Filtro: upload_id

---

## Workflow endpoints (proxy a n8n)

### POST /api/workflows/upload-session
Llama a: {N8N_WEBHOOK_BASE}/api/upload/session (WF1)

### POST /api/workflows/upload-confirm
Llama a: {N8N_WEBHOOK_BASE}/api/upload/confirm (WF2)

### POST /api/workflows/rfp-open
Llama a: {N8N_WEBHOOK_BASE}/rfp/open (WF7)

### POST /api/workflows/offer-submit
Llama a: {N8N_WEBHOOK_BASE}/offers/submit (WF8)

### POST /api/workflows/scoring-weights
Llama a: {N8N_WEBHOOK_BASE}/scoring/weights (WF9 scoring)

### POST /api/workflows/committee-decide
Llama a: {N8N_WEBHOOK_BASE}/committee/decide (WF9 committee)
Luego el frontend hace polling por:
- /api/data/purchase-orders?rfp_id=...
- /api/data/evidence?... (según entity_type que estén usando)
