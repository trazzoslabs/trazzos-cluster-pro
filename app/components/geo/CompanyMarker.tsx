'use client';

import { useEffect, useRef } from 'react';

// Importar Mapbox solo en el cliente
let mapboxgl: any;
if (typeof window !== 'undefined') {
  mapboxgl = require('mapbox-gl');
}

export interface CompanyMarkerCompany {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
  company_name?: string;
  site_name?: string;
}

interface CompanyMarkerProps {
  map: any;
  company: CompanyMarkerCompany;
  /** Texto del popup al hacer clic (p. ej. company_name legible). */
  displayLabel: string;
  isSelected: boolean;
  onClick: () => void;
  /** Reficar + sinergia activa: color ámbar y pulso destacado. */
  synergyActiveHighlight?: boolean;
}

export default function CompanyMarker({
  map,
  company,
  displayLabel,
  isSelected,
  onClick,
  synergyActiveHighlight = false,
}: CompanyMarkerProps) {
  const markerRef = useRef<any>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const popupInnerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    const el = document.createElement('div');
    el.className = 'company-marker';
    el.style.borderRadius = '50%';
    el.style.cursor = 'pointer';
    el.style.transition = 'all 0.3s ease';
    el.style.zIndex = isSelected ? '1000' : '100';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';

    const applyVisualState = () => {
      if (!elRef.current) return;
      const elNow = elRef.current;
      const baseSize = isSelected ? 32 : 24;
      elNow.style.width = `${baseSize}px`;
      elNow.style.height = `${baseSize}px`;
      elNow.style.border = isSelected ? '3px solid white' : '2px solid white';

      if (synergyActiveHighlight) {
        elNow.style.backgroundColor = isSelected ? '#fbbf24' : '#f59e0b';
        elNow.style.border = isSelected ? '3px solid #fef3c7' : '2px solid #fde68a';
        elNow.style.animation = 'reficar-synergy-pulse 1.6s ease-in-out infinite';
        elNow.style.boxShadow = '0 0 16px rgba(251, 191, 36, 0.55)';
      } else {
        elNow.style.backgroundColor = isSelected ? '#9aff8d' : '#9aff8d';
        elNow.style.boxShadow = isSelected
          ? '0 0 20px #9aff8d, 0 0 40px #9aff8d'
          : '0 0 10px rgba(154, 255, 141, 0.5)';
        elNow.style.animation = isSelected ? 'pulse 2s ease-in-out infinite' : 'none';
      }
      elNow.style.zIndex = isSelected ? '1000' : synergyActiveHighlight ? '500' : '100';
    };

    applyVisualState();
    elRef.current = el;

    const popupContent = document.createElement('div');
    popupInnerRef.current = popupContent;
    popupContent.className = 'geo-marker-popup-inner';
    popupContent.style.padding = '8px 10px';
    popupContent.style.fontSize = '13px';
    popupContent.style.fontWeight = '600';
    popupContent.style.color = '#18181b';
    popupContent.textContent = displayLabel;

    const popup = new mapboxgl.Popup({
      offset: 20,
      closeButton: true,
      closeOnClick: true,
      maxWidth: '280px',
      className: 'geo-company-popup',
    }).setDOMContent(popupContent);

    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
    })
      .setLngLat([company.lng, company.lat])
      .setPopup(popup)
      .addTo(map);

    const onMarkerClick = (e: MouseEvent) => {
      e.stopPropagation();
      popupContent.textContent = displayLabel;
      onClick();
    };
    el.addEventListener('click', onMarkerClick);

    markerRef.current = marker;

    return () => {
      el.removeEventListener('click', onMarkerClick);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      popupInnerRef.current = null;
      elRef.current = null;
    };
  }, [map, company.lat, company.lng, onClick]);

  useEffect(() => {
    if (popupInnerRef.current) popupInnerRef.current.textContent = displayLabel;
  }, [displayLabel]);

  useEffect(() => {
    if (!elRef.current) return;
    const elNow = elRef.current;
    const baseSize = isSelected ? 32 : 24;
    elNow.style.width = `${baseSize}px`;
    elNow.style.height = `${baseSize}px`;
    elNow.style.border = isSelected ? '3px solid white' : '2px solid white';

    if (synergyActiveHighlight) {
      elNow.style.backgroundColor = isSelected ? '#fbbf24' : '#f59e0b';
      elNow.style.border = isSelected ? '3px solid #fef3c7' : '2px solid #fde68a';
      elNow.style.animation = 'reficar-synergy-pulse 1.6s ease-in-out infinite';
      elNow.style.boxShadow = '0 0 16px rgba(251, 191, 36, 0.55)';
    } else {
      elNow.style.backgroundColor = '#9aff8d';
      elNow.style.boxShadow = isSelected
        ? '0 0 20px #9aff8d, 0 0 40px #9aff8d'
        : '0 0 10px rgba(154, 255, 141, 0.5)';
      elNow.style.animation = isSelected ? 'pulse 2s ease-in-out infinite' : 'none';
    }
    elNow.style.zIndex = isSelected ? '1000' : synergyActiveHighlight ? '500' : '100';
  }, [isSelected, synergyActiveHighlight]);

  return null;
}
