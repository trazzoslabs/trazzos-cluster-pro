import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('job_id');

    if (!jobId) {
      return createErrorResponse('job_id query parameter is required', 400);
    }

    const tableCandidates = ['stg_needs_rows', 'stg_shutdowns_rows'];
    let stagingTable: string | null = null;
    for (const tableName of tableCandidates) {
      const { data, error } = await supabaseServer
        .from(tableName)
        .select('job_id')
        .eq('job_id', jobId)
        .limit(1);
      if (!error && data && data.length > 0) {
        stagingTable = tableName;
        break;
      }
    }

    const columnsSet = new Set<string>();

    // 1. Intento normal: Leer de staging
    if (stagingTable) {
      const { data: sampleRows } = await supabaseServer
        .from(stagingTable)
        .select('raw_json')
        .eq('job_id', jobId)
        .limit(10);
      if (sampleRows && sampleRows.length > 0) {
        sampleRows.forEach((row) => {
          if (row.raw_json && typeof row.raw_json === 'object') {
            Object.keys(row.raw_json).forEach((key) => {
              const normalizedKey = key.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (normalizedKey) columnsSet.add(normalizedKey);
            });
          }
        });
      }
    }

    // 2. FALLBACK INTELIGENTE: Si staging está vacío, leemos la propuesta del Workflow 3
    if (columnsSet.size === 0) {
      const { data: job } = await supabaseServer
        .from('ingestion_jobs')
        .select('upload_id, mapping_profile_id')
        .eq('job_id', jobId)
        .single();
      if (job) {
        let mappingProfileId = job.mapping_profile_id;
        // Si el job no tiene el ID directo, rastreamos a través de uploads
        if (!mappingProfileId && job.upload_id) {
          const { data: upload } = await supabaseServer
            .from('uploads')
            .select('company_id, declared_dataset_type')
            .eq('upload_id', job.upload_id)
            .single();
          if (upload) {
            const { data: profile } = await supabaseServer
              .from('mapping_profiles')
              .select('mapping_profile_id')
              .eq('company_id', upload.company_id)
              .eq('dataset_type', upload.declared_dataset_type)
              .order('updated_at', { ascending: false })
              .limit(1)
              .single();
            if (profile) mappingProfileId = profile.mapping_profile_id;
          }
        }
        if (mappingProfileId) {
          const { data: profileData } = await supabaseServer
            .from('mapping_profiles')
            .select('mapping_json')
            .eq('mapping_profile_id', mappingProfileId)
            .single();
          if (profileData?.mapping_json) {
            Object.keys(profileData.mapping_json).forEach((key) => {
              const normalizedKey = key.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (normalizedKey) columnsSet.add(normalizedKey);
            });
          }
        }
      }
    }

    const columns = Array.from(columnsSet).sort().map((col) => ({
      source_column: col,
      detected_at: new Date().toISOString(),
    }));
    return createSuccessResponse(columns);
  } catch (error) {
    console.error('Unexpected error in GET /api/data/staging-columns:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
