'use client';

/**
 * Mapa geoespacial del cluster (sinergias + empresas) usado en el Centro de Inteligencia Visual.
 * La implementación vive en `app/components/geo/GeoMap.tsx`; este módulo es el punto de entrada
 * pedido para la vista de sinergias / inteligencia.
 */
export { default } from '@/app/components/geo/GeoMap';
export type { GeoCompany, GeoMapProps } from '@/app/components/geo/GeoMap';
export { mapMarkerDisplayLabel, REFICAR_MAP_LAT, REFICAR_MAP_LNG } from '@/app/components/geo/GeoMap';
