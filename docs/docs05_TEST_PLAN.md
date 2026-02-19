# Plan de Pruebas End-to-End — Trazzos Cluster Pro V2

## Meta
Validar que el prototipo funciona de punta a punta y medir capacidad operativa.

## Flujo 1: RFP -> Ofertas -> Scoring -> Comité -> PO + Evidencia

1) Seleccionar cluster
2) Abrir sinergias
3) Abrir RFP (WF7 proxy)
4) Enviar 2-3 ofertas (WF8 proxy)
5) Ejecutar scoring (WF9 scoring proxy)
6) Aprobar comité (WF9 committee proxy)
7) Ver PO + evidence + audit (polling lectura Supabase)

### Validaciones
- rfps creado y tiene closing_at
- offers creadas y asociadas a rfp_id
- scoring_weights_versions + scoring_runs creados
- committee_decisions creada
- purchase_orders creada
- evidence_records creada
- audit_events reflejan la historia

### Métricas
- tiempo total desde abrir RFP hasta evidencia
- latencia promedio de endpoints /api/data/*
- número de ofertas procesadas
- consistencia de relaciones FK

## Flujo 2: Ingesta (WF1/WF2) + seguimiento job

1) POST upload-session (WF1 proxy)
2) Subir archivo a signed_url (si aplica en respuesta)
3) POST upload-confirm (WF2 proxy)
4) Polling: /api/data/ingestion-jobs?upload_id=...

Validar:
- ingestion_jobs.status cambia
- rows_total/ok/error se actualizan
- data_quality_issues aparece si hay errores