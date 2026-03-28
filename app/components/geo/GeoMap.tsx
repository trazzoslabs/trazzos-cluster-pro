'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompaniesInvolvedJson, VolumeTotalJsonValue } from '@/lib/types/synergies';
import { companyEntryId, companyEntryName, extractVolumeTotal } from '@/lib/types/synergies';
import CompanyMarker from './CompanyMarker';

// Importar Mapbox solo en el cliente para evitar problemas de SSR
let mapboxgl: any;
if (typeof window !== 'undefined') {
  mapboxgl = require('mapbox-gl');
}

/** Coordenadas de referencia Reficar (Cartagena / zona industrial). */
export const REFICAR_MAP_LAT = 10.3205;
export const REFICAR_MAP_LNG = -75.4952;
const REFICAR_COORD_EPS = 0.035;

/** UUID sandbox Reficar (ingesta fija). */
const REFICAR_COMPANY_ID_SANDBOX = 'aaaa1111-1111-4111-a111-111111111111';

export interface GeoCompany {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
  company_name?: string;
  site_name?: string;
}

export type GeoMapProps = {
  companies: GeoCompany[];
  selectedCompanyId: string | null;
  onCompanySelect: (companyId: string) => void;
  is3DMode?: boolean;
  showConnections: boolean;
  synergies?: Array<{
    companies_involved_json: CompaniesInvolvedJson;
    status: string | null;
    volume_total_json: VolumeTotalJsonValue;
  }>;
};

function hasValidLatLng(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return true;
}

function isLikelyUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

/** Etiqueta legible para popup: prioriza company_name y evita mostrar solo UUID. */
export function mapMarkerDisplayLabel(company: GeoCompany): string {
  const cn = company.company_name?.trim();
  if (cn) return cn;
  const sn = company.site_name?.trim();
  const rawName = company.name?.trim() ?? '';
  if (rawName && !isLikelyUuid(rawName)) return rawName;
  if (sn) return sn;
  return rawName || 'Empresa';
}

function isReficarSite(company: GeoCompany): boolean {
  const label = `${company.name} ${company.company_name ?? ''} ${mapMarkerDisplayLabel(company)}`.toLowerCase();
  if (label.includes('reficar')) return true;
  const dLat = Math.abs(company.lat - REFICAR_MAP_LAT);
  const dLng = Math.abs(company.lng - REFICAR_MAP_LNG);
  return dLat <= REFICAR_COORD_EPS && dLng <= REFICAR_COORD_EPS;
}

function synergyEntryInvolvesReficar(entry: CompaniesInvolvedJson[number]): boolean {
  const name = companyEntryName(entry).toLowerCase();
  if (name.includes('reficar')) return true;
  const id = companyEntryId(entry);
  if (id && id.toLowerCase() === REFICAR_COMPANY_ID_SANDBOX) return true;
  return false;
}

function isSynergyWorkflowActive(status: string | null): boolean {
  const s = (status || '').trim().toLowerCase();
  if (!s) return true;
  return !['completed', 'failed', 'error', 'cancelled', 'closed', 'rejected'].includes(s);
}

function computeReficarSynergyActive(
  synergies: GeoMapProps['synergies'],
): boolean {
  if (!synergies?.length) return false;
  return synergies.some((synergy) => {
    if (!isSynergyWorkflowActive(synergy.status)) return false;
    const involved = synergy.companies_involved_json;
    if (!Array.isArray(involved)) return false;
    return involved.some((e) => synergyEntryInvolvesReficar(e));
  });
}

export default function GeoMap({
  companies,
  selectedCompanyId,
  onCompanySelect,
  is3DMode = true,
  showConnections,
  synergies = [],
}: GeoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const companiesWithCoords = useMemo(
    () => companies.filter((c) => hasValidLatLng(c.lat, c.lng)),
    [companies],
  );

  const reficarSynergyActive = useMemo(
    () => computeReficarSynergyActive(synergies),
    [synergies],
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!mapboxToken) {
      console.warn('[GeoMap] Mapbox token no encontrado.');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-75.5, 10.33],
      zoom: 11,
      pitch: is3DMode ? 65 : 0,
      bearing: 0,
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);

      if (is3DMode) {
        try {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 256,
            maxzoom: 14,
          });

          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': 15,
            },
          });
        } catch (error) {
          console.warn('Could not add terrain/sky:', error);
        }
      }
    });

    return () => {
      map.remove();
    };
  }, [is3DMode]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    if (is3DMode) {
      map.easeTo({
        pitch: 65,
        duration: 800,
      });

      if (!map.getSource('mapbox-dem')) {
        try {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 256,
            maxzoom: 14,
          });
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
        } catch (error) {
          console.warn('Could not add terrain:', error);
        }
      }
    } else {
      map.easeTo({
        pitch: 0,
        duration: 800,
      });
    }
  }, [is3DMode, mapLoaded]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showConnections) return;

    const map = mapRef.current;

    if (map.getLayer('synergy-lines')) {
      map.removeLayer('synergy-lines');
    }
    if (map.getSource('synergy-lines')) {
      map.removeSource('synergy-lines');
    }

    const features: any[] = [];

    synergies.forEach((synergy) => {
      try {
        const companiesInvolved = synergy.companies_involved_json;
        if (!Array.isArray(companiesInvolved) || companiesInvolved.length < 2) return;

        const coords: [number, number][] = [];
        companiesInvolved.forEach((entry) => {
          const companyName = companyEntryName(entry);
          const company = companiesWithCoords.find(
            (c) =>
              c.name.toLowerCase().includes(companyName.toLowerCase()) ||
              companyName.toLowerCase().includes(c.name.toLowerCase()) ||
              (c.company_name &&
                companyName.toLowerCase().includes(c.company_name.toLowerCase())),
          );
          if (company && hasValidLatLng(company.lat, company.lng)) {
            coords.push([company.lng, company.lat]);
          }
        });

        if (coords.length >= 2) {
          const volume = extractVolumeTotal(synergy.volume_total_json);
          const width = Math.max(1, Math.min(5, 1 + volume / 1000000));

          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {
              status: synergy.status || 'pending',
              volume,
              width,
            },
          });
        }
      } catch (error) {
        console.warn('Error processing synergy:', error);
      }
    });

    if (features.length > 0) {
      map.addSource('synergy-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      map.addLayer({
        id: 'synergy-lines',
        type: 'line',
        source: 'synergy-lines',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'status'], 'approved'],
            '#9aff8d',
            ['==', ['get', 'status'], 'rfp'],
            '#ffd700',
            '#6b7280',
          ],
          'line-width': ['get', 'width'],
          'line-opacity': 0.6,
        },
      });
    }

    return () => {
      if (map.getLayer('synergy-lines')) {
        map.removeLayer('synergy-lines');
      }
      if (map.getSource('synergy-lines')) {
        map.removeSource('synergy-lines');
      }
    };
  }, [mapLoaded, showConnections, synergies, companiesWithCoords]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedCompanyId) return;

    const company = companiesWithCoords.find((c) => c.id === selectedCompanyId);
    if (!company || !hasValidLatLng(company.lat, company.lng)) return;

    mapRef.current.flyTo({
      center: [company.lng, company.lat],
      zoom: 13,
      pitch: is3DMode ? 65 : 45,
      bearing: Math.random() * 360,
      duration: 1200,
    });
  }, [selectedCompanyId, mapLoaded, is3DMode, companiesWithCoords]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <div className="h-full w-full bg-black/50 rounded-lg border border-zinc-800 flex items-center justify-center">
        <div className="text-center p-8">
          <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-zinc-400 text-xl font-semibold mb-2">Mapbox Token Requerido</p>
          <p className="text-zinc-500 text-sm mb-4">
            Para usar la vista geoespacial 3D, necesitas configurar un token de Mapbox.
          </p>
          <a
            href="/docs/geo.md"
            className="inline-block px-4 py-2 bg-[#9aff8d]/10 text-[#9aff8d] rounded-lg text-sm font-medium hover:bg-[#9aff8d]/20 transition-colors border border-[#9aff8d]/30"
          >
            Ver Instrucciones
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full rounded-lg overflow-hidden" />

      {mapLoaded &&
        mapRef.current &&
        companiesWithCoords.map((company) => (
          <CompanyMarker
            key={company.id}
            map={mapRef.current}
            company={company}
            displayLabel={mapMarkerDisplayLabel(company)}
            isSelected={selectedCompanyId === company.id}
            synergyActiveHighlight={reficarSynergyActive && isReficarSite(company)}
            onClick={() => onCompanySelect(company.id)}
          />
        ))}
    </div>
  );
}
