# DB Schema (Supabase) — Trazzos Cluster Pro V2

## Tablas (22)

### audit_events
- event_id (uuid, NOT NULL)
- correlation_id (uuid, NULL)
- event_type (text, NULL)
- actor_user_id (uuid, NULL)
- actor_role (text, NULL)
- company_id (uuid, NULL)
- entity_type (text, NULL)
- entity_id (uuid, NULL)
- summary (text, NULL)
- payload_hash_sha256 (text, NULL)
- created_at (timestamptz, NULL)

### clusters
- cluster_id (uuid, NOT NULL)
- name (text, NOT NULL)
- status (text, NULL)

### committee_decisions
- decision_id (uuid, NOT NULL)
- rfp_id (uuid, NULL)  FK -> rfps.rfp_id
- decision (text, NOT NULL)
- justification (text, NULL)
- decided_by_user_id (uuid, NULL) FK -> profiles.user_id
- decided_at (timestamptz, NULL)

### companies
- company_id (uuid, NOT NULL)
- cluster_id (uuid, NULL) FK -> clusters.cluster_id
- name (text, NOT NULL)
- status (text, NULL)

### company_sites
- site_id (uuid, NOT NULL)
- company_id (uuid, NULL) FK -> companies.company_id
- site_name (text, NOT NULL)
- lat (numeric, NULL)
- lng (numeric, NULL)
- city (text, NULL)
- country (text, NULL)

### data_quality_issues
- issue_id (uuid, NOT NULL)
- job_id (uuid, NULL)
- dataset_type (text, NULL)
- row_number (int4, NULL)
- severity (text, NULL)
- issue_code (text, NULL)
- detail_json (jsonb, NULL)
- created_at (timestamptz, NULL)

### evidence_records
- evidence_id (uuid, NOT NULL)
- entity_type (text, NOT NULL)
- entity_id (uuid, NOT NULL)
- payload_hash_sha256 (text, NOT NULL)
- tx_hash (text, NULL)
- created_at (timestamptz, NULL)

### ingestion_jobs
- job_id (uuid, NOT NULL)
- upload_id (uuid, NULL) FK -> uploads.upload_id
- pipeline_version (text, NULL)
- mapping_profile_id (uuid, NULL)
- status (text, NULL)
- rows_total (int4, NULL)
- rows_ok (int4, NULL)
- rows_error (int4, NULL)
- started_at (timestamptz, NULL)
- ended_at (timestamptz, NULL)
- correlation_id (uuid, NULL)

### mapping_profiles
- mapping_profile_id (uuid, NOT NULL)
- company_id (uuid, NOT NULL)
- dataset_type (text, NOT NULL)
- schema_version (text, NULL)
- mapping_json (jsonb, NOT NULL)
- unit_rules_json (jsonb, NULL)
- active (bool, NULL)
- updated_at (timestamptz, NULL)

### needs
- need_id (uuid, NOT NULL)
- company_id (uuid, NOT NULL)
- site_id (uuid, NULL)
- shutdown_id (uuid, NULL)
- item_name (text, NULL)
- item_category (text, NULL)
- specs (text, NULL)
- quantity (numeric, NULL)
- uom (text, NULL)
- required_by_date (date, NULL)
- lead_time_days (int4, NULL)
- source_upload_id (uuid, NULL)
- dedupe_key (text, NULL)
- created_at (timestamptz, NULL)

### offers
- offer_id (uuid, NOT NULL)
- rfp_id (uuid, NULL) FK -> rfps.rfp_id
- supplier_id (uuid, NULL) FK -> suppliers.supplier_id
- price_total (numeric, NOT NULL)
- currency (text, NULL)
- lead_time_days (int4, NULL)
- terms_json (jsonb, NULL)
- attachments_path (text, NULL)
- status (text, NULL)
- submitted_at (timestamptz, NULL)

### profiles
- user_id (uuid, NOT NULL)
- company_id (uuid, NULL) FK -> companies.company_id
- role (text, NULL)
- status (text, NULL)

### purchase_orders
- po_id (uuid, NOT NULL)
- rfp_id (uuid, NULL) FK -> rfps.rfp_id
- offer_id (uuid, NULL) FK -> offers.offer_id
- status (text, NULL)
- po_document_path (text, NULL)
- evidence_id (uuid, NULL) FK -> evidence_records.evidence_id
- created_at (timestamptz, NULL)

### rfps
- rfp_id (uuid, NOT NULL)
- synergy_id (text, NULL) FK -> synergies.synergy_id
- status (text, NULL)
- published_at (timestamptz, NULL)
- closing_at (timestamptz, NOT NULL)
- rfp_pack_path (text, NULL)
- created_by_user_id (uuid, NULL) FK -> profiles.user_id

### scoring_runs
- run_id (uuid, NOT NULL)
- rfp_id (uuid, NULL) FK -> rfps.rfp_id
- weights_version_id (uuid, NULL) FK -> scoring_weights_versions.weights_version_id
- results_json (jsonb, NULL)
- created_at (timestamptz, NULL)

### scoring_weights_versions
- weights_version_id (uuid, NOT NULL)
- rfp_id (uuid, NULL) FK -> rfps.rfp_id
- weights_json (jsonb, NOT NULL)
- created_by (uuid, NULL) FK -> profiles.user_id
- created_at (timestamptz, NULL)

### shutdowns
- shutdown_id (uuid, NOT NULL)
- company_id (uuid, NOT NULL)
- site_id (uuid, NULL)
- asset_area (text, NULL)
- start_date (date, NULL)
- end_date (date, NULL)
- criticality (text, NULL)
- source_upload_id (uuid, NULL)
- dedupe_key (text, NULL)
- created_at (timestamptz, NULL)

### stg_needs_rows
- job_id (uuid, NOT NULL)
- row_number (int4, NOT NULL)
- raw_json (jsonb, NULL)
- mapped_json (jsonb, NULL)
- status (text, NULL)
- error_json (jsonb, NULL)
- created_at (timestamptz, NULL)

### stg_shutdowns_rows
- job_id (uuid, NOT NULL)
- row_number (int4, NOT NULL)
- raw_json (jsonb, NULL)
- mapped_json (jsonb, NULL)
- status (text, NULL)
- error_json (jsonb, NULL)
- created_at (timestamptz, NULL)
- id (int8, NOT NULL)

### suppliers
- supplier_id (uuid, NOT NULL)
- supplier_name (text, NOT NULL)
- country (text, NULL)
- is_national (bool, NULL)
- categories_json (jsonb, NULL)
- coverage_json (jsonb, NULL)
- verification_status (text, NULL)
- quality_score (numeric, NULL)
- sla_score (numeric, NULL)
- created_at (timestamptz, NULL)

### synergies
- synergy_id (text, NOT NULL)
- cluster_id (uuid, NULL) FK -> clusters.cluster_id
- item_category (text, NOT NULL)
- window_start (timestamptz, NOT NULL)
- window_end (timestamptz, NOT NULL)
- companies_involved_json (jsonb, NOT NULL)
- volume_total_json (jsonb, NULL)
- status (text, NULL)
- created_at (timestamptz, NULL)
- updated_at (timestamptz, NULL)

### uploads
- upload_id (uuid, NOT NULL)
- company_id (uuid, NOT NULL)
- uploader_user_id (uuid, NOT NULL)
- file_path (text, NULL)
- file_name (text, NULL)
- file_type (text, NULL)
- declared_dataset_type (text, NULL)
- status (text, NULL)
- checksum_sha256 (text, NULL)
- created_at (timestamptz, NULL)

## Foreign Keys confirmadas (18)
- companies.cluster_id -> clusters.cluster_id
- company_sites.company_id -> companies.company_id
- profiles.company_id -> companies.company_id
- ingestion_jobs.upload_id -> uploads.upload_id
- synergies.cluster_id -> clusters.cluster_id
- rfps.synergy_id -> synergies.synergy_id
- rfps.created_by_user_id -> profiles.user_id
- offers.rfp_id -> rfps.rfp_id
- offers.supplier_id -> suppliers.supplier_id
- scoring_weights_versions.rfp_id -> rfps.rfp_id
- scoring_weights_versions.created_by -> profiles.user_id
- scoring_runs.rfp_id -> rfps.rfp_id
- scoring_runs.weights_version_id -> scoring_weights_versions.weights_version_id
- committee_decisions.rfp_id -> rfps.rfp_id
- committee_decisions.decided_by_user_id -> profiles.user_id
- purchase_orders.rfp_id -> rfps.rfp_id
- purchase_orders.offer_id -> offers.offer_id
- purchase_orders.evidence_id -> evidence_records.evidence_id
