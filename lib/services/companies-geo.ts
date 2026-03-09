/**
 * Servicio de acceso a datos geoespaciales de empresas.
 * Prioridad: mv_cluster_companies → company_sites → companies → mock (solo última instancia).
 */

import { supabaseServer } from '@/app/api/_lib/supabaseServer';

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
  { id: 'reficar', name: 'Reficar (Ecopetrol)', lat: 10.3139, lng: -75.5114, category: 'Refinería', status: 'active' },
  { id: 'yara', name: 'Yara Colombia', lat: 10.3098, lng: -75.5165, category: 'Química', status: 'active' },
  { id: 'argos', name: 'Argos - Planta Cartagena', lat: 10.3958, lng: -75.4832, category: 'Cemento', status: 'active' },
  { id: 'ajover', name: 'Ajover S.A.', lat: 10.3972, lng: -75.4870, category: 'Plásticos', status: 'active' },
  { id: 'esenttia', name: 'Esenttia', lat: 10.3084, lng: -75.5179, category: 'Química', status: 'active' },
  { id: 'cabot', name: 'Cabot Colombiana', lat: 10.3049, lng: -75.5230, category: 'Química', status: 'active' },
];

export async function getCompaniesGeo(): Promise<GeoCompany[]> {
  const result: GeoCompany[] = [];
  const seenIds = new Set<string>();

  const addCompany = (c: GeoCompany) => {
    const key = c.company_id || c.id;
    if (seenIds.has(key)) return;
    seenIds.add(key);
    result.push(c);
  };

  try {
    // Estrategia 0: mv_cluster_companies (vista materializada)
    const { data: mvRows, error: mvErr } = await supabaseServer
      .from('mv_cluster_companies')
      .select('*');

    if (!mvErr && mvRows && mvRows.length > 0) {
      for (const row of mvRows as Array<Record<string, unknown>>) {
        const lat = Number(row.lat ?? row.latitude ?? row.site_lat);
        const lng = Number(row.lng ?? row.longitude ?? row.site_lng);
        const cid = (row.company_id ?? row.id) as string;
        const name = (row.name ?? row.company_name ?? row.site_name ?? 'Empresa') as string;

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          addCompany({ id: cid, name, lat, lng, category: row.city as string, status: row.status as string, company_id: cid });
        } else {
          const mock = MOCK_COMPANIES.find((m) =>
            m.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
          );
          if (mock) {
            addCompany({ id: cid, name, lat: mock.lat, lng: mock.lng, category: mock.category, status: row.status as string, company_id: cid });
          }
        }
      }
    } else if (mvErr) {
      console.warn('[companies-geo service] mv_cluster_companies no disponible:', mvErr.message);
    }

    // Estrategia 1: company_sites + companies
    // Supabase puede devolver la relación companies como objeto o como array.
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

      if (!sitesError && sites && sites.length > 0) {
        type SiteRow = Record<string, unknown> & {
          site_id?: unknown;
          company_id?: unknown;
          site_name?: unknown;
          lat?: unknown;
          lng?: unknown;
          city?: unknown;
          companies?: unknown;
        };
        for (const site of sites as SiteRow[]) {
          const rawCompanies = site.companies;
          const company =
            rawCompanies == null
              ? undefined
              : Array.isArray(rawCompanies)
                ? (rawCompanies[0] as Record<string, unknown> | undefined)
                : (rawCompanies as Record<string, unknown>);

          const lat = Number(site.lat);
          const lng = Number(site.lng);
          if (isNaN(lat) || isNaN(lng)) continue;

          addCompany({
            id: String(site.company_id ?? site.site_id ?? ''),
            name: String(company?.name ?? site.site_name ?? 'Empresa'),
            lat,
            lng,
            category: site.city != null ? String(site.city) : undefined,
            status: company?.status != null ? String(company.status) : undefined,
            company_id: site.company_id != null ? String(site.company_id) : undefined,
            site_id: site.site_id != null ? String(site.site_id) : undefined,
          });
        }
      }
    }

    // Estrategia 2: tabla companies
    if (result.length === 0) {
      const { data: companies, error: compErr } = await supabaseServer
        .from('companies')
        .select('company_id, name, status');

      if (!compErr && companies && companies.length > 0) {
        for (const co of companies as Array<Record<string, unknown>>) {
          const mock = MOCK_COMPANIES.find((m) =>
            m.name.toLowerCase().includes((co.name as string).toLowerCase()) ||
            (co.name as string).toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
          );
          if (mock) {
            addCompany({
              id: co.company_id as string,
              name: co.name as string,
              lat: mock.lat,
              lng: mock.lng,
              category: mock.category,
              status: co.status as string,
              company_id: co.company_id as string,
            });
          }
        }
      }
    }

    // Última instancia: mock de Cartagena
    if (result.length === 0) {
      return MOCK_COMPANIES;
    }

    const existingNames = new Set(result.map((c) => c.name.toLowerCase()));
    for (const mock of MOCK_COMPANIES) {
      if (result.length >= 6) break;
      if (!seenIds.has(mock.id) && !existingNames.has(mock.name.toLowerCase())) {
        addCompany(mock);
      }
    }

    return result;
  } catch (error) {
    console.error('[companies-geo service] Error inesperado:', error);
    return MOCK_COMPANIES;
  }
}
