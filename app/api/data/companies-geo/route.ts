import { NextRequest } from 'next/server';
import { supabaseServer } from '../../_lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '../../_lib/http';

export interface GeoCompany {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
  company_id?: string;
  site_id?: string;
}

const MOCK_COMPANIES: GeoCompany[] = [
  { id: 'reficar',  name: 'Reficar (Ecopetrol)',     lat: 10.3139, lng: -75.5114, category: 'Refinería', status: 'active' },
  { id: 'yara',     name: 'Yara Colombia',            lat: 10.3098, lng: -75.5165, category: 'Química',   status: 'active' },
  { id: 'argos',    name: 'Argos - Planta Cartagena',  lat: 10.3958, lng: -75.4832, category: 'Cemento',   status: 'active' },
  { id: 'ajover',   name: 'Ajover S.A.',               lat: 10.3972, lng: -75.4870, category: 'Plásticos', status: 'active' },
  { id: 'esenttia', name: 'Esenttia',                  lat: 10.3084, lng: -75.5179, category: 'Química',   status: 'active' },
  { id: 'cabot',    name: 'Cabot Colombiana',           lat: 10.3049, lng: -75.5230, category: 'Química',   status: 'active' },
];

export async function GET(request: NextRequest) {
  const result: GeoCompany[] = [];
  const seenIds = new Set<string>();

  const addCompany = (c: GeoCompany) => {
    const key = c.company_id || c.id;
    if (seenIds.has(key)) return;
    seenIds.add(key);
    result.push(c);
  };

  try {
    // ── Estrategia 0: mv_cluster_companies (vista materializada post-refresh) ──
    // No filtra por status — trae TODAS las empresas del cluster
    const { data: mvRows, error: mvErr } = await supabaseServer
      .from('mv_cluster_companies')
      .select('*');

    if (mvErr) {
      console.warn('[companies-geo] mv_cluster_companies no disponible:', mvErr.message);
    } else if (mvRows && mvRows.length > 0) {
      console.log('[companies-geo] mv_cluster_companies rows:', mvRows.length, '| columnas:', Object.keys(mvRows[0]));
      for (const row of mvRows) {
        const lat = Number(row.lat ?? row.latitude ?? row.site_lat);
        const lng = Number(row.lng ?? row.longitude ?? row.site_lng);
        const cid = row.company_id || row.id;
        const name = row.name || row.company_name || row.site_name || 'Empresa';

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          addCompany({ id: cid, name, lat, lng, category: row.city || row.category, status: row.status, company_id: cid });
        } else {
          const mock = MOCK_COMPANIES.find(m =>
            m.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
          );
          if (mock) {
            addCompany({ id: cid, name, lat: mock.lat, lng: mock.lng, category: mock.category, status: row.status, company_id: cid });
          }
        }
      }
      console.log('[companies-geo] Desde mv_cluster_companies:', result.length);
    }

    // ── Estrategia 1: company_sites LEFT JOIN companies (sin !inner, sin filtro de status) ──
    if (result.length === 0) {
      const { data: sites, error: sitesError } = await supabaseServer
        .from('company_sites')
        .select(`
          site_id,
          company_id,
          site_name,
          lat,
          lng,
          city,
          country,
          companies (
            company_id,
            name,
            status
          )
        `)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (sitesError) {
        console.warn('[companies-geo] Error en company_sites:', sitesError.message);
      } else if (sites && sites.length > 0) {
        console.log('[companies-geo] company_sites con coords:', sites.length);
        for (const site of sites) {
          const company = site.companies as any;
          const lat = Number(site.lat);
          const lng = Number(site.lng);
          if (isNaN(lat) || isNaN(lng)) continue;
          addCompany({
            id: site.company_id || site.site_id,
            name: company?.name || site.site_name || 'Empresa',
            lat,
            lng,
            category: site.city || undefined,
            status: company?.status || undefined,
            company_id: site.company_id,
            site_id: site.site_id,
          });
        }
      } else {
        console.log('[companies-geo] company_sites vacío o sin coords');
      }
    }

    // ── Estrategia 2: tabla companies directamente (sin filtro de status) ──
    if (result.length === 0) {
      const { data: companies, error: compErr } = await supabaseServer
        .from('companies')
        .select('company_id, name, status');

      if (compErr) {
        console.warn('[companies-geo] Error en companies:', compErr.message);
      } else if (companies && companies.length > 0) {
        console.log('[companies-geo] Empresas en tabla companies:', companies.length);
        for (const co of companies) {
          const mock = MOCK_COMPANIES.find(m =>
            m.name.toLowerCase().includes(co.name.toLowerCase()) ||
            co.name.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
          );
          if (mock) {
            addCompany({
              id: co.company_id,
              name: co.name,
              lat: mock.lat,
              lng: mock.lng,
              category: mock.category,
              status: co.status || undefined,
              company_id: co.company_id,
            });
          }
        }
        console.log('[companies-geo] Empresas mapeadas a coords mock:', result.length);
      } else {
        console.log('[companies-geo] Tabla companies vacía');
      }
    }

    // ── Fallback: siempre garantizar al menos los 6 puntos mock de Cartagena ──
    if (result.length === 0) {
      console.log('[companies-geo] Sin datos reales — usando 6 mocks de Cartagena');
      return createSuccessResponse(MOCK_COMPANIES);
    }

    // Completar con mocks restantes si hay menos de 6
    const existingNames = new Set(result.map(c => c.name.toLowerCase()));
    for (const mock of MOCK_COMPANIES) {
      if (result.length >= 6) break;
      if (!seenIds.has(mock.id) && !existingNames.has(mock.name.toLowerCase())) {
        addCompany(mock);
      }
    }
    console.log('[companies-geo] Total empresas a devolver:', result.length);

    return createSuccessResponse(result);
  } catch (error) {
    console.error('[companies-geo] Error inesperado:', error);
    return createSuccessResponse(MOCK_COMPANIES);
  }
}



