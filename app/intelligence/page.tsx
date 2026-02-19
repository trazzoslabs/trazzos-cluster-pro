'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';
import FactoryModel from './components/FactoryModel';
import MapboxLoader from '../components/geo/MapboxLoader';
import GeoSidebar from '../components/geo/GeoSidebar';

// Importar GeoMap dinámicamente para evitar problemas de SSR
const GeoMap = dynamic(() => import('../components/geo/GeoMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-black/50 rounded-lg border border-zinc-800 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d]"></div>
        <p className="text-zinc-400 mt-4">Cargando mapa...</p>
      </div>
    </div>
  ),
});

interface Synergy {
  synergy_id: string;
  cluster_id: string | null;
  item_category: string;
  window_start: string;
  window_end: string;
  companies_involved_json: any;
  volume_total_json: any;
  status: string | null;
  created_at: string | null;
}

interface Rfp {
  rfp_id: string;
  synergy_id: string | null;
  status: string | null;
  closing_at: string;
  created_at: string | null;
}

interface PurchaseOrder {
  po_id: string;
  rfp_id: string | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string | null;
}

interface CommitteeDecision {
  decision_id: string;
  rfp_id: string | null;
  decision: string | null;
  decided_at: string | null;
}

type ViewMode = '3d' | 'network' | 'analytics' | 'timeline' | 'geospatial';

// Lista de empresas del cluster
const COMPANIES = [
  'Reficar',
  'Yara',
  'Argos',
  'Ajover',
  'Esenttia',
  'Cabot',
];

// Coordenadas de empresas
const COMPANY_COORDINATES: { [key: string]: { name: string; lat: number; lng: number } } = {
  'Reficar': { name: 'Reficar (Ecopetrol)', lat: 10.3139, lng: -75.5114 },
  'Yara': { name: 'Yara Colombia', lat: 10.3098, lng: -75.5165 },
  'Argos': { name: 'Argos - Planta Cartagena', lat: 10.3958, lng: -75.4832 },
  'Ajover': { name: 'Ajover S.A.', lat: 10.3972, lng: -75.4870 },
  'Esenttia': { name: 'Esenttia', lat: 10.3084, lng: -75.5179 },
  'Cabot': { name: 'Cabot Colombiana', lat: 10.3049, lng: -75.5230 },
};

// Componente de Vista Geoespacial
function GeospatialView({ 
  synergies, 
  purchaseOrders, 
  totalSavings, 
  activeSynergies,
  onSwitchMode 
}: { 
  synergies: Synergy[]; 
  purchaseOrders: PurchaseOrder[]; 
  totalSavings: number;
  activeSynergies: number;
  onSwitchMode: (mode: ViewMode) => void;
}) {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [showSynergyLines, setShowSynergyLines] = useState(true);
  const [mapState, setMapState] = useState({ center: { lat: 10.33, lng: -75.50 }, zoom: 12 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  // Proyección de coordenadas a píxeles (Mercator simplificado)
  const project = (lat: number, lng: number, width: number, height: number) => {
    const centerLat = mapState.center.lat;
    const centerLng = mapState.center.lng;
    const scale = Math.pow(2, mapState.zoom - 10) * 1000;
    
    const x = width / 2 + (lng - centerLng) * scale;
    const y = height / 2 - (lat - centerLat) * scale;
    
    return { x, y };
  };

  // Handlers para zoom y pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setMapState(prev => ({
      ...prev,
      zoom: Math.max(10, Math.min(15, prev.zoom + delta * 0.5))
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStart.x) / Math.pow(2, mapState.zoom - 10) / 1000;
    const dy = (e.clientY - dragStart.y) / Math.pow(2, mapState.zoom - 10) / 1000;
    
    setMapState(prev => ({
      ...prev,
      center: {
        lat: prev.center.lat + dy,
        lng: prev.center.lng - dx
      }
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Obtener sinergias entre empresas
  const getSynergyConnections = () => {
    const connections: Array<{ from: string; to: string; status: string; impact: number }> = [];
    
    synergies.forEach(synergy => {
      try {
        const companies = synergy.companies_involved_json;
        if (Array.isArray(companies) && companies.length >= 2) {
          for (let i = 0; i < companies.length; i++) {
            for (let j = i + 1; j < companies.length; j++) {
              const from = companies[i];
              const to = companies[j];
              if (from && to && COMPANY_COORDINATES[from] && COMPANY_COORDINATES[to]) {
                const volume = synergy.volume_total_json?.total || synergy.volume_total_json || 0;
                connections.push({
                  from,
                  to,
                  status: synergy.status || 'pending',
                  impact: typeof volume === 'number' ? volume : 0,
                });
              }
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });
    
    return connections;
  };

  const connections = getSynergyConnections();
  const selectedCompanyData = selectedCompany ? COMPANY_COORDINATES[selectedCompany] : null;
  const companySynergies = selectedCompany 
    ? synergies.filter(s => {
        try {
          const companies = s.companies_involved_json;
          return Array.isArray(companies) && companies.includes(selectedCompany);
        } catch {
          return false;
        }
      })
    : [];

  return (
    <div className="space-y-4">
      {/* Métrica superior flotante */}
      <div className="flex justify-center">
        <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-5 min-w-[400px]">
          <div className="text-center">
            <p className="text-zinc-400 text-sm mb-2">Potencial de Ahorro Territorial</p>
            <p className="text-3xl font-bold text-[#9aff8d] mb-3">
              US$ {totalSavings.toLocaleString('es-CO')}
            </p>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <span className="text-zinc-400">Empresas activas: </span>
                <span className="text-white font-semibold">{Object.keys(COMPANY_COORDINATES).length}</span>
              </div>
              <div>
                <span className="text-zinc-400">Sinergias activas: </span>
                <span className="text-white font-semibold">{activeSynergies}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <SectionCard title="Vista Geoespacial" description="Distribución geográfica del cluster">
        <div className="relative">
          {/* Controles */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <button
              onClick={() => setShowSynergyLines(!showSynergyLines)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                showSynergyLines
                  ? 'bg-[#9aff8d]/10 text-[#9aff8d] border border-[#9aff8d]/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {showSynergyLines ? 'Ocultar' : 'Mostrar'} Líneas
            </button>
            <div className="flex flex-col gap-1 bg-zinc-800/90 rounded-lg p-1 border border-zinc-700">
              <button
                onClick={() => setMapState(prev => ({ ...prev, zoom: Math.min(15, prev.zoom + 1) }))}
                className="px-2 py-1 rounded text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
              >
                +
              </button>
              <button
                onClick={() => setMapState(prev => ({ ...prev, zoom: Math.max(10, prev.zoom - 1) }))}
                className="px-2 py-1 rounded text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
              >
                −
              </button>
            </div>
            <button
              onClick={() => setMapState({ center: { lat: 10.33, lng: -75.50 }, zoom: 12 })}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 transition-all"
            >
              Reset
            </button>
          </div>

          {/* Mapa SVG */}
          <div 
            ref={mapRef}
            className="h-[600px] bg-black/50 rounded-lg border border-zinc-800 relative overflow-hidden cursor-move"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid de fondo */}
            <svg className="w-full h-full absolute inset-0" viewBox="0 0 800 600">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(154, 255, 141, 0.05)" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Mapa principal */}
            <svg className="w-full h-full relative z-10" viewBox="0 0 800 600">
              {/* Líneas de sinergia */}
              {showSynergyLines && connections.map((conn, idx) => {
                const fromCoords = COMPANY_COORDINATES[conn.from];
                const toCoords = COMPANY_COORDINATES[conn.to];
                if (!fromCoords || !toCoords) return null;
                
                const from = project(fromCoords.lat, fromCoords.lng, 800, 600);
                const to = project(toCoords.lat, toCoords.lng, 800, 600);
                
                const color = conn.status === 'approved' ? '#9aff8d' : 
                             conn.status === 'rfp' ? '#ffd700' : '#6b7280';
                const width = Math.max(1, Math.min(4, 1 + (conn.impact / 1000000)));
                
                return (
                  <line
                    key={`line-${idx}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={color}
                    strokeWidth={width}
                    strokeOpacity={0.4}
                    className="transition-opacity"
                  />
                );
              })}

              {/* Marcadores de empresas */}
              {Object.entries(COMPANY_COORDINATES).map(([key, company]) => {
                const coords = project(company.lat, company.lng, 800, 600);
                const isSelected = selectedCompany === key;
                const companySynergyCount = synergies.filter(s => {
                  try {
                    const companies = s.companies_involved_json;
                    return Array.isArray(companies) && companies.includes(key);
                  } catch {
                    return false;
                  }
                }).length;

                return (
                  <g key={key} className="cursor-pointer">
                    {/* Glow */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={isSelected ? 20 : 15}
                      fill="#9aff8d"
                      opacity={isSelected ? 0.3 : 0.2}
                      className="transition-all"
                    />
                    {/* Marcador */}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={isSelected ? 12 : 10}
                      fill="#9aff8d"
                      stroke="#000"
                      strokeWidth={2}
                      onClick={() => setSelectedCompany(isSelected ? null : key)}
                      className="hover:opacity-80 transition-all"
                      style={{ filter: 'drop-shadow(0 0 8px #9aff8d)' }}
                    />
                    {/* Label */}
                    <text
                      x={coords.x}
                      y={coords.y - 20}
                      textAnchor="middle"
                      className="text-xs fill-zinc-300 font-medium pointer-events-none"
                    >
                      {key}
                    </text>
                    {/* Contador de sinergias */}
                    {companySynergyCount > 0 && (
                      <text
                        x={coords.x}
                        y={coords.y + 5}
                        textAnchor="middle"
                        className="text-[10px] fill-[#9aff8d] font-bold pointer-events-none"
                      >
                        {companySynergyCount}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </SectionCard>

      {/* Panel lateral flotante */}
      {selectedCompanyData && (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 w-80 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-5 shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-white font-bold text-lg">{selectedCompanyData.name}</h3>
            <button
              onClick={() => setSelectedCompany(null)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Tipo de compañía</p>
              <p className="text-white text-sm font-medium">Industrial</p>
            </div>

            <div>
              <p className="text-zinc-400 text-xs mb-1">Sinergias activas</p>
              <p className="text-white text-sm font-semibold">{companySynergies.length}</p>
            </div>

            <div>
              <p className="text-zinc-400 text-xs mb-1">Potencial de ahorro asociado</p>
              <p className="text-[#9aff8d] text-sm font-bold">
                US$ {companySynergies.reduce((sum, s) => {
                  const volume = s.volume_total_json?.total || s.volume_total_json || 0;
                  return sum + (typeof volume === 'number' ? volume * 0.1 : 0);
                }, 0).toLocaleString('es-CO')}
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex gap-2">
              <button
                onClick={() => onSwitchMode('3d')}
                className="flex-1 px-3 py-2 bg-[#9aff8d]/10 text-[#9aff8d] rounded-lg text-sm font-medium hover:bg-[#9aff8d]/20 transition-colors border border-[#9aff8d]/30"
              >
                Ver en 3D
              </button>
              <button
                onClick={() => onSwitchMode('network')}
                className="flex-1 px-3 py-2 bg-[#9aff8d]/10 text-[#9aff8d] rounded-lg text-sm font-medium hover:bg-[#9aff8d]/20 transition-colors border border-[#9aff8d]/30"
              >
                Ver Red
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelligencePage() {
  const [activeMode, setActiveMode] = useState<ViewMode>('3d');
  const [synergies, setSynergies] = useState<Synergy[]>([]);
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [decisions, setDecisions] = useState<CommitteeDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30' | '90' | '365'>('90');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [geoCompanies, setGeoCompanies] = useState<any[]>([]);
  const [geoSelectedCompanyId, setGeoSelectedCompanyId] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeMode === '3d' && canvasRef.current && synergies.length > 0) {
      const cleanup = init3DView();
      return cleanup;
    }
  }, [activeMode, synergies]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [synergiesRes, rfpsRes, posRes, decisionsRes, companiesGeoRes] = await Promise.all([
        fetch('/api/data/synergies'),
        fetch('/api/data/rfps'),
        fetch('/api/data/purchase-orders'),
        fetch('/api/data/committee-decisions'),
        fetch('/api/data/companies-geo'),
      ]);

      const synergiesData = await synergiesRes.json();
      const rfpsData = await rfpsRes.json();
      const posData = await posRes.json();
      const decisionsData = await decisionsRes.json();
      const companiesGeoData = await companiesGeoRes.json();

      setSynergies(synergiesData.data || []);
      setRfps(rfpsData.data || []);
      setPurchaseOrders(posData.data || []);
      setDecisions(decisionsData.data || []);
      setGeoCompanies(companiesGeoData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const init3DView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const centerX = canvas.width / (2 * window.devicePixelRatio);
    const centerY = canvas.height / (2 * window.devicePixelRatio);
    type NodeType = { 
      x: number; 
      y: number; 
      z: number; 
      size: number; 
      color: string; 
      label: string;
      angle: number;
      radius: number;
      baseZ: number;
    };
    
    const nodes: Array<NodeType> = [];

    // Crear nodos desde sinergias con estructura 3D
    const synergyCount = Math.min(synergies.length, 12);
    synergies.slice(0, synergyCount).forEach((synergy, i) => {
      const angle = (i / synergyCount) * Math.PI * 2;
      const radius = 120 + Math.random() * 40;
      const baseZ = Math.random() * 80 - 40;
      
      const status = synergy.status || 'pending';
      const color = status === 'approved' ? '#9aff8d' : status === 'rfp' ? '#ffd700' : '#6b7280';
      
      // Obtener empresas involucradas o asignar una aleatoria
      let companyName = 'Cluster';
      try {
        const companies = synergy.companies_involved_json;
        if (Array.isArray(companies) && companies.length > 0) {
          companyName = companies[0] || COMPANIES[i % COMPANIES.length];
        } else if (typeof companies === 'string') {
          companyName = companies;
        } else {
          companyName = COMPANIES[i % COMPANIES.length];
        }
      } catch {
        companyName = COMPANIES[i % COMPANIES.length];
      }
      
      nodes.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        z: baseZ,
        size: 15 + Math.abs(baseZ) / 5,
        color,
        label: companyName,
        angle,
        radius,
        baseZ,
      });
    });

    // Nodo central (cluster)
    nodes.push({
      x: centerX,
      y: centerY,
      z: 0,
      size: 35,
      color: '#9aff8d',
      label: 'Cluster Industrial',
      angle: 0,
      radius: 0,
      baseZ: 0,
    });

    let rotation = 0;
    let frameCount = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
      
      rotation += 0.005;
      frameCount++;

      // Ordenar nodos por Z para perspectiva
      const sortedNodes = [...nodes].sort((a, b) => {
        const zA = a.baseZ + Math.sin(rotation + a.angle) * 20;
        const zB = b.baseZ + Math.sin(rotation + b.angle) * 20;
        return zA - zB;
      });

      // Dibujar líneas de conexión (solo las más cercanas)
      ctx.strokeStyle = 'rgba(154, 255, 141, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const nodeA = sortedNodes[i];
        const nodeB = sortedNodes[i + 1];
        
        // Solo conectar nodos cercanos
        const dist = Math.sqrt((nodeA.x - nodeB.x) ** 2 + (nodeA.y - nodeB.y) ** 2);
        if (dist < 200) {
          ctx.beginPath();
          ctx.moveTo(nodeA.x, nodeA.y);
          ctx.lineTo(nodeB.x, nodeB.y);
          ctx.stroke();
        }
      }

      // Dibujar nodos
      sortedNodes.forEach((node) => {
        const zOffset = Math.sin(rotation + node.angle) * 20;
        const currentZ = node.baseZ + zOffset;
        const scale = 1 + (currentZ / 100);
        const displaySize = node.size * scale;
        const alpha = Math.min(1, 0.6 + (currentZ + 40) / 80);
        const isSelected = selectedCompanyId === node.label;

        // Glow effect (más intenso si está seleccionado)
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, displaySize * (isSelected ? 3 : 2));
        gradient.addColorStop(0, node.color + Math.floor(alpha * (isSelected ? 255 : 255)).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.3, node.color + Math.floor(alpha * (isSelected ? 200 : 128)).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, displaySize * (isSelected ? 3 : 2), 0, Math.PI * 2);
        ctx.fill();

        // Nodo principal (hexágono) - más grande si está seleccionado
        ctx.fillStyle = node.color;
        ctx.beginPath();
        const sides = 6;
        const finalSize = displaySize * (isSelected ? 1.15 : 1);
        for (let i = 0; i < sides; i++) {
          const angle = (Math.PI * 2 * i) / sides;
          const x = node.x + Math.cos(angle) * finalSize;
          const y = node.y + Math.sin(angle) * finalSize;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Guardar información del nodo para detección de clicks
        (node as any).displayX = node.x;
        (node as any).displayY = node.y;
        (node as any).displaySize = finalSize;
      });

      requestAnimationFrame(animate);
    };

    animate();

    // Handler de clicks para detectar nodos
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio;
      const x = (e instanceof MouseEvent ? e.clientX : e.touches[0].clientX) - rect.left;
      const y = (e instanceof MouseEvent ? e.clientY : e.touches[0].clientY) - rect.top;
      
      // Buscar el nodo más cercano al click
      let closestNode: NodeType | null = null;
      let minDist = Infinity;
      
      nodes.forEach((node) => {
        const nodeX = node.x;
        const nodeY = node.y;
        const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
        const nodeSize = node.size * 1.5; // Tolerancia para el click
        
        if (dist < nodeSize && dist < minDist) {
          minDist = dist;
          closestNode = node as NodeType;
        }
      });
      
      if (closestNode) {
        const node = closestNode as NodeType;
        if (node.label !== 'Cluster Industrial') {
          // Animación de escala al hacer click
          const originalSize = node.size;
          node.size = originalSize * 1.15;
          
          setTimeout(() => {
            if (closestNode) {
              (closestNode as NodeType).size = originalSize;
            }
          }, 120);
          
          // Establecer la empresa seleccionada
          setSelectedCompanyId(node.label);
        }
      }
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchend', handleClick);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchend', handleClick);
    };
  };

  // Calcular métricas
  const totalSavings = purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0);
  const activeSynergies = synergies.filter(s => s.status === 'approved' || s.status === 'rfp').length;
  const avgCloseTime = rfps.length > 0 
    ? rfps.reduce((sum, rfp) => {
        if (rfp.created_at && rfp.closing_at) {
          const created = new Date(rfp.created_at).getTime();
          const closed = new Date(rfp.closing_at).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24); // días
        }
        return sum;
      }, 0) / rfps.length
    : 0;
  const approvalRate = decisions.length > 0
    ? (decisions.filter(d => d.decision === 'approved').length / decisions.length) * 100
    : 0;

  // Filtrar datos por rango temporal
  const getFilteredData = () => {
    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return {
      synergies: synergies.filter(s => {
        if (!s.created_at) return false;
        return new Date(s.created_at) >= cutoffDate;
      }),
      rfps: rfps.filter(r => {
        if (!r.created_at) return false;
        return new Date(r.created_at) >= cutoffDate;
      }),
    };
  };

  const filteredData = getFilteredData();

  return (
    <div className="space-y-6">
      <PageTitle
        title="Centro de Inteligencia Visual"
        subtitle="Explora el ecosistema industrial desde múltiples perspectivas estratégicas"
      />

      {/* Selector de modos en la parte superior */}
      <SectionCard title="" description="">
        <div className="flex gap-2 border-b border-zinc-800 overflow-x-auto">
          {[
            { 
              id: '3d' as ViewMode, 
              label: '3D Inmersivo',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )
            },
            { 
              id: 'network' as ViewMode, 
              label: 'Red 2D',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              )
            },
            { 
              id: 'analytics' as ViewMode, 
              label: 'Análisis Estratégico',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )
            },
            { 
              id: 'timeline' as ViewMode, 
              label: 'Línea de Tiempo',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )
            },
            { 
              id: 'geospatial' as ViewMode, 
              label: 'Vista Geoespacial',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              )
            },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`group relative px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                activeMode === mode.id
                  ? 'text-[#9aff8d] border-b-2 border-[#9aff8d] bg-[#9aff8d]/5'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex-shrink-0">{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#9aff8d]"></div>
          <p className="text-zinc-400 mt-4">Cargando datos...</p>
        </div>
      ) : (
        <>
          {/* Modo 1: 3D Inmersivo */}
          {activeMode === '3d' && (
            <div className="relative">
              <SectionCard title="Vista 3D Inmersiva" description="Representación espacial del ecosistema industrial">
                <div className="relative h-[600px] bg-black/50 rounded-lg overflow-hidden border border-zinc-800">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full cursor-pointer"
                  />
                  
                  {/* Fábrica 3D cuando se selecciona un nodo */}
                  {selectedCompanyId && (() => {
                    const canvas = canvasRef.current;
                    if (!canvas) return null;
                    const rect = canvas.getBoundingClientRect();
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    return (
                      <FactoryModel
                        x={centerX}
                        y={centerY}
                        scale={1.2}
                        color="#9aff8d"
                      />
                    );
                  })()}
                  
                  {/* Card flotante con métricas */}
                  <div className="absolute top-6 right-6 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-5 min-w-[280px]">
                    <h3 className="text-white font-bold text-lg mb-4">Estado del Cluster</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">Potencial de ahorro</span>
                        <span className="text-[#9aff8d] font-bold text-base">
                          ${totalSavings.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">Sinergias activas</span>
                        <span className="text-white font-bold text-base">{activeSynergies}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">Total sinergias</span>
                        <span className="text-white font-bold text-base">{synergies.length}</span>
                      </div>
                      <div className="pt-3 border-t border-zinc-800">
                        <p className="text-zinc-400 text-xs mb-2">Empresas del cluster:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {COMPANIES.map((company, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-zinc-800/50 text-zinc-300 text-xs rounded"
                            >
                              {company}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel lateral con detalles de empresa seleccionada */}
                  {selectedCompanyId && (() => {
                    const companySynergies = synergies.filter(s => {
                      try {
                        const companies = s.companies_involved_json;
                        return Array.isArray(companies) && companies.includes(selectedCompanyId);
                      } catch {
                        return false;
                      }
                    });
                    const companySavings = companySynergies.reduce((sum, s) => {
                      const volume = s.volume_total_json?.total || s.volume_total_json || 0;
                      return sum + (typeof volume === 'number' ? volume * 0.1 : 0);
                    }, 0);
                    
                    return (
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-80 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-5 shadow-2xl">
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="text-white font-bold text-lg">{selectedCompanyId}</h3>
                          <button
                            onClick={() => setSelectedCompanyId(null)}
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <p className="text-zinc-400 text-xs mb-1">Tipo de compañía</p>
                            <p className="text-white text-sm font-medium">Industrial</p>
                          </div>

                          <div>
                            <p className="text-zinc-400 text-xs mb-1">Sinergias activas</p>
                            <p className="text-white text-sm font-semibold">{companySynergies.length}</p>
                          </div>

                          <div>
                            <p className="text-zinc-400 text-xs mb-1">Potencial de ahorro asociado</p>
                            <p className="text-[#9aff8d] text-sm font-bold">
                              US$ {companySavings.toLocaleString('es-CO')}
                            </p>
                          </div>

                          <div className="pt-4 border-t border-zinc-800">
                            <button
                              onClick={() => setSelectedCompanyId(null)}
                              className="w-full px-4 py-2 bg-[#9aff8d]/10 text-[#9aff8d] rounded-lg text-sm font-medium hover:bg-[#9aff8d]/20 transition-colors border border-[#9aff8d]/30"
                            >
                              Volver
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Leyenda */}
                  <div className="absolute bottom-6 left-6 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-4">
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#9aff8d]"></div>
                        <span className="text-zinc-300 font-medium">Aprobada</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#ffd700]"></div>
                        <span className="text-zinc-300 font-medium">RFP</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-zinc-600"></div>
                        <span className="text-zinc-300 font-medium">Pendiente</span>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* Modo 2: Red 2D */}
          {activeMode === 'network' && (
            <SectionCard title="Red 2D" description="Visualización de conexiones y relaciones">
              <div className="space-y-4">
                {/* Filtros */}
                <div className="flex gap-5 flex-wrap">
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block font-medium">Rango temporal</label>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as '30' | '90' | '365')}
                      className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]/50"
                    >
                      <option value="30">30 días</option>
                      <option value="90">90 días</option>
                      <option value="365">1 año</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block font-medium">Estado</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]/50"
                    >
                      <option value="all">Todos</option>
                      <option value="approved">Aprobadas</option>
                      <option value="rfp">RFP</option>
                      <option value="pending">Pendientes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block font-medium">Criticidad</label>
                    <select
                      className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]/50"
                    >
                      <option value="all">Todas</option>
                      <option value="high">Alta</option>
                      <option value="medium">Media</option>
                      <option value="low">Baja</option>
                    </select>
                  </div>
                </div>

                {/* Grafo 2D mejorado */}
                <div className="h-[600px] bg-black/50 rounded-lg border border-zinc-800 relative overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 800 600">
                    {/* Líneas de conexión con animación */}
                    {filteredData.synergies
                      .filter(s => filterStatus === 'all' || s.status === filterStatus)
                      .slice(0, 15)
                      .map((synergy, i, arr) => {
                        if (i === arr.length - 1) return null;
                        const x1 = 150 + (i % 4) * 150;
                        const y1 = 150 + Math.floor(i / 4) * 120;
                        const x2 = 150 + ((i + 1) % 4) * 150;
                        const y2 = 150 + Math.floor((i + 1) / 4) * 120;
                        
                        return (
                          <line
                            key={`line-${i}`}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="rgba(154, 255, 141, 0.3)"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                          >
                            <animate
                              attributeName="stroke-dashoffset"
                              values="0;10"
                              dur="2s"
                              repeatCount="indefinite"
                            />
                          </line>
                        );
                      })}

                    {/* Nodos con mejor diseño */}
                    {filteredData.synergies
                      .filter(s => filterStatus === 'all' || s.status === filterStatus)
                      .slice(0, 15)
                      .map((synergy, i) => {
                        const x = 150 + (i % 4) * 150;
                        const y = 150 + Math.floor(i / 4) * 120;
                        const status = synergy.status || 'pending';
                        const color = status === 'approved' ? '#9aff8d' : status === 'rfp' ? '#ffd700' : '#6b7280';
                        
                        // Obtener empresa involucrada
                        let companyName = 'Sinergia';
                        try {
                          const companies = synergy.companies_involved_json;
                          if (Array.isArray(companies) && companies.length > 0) {
                            companyName = companies[0] || COMPANIES[i % COMPANIES.length];
                          } else if (typeof companies === 'string') {
                            companyName = companies;
                          } else {
                            companyName = COMPANIES[i % COMPANIES.length];
                          }
                        } catch {
                          companyName = COMPANIES[i % COMPANIES.length];
                        }
                        
                        return (
                          <g key={`node-${i}`} className="cursor-pointer">
                            {/* Glow */}
                            <circle
                              cx={x}
                              cy={y}
                              r="25"
                              fill={color}
                              opacity="0.3"
                            />
                            {/* Nodo principal */}
                            <circle
                              cx={x}
                              cy={y}
                              r="18"
                              fill={color}
                              className="hover:opacity-80 transition-opacity"
                              style={{ filter: 'drop-shadow(0 0 12px ' + color + ')' }}
                            />
                            {/* Label - Empresa */}
                            <text
                              x={x}
                              y={y + 40}
                              textAnchor="middle"
                              className="text-xs fill-zinc-300 font-medium"
                            >
                              {companyName.substring(0, 12)}
                            </text>
                            {/* Categoría */}
                            <text
                              x={x}
                              y={y + 55}
                              textAnchor="middle"
                              className="text-[10px] fill-zinc-500"
                            >
                              {synergy.item_category?.substring(0, 10) || 'Sinergia'}
                            </text>
                            {/* Estado */}
                            <text
                              x={x}
                              y={y + 68}
                              textAnchor="middle"
                              className="text-[9px] fill-zinc-600"
                            >
                              {status || 'pending'}
                            </text>
                          </g>
                        );
                      })}
                  </svg>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Modo 3: Análisis Estratégico */}
          {activeMode === 'analytics' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <SectionCard title="" description="">
                  <div className="text-center py-2">
                    <p className="text-4xl font-bold text-[#9aff8d] mb-2">
                      ${(totalSavings / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-base text-zinc-400 font-medium">Ahorro total estimado</p>
                  </div>
                </SectionCard>
                <SectionCard title="" description="">
                  <div className="text-center py-2">
                    <p className="text-4xl font-bold text-white mb-2">{activeSynergies}</p>
                    <p className="text-base text-zinc-400 font-medium">Sinergias activas</p>
                  </div>
                </SectionCard>
                <SectionCard title="" description="">
                  <div className="text-center py-2">
                    <p className="text-4xl font-bold text-white mb-2">{avgCloseTime.toFixed(1)}</p>
                    <p className="text-base text-zinc-400 font-medium">Días promedio de cierre</p>
                  </div>
                </SectionCard>
                <SectionCard title="" description="">
                  <div className="text-center py-2">
                    <p className="text-4xl font-bold text-white mb-2">{approvalRate.toFixed(0)}%</p>
                    <p className="text-base text-zinc-400 font-medium">Tasa de aprobación</p>
                  </div>
                </SectionCard>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de barras por categoría */}
                <SectionCard title="Sinergias por Categoría" description="">
                  <div className="h-64 flex items-end justify-around gap-2">
                    {(() => {
                      const categories = Array.from(new Set(synergies.map(s => s.item_category).filter(Boolean)));
                      const categoryCounts = categories.map(cat => ({
                        category: cat,
                        count: synergies.filter(s => s.item_category === cat).length,
                      })).sort((a, b) => b.count - a.count).slice(0, 5);
                      
                      const maxCount = Math.max(...categoryCounts.map(c => c.count), 1);
                      
                      return categoryCounts.map((item, i) => {
                        const height = (item.count / maxCount) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <div className="relative w-full h-full flex items-end">
                              <div
                                className="w-full bg-gradient-to-t from-[#9aff8d]/80 to-[#9aff8d] rounded-t transition-all hover:opacity-80 cursor-pointer"
                                style={{ height: `${height}%` }}
                                title={`${item.count} sinergias`}
                              />
                            </div>
                            <p className="text-sm text-zinc-400 mt-3 text-center font-medium">
                              {item.category?.substring(0, 12) || 'Categoría'}
                            </p>
                            <p className="text-sm text-[#9aff8d] font-bold mt-1">{item.count}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </SectionCard>

                {/* Pie chart de estados */}
                <SectionCard title="Distribución de Estados" description="">
                  <div className="h-64 flex items-center justify-center">
                    <svg width="200" height="200" viewBox="0 0 200 200">
                      {(() => {
                        const approved = synergies.filter(s => s.status === 'approved').length;
                        const rfp = synergies.filter(s => s.status === 'rfp').length;
                        const pending = synergies.filter(s => !s.status || s.status === 'pending').length;
                        const total = synergies.length;
                        
                        let currentAngle = 0;
                        const radius = 80;
                        const centerX = 100;
                        const centerY = 100;
                        
                        return (
                          <>
                            {approved > 0 && (
                              <path
                                d={`M ${centerX} ${centerY} L ${centerX + Math.cos(currentAngle) * radius} ${centerY + Math.sin(currentAngle) * radius} A ${radius} ${radius} 0 ${(approved / total) * 360 > 180 ? 1 : 0} 1 ${centerX + Math.cos(currentAngle + (approved / total) * Math.PI * 2) * radius} ${centerY + Math.sin(currentAngle + (approved / total) * Math.PI * 2) * radius} Z`}
                                fill="#9aff8d"
                              />
                            )}
                            {rfp > 0 && (
                              <path
                                d={`M ${centerX} ${centerY} L ${centerX + Math.cos(currentAngle + (approved / total) * Math.PI * 2) * radius} ${centerY + Math.sin(currentAngle + (approved / total) * Math.PI * 2) * radius} A ${radius} ${radius} 0 ${(rfp / total) * 360 > 180 ? 1 : 0} 1 ${centerX + Math.cos(currentAngle + ((approved + rfp) / total) * Math.PI * 2) * radius} ${centerY + Math.sin(currentAngle + ((approved + rfp) / total) * Math.PI * 2) * radius} Z`}
                                fill="#ffd700"
                              />
                            )}
                            {pending > 0 && (
                              <path
                                d={`M ${centerX} ${centerY} L ${centerX + Math.cos(currentAngle + ((approved + rfp) / total) * Math.PI * 2) * radius} ${centerY + Math.sin(currentAngle + ((approved + rfp) / total) * Math.PI * 2) * radius} A ${radius} ${radius} 0 ${(pending / total) * 360 > 180 ? 1 : 0} 1 ${centerX + Math.cos(currentAngle + Math.PI * 2) * radius} ${centerY + Math.sin(currentAngle + Math.PI * 2) * radius} Z`}
                                fill="#6b7280"
                              />
                            )}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="flex justify-center gap-6 mt-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-[#9aff8d]"></div>
                      <span className="text-sm text-zinc-400 font-medium">Aprobadas</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-[#ffd700]"></div>
                      <span className="text-sm text-zinc-400 font-medium">RFP</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-zinc-600"></div>
                      <span className="text-sm text-zinc-400 font-medium">Pendientes</span>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {/* Modo 4: Línea de Tiempo */}
          {activeMode === 'timeline' && (
            <SectionCard title="Línea de Tiempo" description="Cronología de eventos y decisiones">
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-800"></div>
                <div className="space-y-6 pl-12">
                  {[...synergies, ...rfps].slice(0, 10).sort((a, b) => {
                    const dateA = new Date(a.created_at || 0).getTime();
                    const dateB = new Date(b.created_at || 0).getTime();
                    return dateB - dateA;
                  }).map((item, i) => {
                    const date = item.created_at ? new Date(item.created_at) : new Date();
                    const isSynergy = 'synergy_id' in item;
                    
                    return (
                      <div key={i} className="relative">
                        <div className="absolute -left-12 top-1 w-4 h-4 rounded-full bg-[#9aff8d] border-2 border-zinc-900"></div>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-white font-bold text-lg mb-2">
                                {isSynergy ? (item as Synergy).item_category : 'RFP'}
                              </h4>
                              <p className="text-zinc-400 text-base">
                                {date.toLocaleDateString('es-CO', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                            </div>
                            <div className="ml-4">
                              <StatusBadge status={item.status || 'pending'} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Modo 5: Vista Geoespacial 3D */}
          {activeMode === 'geospatial' && (
            <div className="space-y-4">
              <MapboxLoader />
              
              {/* Controles */}
              <SectionCard title="" description="">
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Toggle Conexiones */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="show-connections-geo"
                      checked={showConnections}
                      onChange={(e) => setShowConnections(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-[#9aff8d] focus:ring-[#9aff8d]/50"
                    />
                    <label htmlFor="show-connections-geo" className="text-sm text-zinc-400 cursor-pointer">
                      Mostrar conexiones
                    </label>
                  </div>

                  {/* Botón Reset */}
                  <button
                    onClick={() => setGeoSelectedCompanyId(null)}
                    className="px-4 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700"
                  >
                    Reset Vista
                  </button>
                </div>
              </SectionCard>

              {/* Mapa */}
              <SectionCard title="Vista Geoespacial 3D" description="Explora el cluster desde una perspectiva geoespacial">
                <div className="h-[600px] relative">
                  <GeoMap
                    companies={geoCompanies}
                    selectedCompanyId={geoSelectedCompanyId}
                    onCompanySelect={setGeoSelectedCompanyId}
                    is3DMode={true}
                    showConnections={showConnections}
                    synergies={synergies}
                  />
                </div>
              </SectionCard>

              {/* Sidebar */}
              {geoSelectedCompanyId && (
                <GeoSidebar
                  company={geoCompanies.find(c => c.id === geoSelectedCompanyId) || null}
                  onClose={() => setGeoSelectedCompanyId(null)}
                  onViewSynergies={() => setActiveMode('network')}
                  onViewDetail={() => {
                    if (geoSelectedCompanyId) {
                      setActiveMode('3d');
                      const company = geoCompanies.find(c => c.id === geoSelectedCompanyId);
                      if (company) {
                        setSelectedCompanyId(company.name);
                      }
                    }
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

