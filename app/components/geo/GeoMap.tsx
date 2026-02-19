'use client';

import { useEffect, useRef, useState } from 'react';
import CompanyMarker from './CompanyMarker';

// Importar Mapbox solo en el cliente para evitar problemas de SSR
let mapboxgl: any;
if (typeof window !== 'undefined') {
  mapboxgl = require('mapbox-gl');
}

interface GeoCompany {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
}

interface GeoMapProps {
  companies: GeoCompany[];
  selectedCompanyId: string | null;
  onCompanySelect: (companyId: string) => void;
  is3DMode?: boolean;
  showConnections: boolean;
  synergies?: Array<{
    companies_involved_json: any;
    status: string | null;
    volume_total_json: any;
  }>;
}

export default function GeoMap({
  companies,
  selectedCompanyId,
  onCompanySelect,
  is3DMode = true, // Siempre 3D por defecto
  showConnections,
  synergies = [],
}: GeoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!mapboxToken) {
      console.warn('Mapbox token not found. Using fallback view.');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Inicializar mapa
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-75.5, 10.33], // Cartagena
      zoom: 11,
      pitch: is3DMode ? 65 : 0,
      bearing: 0,
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);

      // Activar terreno 3D si está en modo 3D
      if (is3DMode) {
        try {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 256,
            maxzoom: 14,
          });

          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

          // Agregar sky layer
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

  // Actualizar modo 3D/2D
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    if (is3DMode) {
      map.easeTo({
        pitch: 65,
        duration: 800,
      });

      // Intentar agregar terreno si no está
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

  // Dibujar conexiones de sinergias
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showConnections) return;

    const map = mapRef.current;

    // Remover capa anterior si existe
    if (map.getLayer('synergy-lines')) {
      map.removeLayer('synergy-lines');
    }
    if (map.getSource('synergy-lines')) {
      map.removeSource('synergy-lines');
    }

    // Crear GeoJSON para las líneas
    const features: any[] = [];

    synergies.forEach((synergy) => {
      try {
        const companiesInvolved = synergy.companies_involved_json;
        if (!Array.isArray(companiesInvolved) || companiesInvolved.length < 2) return;

        // Encontrar coordenadas de las empresas involucradas
        const coords: [number, number][] = [];
        companiesInvolved.forEach((companyName: string) => {
          const company = companies.find(c => 
            c.name.toLowerCase().includes(companyName.toLowerCase()) ||
            companyName.toLowerCase().includes(c.name.toLowerCase())
          );
          if (company) {
            coords.push([company.lng, company.lat]);
          }
        });

        if (coords.length >= 2) {
          const volume = synergy.volume_total_json?.total || synergy.volume_total_json?.total_units || 0;
          const width = Math.max(1, Math.min(5, 1 + (volume / 1000000)));

          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {
              status: synergy.status || 'pending',
              volume: volume,
              width: width,
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
  }, [mapLoaded, showConnections, synergies, companies]);

  // Fly to empresa seleccionada
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedCompanyId) return;

    const company = companies.find(c => c.id === selectedCompanyId);
    if (!company) return;

    mapRef.current.flyTo({
      center: [company.lng, company.lat],
      zoom: 13,
      pitch: is3DMode ? 65 : 45,
      bearing: Math.random() * 360,
      duration: 1200,
    });
  }, [selectedCompanyId, mapLoaded, is3DMode, companies]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <div className="h-full w-full bg-black/50 rounded-lg border border-zinc-800 flex items-center justify-center">
        <div className="text-center p-8">
          <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
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
      
      {/* Renderizar marcadores */}
      {mapLoaded && mapRef.current && companies.map((company) => (
        <CompanyMarker
          key={company.id}
          map={mapRef.current}
          company={company}
          isSelected={selectedCompanyId === company.id}
          onClick={() => onCompanySelect(company.id)}
        />
      ))}
    </div>
  );
}

