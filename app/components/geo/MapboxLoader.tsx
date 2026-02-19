'use client';

import { useEffect } from 'react';

// Componente para cargar CSS de Mapbox de manera segura
export default function MapboxLoader() {
  useEffect(() => {
    // Cargar CSS de Mapbox solo en el cliente
    if (typeof window !== 'undefined') {
      // Verificar si ya existe
      const existingLink = document.querySelector('link[href*="mapbox-gl"]');
      if (!existingLink) {
        // Cargar desde CDN de Mapbox (más confiable que require)
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    }
  }, []);

  return null;
}

