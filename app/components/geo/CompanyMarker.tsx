'use client';

import { useEffect, useRef } from 'react';

// Importar Mapbox solo en el cliente
let mapboxgl: any;
if (typeof window !== 'undefined') {
  mapboxgl = require('mapbox-gl');
}

interface CompanyMarkerProps {
  map: any;
  company: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    category?: string;
    status?: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

export default function CompanyMarker({
  map,
  company,
  isSelected,
  onClick,
}: CompanyMarkerProps) {
  const markerRef = useRef<any>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    // Crear elemento HTML para el marcador
    const el = document.createElement('div');
    el.className = 'company-marker';
    el.style.width = isSelected ? '32px' : '24px';
    el.style.height = isSelected ? '32px' : '24px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = isSelected ? '#9aff8d' : '#9aff8d';
    el.style.border = isSelected ? '3px solid white' : '2px solid white';
    el.style.cursor = 'pointer';
    el.style.boxShadow = isSelected
      ? '0 0 20px #9aff8d, 0 0 40px #9aff8d'
      : '0 0 10px rgba(154, 255, 141, 0.5)';
    el.style.transition = 'all 0.3s ease';
    el.style.zIndex = isSelected ? '1000' : '100';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';

    // Agregar pulso si está seleccionado
    if (isSelected) {
      el.style.animation = 'pulse 2s ease-in-out infinite';
    }

    // Crear marcador
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
    })
      .setLngLat([company.lng, company.lat])
      .addTo(map);

    // Agregar evento click
    el.addEventListener('click', onClick);

    markerRef.current = marker;
    elRef.current = el;

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (elRef.current) {
        elRef.current.removeEventListener('click', onClick);
      }
    };
  }, [map, company.lat, company.lng, onClick]);

  // Actualizar estilo cuando cambia la selección
  useEffect(() => {
    if (!elRef.current) return;

    elRef.current.style.width = isSelected ? '32px' : '24px';
    elRef.current.style.height = isSelected ? '32px' : '24px';
    elRef.current.style.border = isSelected ? '3px solid white' : '2px solid white';
    elRef.current.style.boxShadow = isSelected
      ? '0 0 20px #9aff8d, 0 0 40px #9aff8d'
      : '0 0 10px rgba(154, 255, 141, 0.5)';
    elRef.current.style.zIndex = isSelected ? '1000' : '100';

    if (isSelected) {
      elRef.current.style.animation = 'pulse 2s ease-in-out infinite';
    } else {
      elRef.current.style.animation = 'none';
    }
  }, [isSelected]);

  return null;
}

