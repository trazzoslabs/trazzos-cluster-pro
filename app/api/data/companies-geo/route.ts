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

// Datos mock como fallback (coordenadas de Cartagena, Colombia)
const MOCK_COMPANIES: GeoCompany[] = [
  {
    id: 'reficar',
    name: 'Reficar (Ecopetrol)',
    lat: 10.3139,
    lng: -75.5114,
    category: 'Refinería',
    status: 'active',
  },
  {
    id: 'yara',
    name: 'Yara Colombia',
    lat: 10.3098,
    lng: -75.5165,
    category: 'Química',
    status: 'active',
  },
  {
    id: 'argos',
    name: 'Argos - Planta Cartagena',
    lat: 10.3958,
    lng: -75.4832,
    category: 'Cemento',
    status: 'active',
  },
  {
    id: 'ajover',
    name: 'Ajover S.A.',
    lat: 10.3972,
    lng: -75.4870,
    category: 'Plásticos',
    status: 'active',
  },
  {
    id: 'esenttia',
    name: 'Esenttia',
    lat: 10.3084,
    lng: -75.5179,
    category: 'Química',
    status: 'active',
  },
  {
    id: 'cabot',
    name: 'Cabot Colombiana',
    lat: 10.3049,
    lng: -75.5230,
    category: 'Química',
    status: 'active',
  },
];

export async function GET(request: NextRequest) {
  try {
    // Intentar obtener datos de company_sites con coordenadas
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
        companies!inner (
          company_id,
          name,
          status
        )
      `)
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (sitesError) {
      console.error('Error fetching company sites:', sitesError);
      // Retornar datos mock si hay error
      return createSuccessResponse(MOCK_COMPANIES);
    }

    if (!sites || sites.length === 0) {
      // Si no hay datos, retornar mock
      return createSuccessResponse(MOCK_COMPANIES);
    }

    // Transformar datos de Supabase al formato esperado
    const geoCompanies: GeoCompany[] = sites.map((site: any) => {
      const company = site.companies;
      return {
        id: site.company_id || site.site_id,
        name: company?.name || site.site_name || 'Empresa',
        lat: parseFloat(site.lat),
        lng: parseFloat(site.lng),
        category: site.city || undefined,
        status: company?.status || 'active',
        company_id: site.company_id,
        site_id: site.site_id,
      };
    });

    // Si hay menos de 6 empresas, complementar con mock
    if (geoCompanies.length < 6) {
      const existingNames = new Set(geoCompanies.map(c => c.name.toLowerCase()));
      const additional = MOCK_COMPANIES.filter(
        mock => !existingNames.has(mock.name.toLowerCase())
      ).slice(0, 6 - geoCompanies.length);
      geoCompanies.push(...additional);
    }

    return createSuccessResponse(geoCompanies);
  } catch (error) {
    console.error('Error in companies-geo endpoint:', error);
    // En caso de error, retornar datos mock
    return createSuccessResponse(MOCK_COMPANIES);
  }
}



