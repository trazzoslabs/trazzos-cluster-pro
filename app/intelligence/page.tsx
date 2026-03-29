'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';
import Synergy3DScene, { SceneLink, SceneNode } from './components/Synergy3DScene';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { CompaniesInvolvedJson, VolumeTotalJsonValue } from '@/lib/types/synergies';
import { companyEntryId, companyEntryName, extractVolumeTotal } from '@/lib/types/synergies';
import {
  getCartagenaDemoConsolidatedUsdTotal,
  getCartagenaDemoDonutData,
  getCartagenaDemoEstimatedSavingsUsd,
  getCartagenaDemoSynergyRows,
  isCartagenaBypassCompanyId,
  isDemoActive,
} from '@/lib/cartagenaDemoSynergies';
import {
  TRAZZOS_MARTS_CHANNEL,
  isMartsRefreshCompletedPayload,
} from '@/lib/trazzosMartsBroadcast';

interface Synergy {
  synergy_id: string;
  cluster_id: string | null;
  item_category: string;
  window_start: string;
  window_end: string;
  companies_involved_json: CompaniesInvolvedJson;
  volume_total_json: VolumeTotalJsonValue;
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

interface Need {
  need_id: string;
  company_id: string | null;
  item_category: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
}

interface ScoringRun {
  run_id: string;
  rfp_id: string | null;
  results_json: any;
  created_at: string | null;
}

interface AuditEvent {
  event_id: string;
  event_type: string | null;
  summary: string | null;
  created_at: string | null;
}

type ViewMode = '3d' | 'analytics' | 'timeline';

// Lista de empresas del cluster
const COMPANIES = [
  'Reficar',
  'Yara',
  'Argos',
  'Ajover',
  'Esenttia',
  'Cabot',
  'Dow',
];

// Coordenadas de empresas
const COMPANY_COORDINATES: { [key: string]: { name: string; lat: number; lng: number } } = {
  'Reficar': { name: 'Reficar (Ecopetrol)', lat: 10.33, lng: -75.5 },
  'Yara': { name: 'Yara Colombia', lat: 10.32, lng: -75.51 },
  'Argos': { name: 'Argos - Planta Cartagena', lat: 10.34, lng: -75.49 },
  'Ajover': { name: 'Ajover S.A.', lat: 10.3972, lng: -75.4870 },
  'Esenttia': { name: 'Esenttia', lat: 10.3084, lng: -75.5179 },
  'Cabot': { name: 'Cabot Colombiana', lat: 10.3049, lng: -75.5230 },
  Dow: { name: 'Dow Chemical Mamonal', lat: 10.315, lng: -75.505 },
};

export default function IntelligencePage() {
  const [activeMode, setActiveMode] = useState<ViewMode>('analytics');
  const [synergies, setSynergies] = useState<Synergy[]>([]);
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [decisions, setDecisions] = useState<CommitteeDecision[]>([]);
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30' | '90' | '365'>('90');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null);
  const [sessionDemoLive, setSessionDemoLive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const sync = () => setSessionDemoLive(isDemoActive());
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  // Escucha activa: `marts_refresh_completed` vía BroadcastChannel (p. ej. tras refresh en Ingesta).
  useEffect(() => {
    let bc: BroadcastChannel | null = null;

    try {
      bc = new BroadcastChannel(TRAZZOS_MARTS_CHANNEL);
      bc.onmessage = (event) => {
        if (!isMartsRefreshCompletedPayload(event.data)) return;
        const extra =
          event.data && typeof event.data === 'object' && event.data !== null
            ? (event.data as { counts?: unknown }).counts
            : undefined;
        console.log('[Intelligence] marts_refresh_completed → synergies', extra);
        void (async () => {
          try {
            if (isCartagenaBypassCompanyId(profileCompanyId)) {
              setSynergies(getCartagenaDemoSynergyRows() as unknown as Synergy[]);
              return;
            }
            const synUrl = profileCompanyId
              ? `/api/data/synergies?company_id=${encodeURIComponent(profileCompanyId)}`
              : '/api/data/synergies';
            const synRes = await fetch(synUrl);
            if (synRes.ok) {
              const synData = await synRes.json();
              setSynergies(synData.data || []);
            }
          } catch {
            /* silenciar */
          }
        })();
      };
    } catch {
      /* BroadcastChannel no disponible */
    }

    return () => {
      try {
        bc?.close();
      } catch {
        /* noop */
      }
    };
  }, [profileCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      let companyId: string | null = null;
      try {
        const profileRes = await fetch('/api/auth/profile');
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          companyId =
            typeof profileJson?.data?.company_id === 'string'
              ? profileJson.data.company_id.trim()
              : null;
        }
      } catch {
        /* sin perfil */
      }
      setProfileCompanyId(companyId);
      const cartagenaBypass = isCartagenaBypassCompanyId(companyId);

      const [rfpsRes, posRes, decisionsRes, auditRes, needsRes] = await Promise.all([
        fetch('/api/data/rfps'),
        fetch('/api/data/purchase-orders'),
        fetch('/api/data/committee-decisions'),
        fetch('/api/data/audit-events?limit=30'),
        fetch('/api/data/needs'),
      ]);

      let synergiesList: Synergy[] = [];
      if (cartagenaBypass) {
        synergiesList = getCartagenaDemoSynergyRows() as unknown as Synergy[];
      } else {
        const synUrl = companyId
          ? `/api/data/synergies?company_id=${encodeURIComponent(companyId)}`
          : '/api/data/synergies';
        const synergiesRes = await fetch(synUrl);
        if (synergiesRes.ok) {
          const synergiesData = await synergiesRes.json();
          synergiesList = synergiesData.data || [];
        }
      }

      const rfpsData = await rfpsRes.json();
      const posData = await posRes.json();
      const decisionsData = await decisionsRes.json();
      const auditData = await auditRes.json();
      const needsData = needsRes.ok ? await needsRes.json() : { data: [] };

      setSynergies(synergiesList);
      setRfps(rfpsData.data || []);
      setPurchaseOrders(posData.data || []);
      setDecisions(decisionsData.data || []);
      setAuditEvents(auditData.data || []);
      setNeeds(needsData.data || []);

      const firstRfpId = (rfpsData.data || [])[0]?.rfp_id;
      if (firstRfpId) {
        try {
          const scoringRes = await fetch(`/api/data/scoring-runs?rfp_id=${firstRfpId}`);
          if (scoringRes.ok) {
            const scoringData = await scoringRes.json();
            setScoringRuns(scoringData.data || []);
          } else {
            setScoringRuns([]);
          }
        } catch {
          setScoringRuns([]);
        }
      } else {
        setScoringRuns([]);
      }
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
      
      let companyName = 'Cluster';
      try {
        const companies = synergy.companies_involved_json;
        if (Array.isArray(companies) && companies.length > 0) {
          companyName = companyEntryName(companies[0]) || COMPANIES[i % COMPANIES.length];
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

  // Calcular métricas basadas en volume_total_json de synergies (tipado en lib/types/synergies)
  const totalVolume = sessionDemoLive
    ? getCartagenaDemoConsolidatedUsdTotal()
    : synergies.reduce((sum, s) => sum + extractVolumeTotal(s.volume_total_json), 0);
  const totalSavings = sessionDemoLive
    ? getCartagenaDemoEstimatedSavingsUsd()
    : totalVolume > 0
      ? Math.round(totalVolume * 0.12) // estimación conservadora 12 % consolidación
      : purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0);
  const activeSynergies = synergies.filter((s) => {
    const st = (s.status ?? '').toLowerCase();
    return st === 'approved' || st === 'rfp' || st === 'active' || st === 'detected';
  }).length;
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

  // Filtrar datos por rango temporal (conserva registros sin fecha)
  const getFilteredData = () => {
    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return {
      synergies: synergies.filter(s => {
        if (!s.created_at) return true;
        return new Date(s.created_at) >= cutoffDate;
      }),
      rfps: rfps.filter(r => {
        if (!r.created_at) return true;
        return new Date(r.created_at) >= cutoffDate;
      }),
    };
  };

  const filteredData = getFilteredData();
  const latestScoring = scoringRuns[0]?.results_json || {};
  const radarEfficiencyData = [
    {
      metric: 'Price',
      value: Math.round((Number(latestScoring.price_efficiency ?? 0.9) || 0.9) * 100),
      benchmark: 100,
    },
    {
      metric: 'Delivery',
      value: Math.round((Number(latestScoring.delivery_efficiency ?? 0.88) || 0.88) * 100),
      benchmark: 100,
    },
  ];

  const savingsDonutData = useMemo(() => {
    if (sessionDemoLive) return getCartagenaDemoDonutData();
    return [
      { name: 'Rodamientos', value: 15, color: '#9aff8d' },
      { name: 'Lubricantes', value: 12, color: '#38bdf8' },
      { name: 'EPP', value: 22, color: '#f59e0b' },
    ];
  }, [sessionDemoLive]);

  const volumeBarsData = useMemo(() => {
    if (sessionDemoLive) {
      return getCartagenaDemoSynergyRows().slice(0, 6).map((r) => {
        const amt = r.volume_total_json.amount;
        const pct = r.volume_total_json.estimated_savings_pct;
        const cat =
          r.item_category.length > 34 ? `${r.item_category.slice(0, 32)}…` : r.item_category;
        return {
          category: cat,
          individual: Math.max(0, Math.round(amt * (1 - pct / 100))),
          cluster: amt,
        };
      });
    }
    return Array.from(
      new Set(
        synergies
          .map((s) => s.item_category)
          .filter((category): category is string => Boolean(category)),
      ),
    )
      .slice(0, 6)
      .map((category) => {
        const clusterDemand = synergies
          .filter((s) => s.item_category === category)
          .reduce((sum, s) => sum + extractVolumeTotal(s.volume_total_json), 0);
        const avgSavingPct =
          synergies
            .filter((s) => s.item_category === category)
            .reduce(
              (sum, s) =>
                sum +
                Number(
                  (typeof s.volume_total_json === 'object' && s.volume_total_json?.estimated_savings_pct) ??
                    12,
                ),
              0,
            ) / Math.max(1, synergies.filter((s) => s.item_category === category).length);

        const individualDemand = Math.round(clusterDemand * (1 - avgSavingPct / 100));
        return {
          category,
          individual: Math.max(0, individualDemand),
          cluster: clusterDemand,
        };
      });
  }, [sessionDemoLive, synergies]);

  const renderDonutLabel = useCallback(
    (props: {
      cx?: number;
      cy?: number;
      midAngle?: number;
      innerRadius?: number;
      outerRadius?: number;
      percent?: number;
      name?: string;
    }) => {
      const {
        cx = 0,
        cy = 0,
        midAngle = 0,
        innerRadius = 0,
        outerRadius = 0,
        percent = 0,
        name = '',
      } = props;
      const RADIAN = Math.PI / 180;
      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const fill = percent >= 0.07 ? '#ffffff' : '#10b981';
      return (
        <text
          x={x}
          y={y}
          fill={fill}
          textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          {`${name} ${(percent * 100).toFixed(0)}%`}
        </text>
      );
    },
    [],
  );

  const timelineOrder = ['RFP_OPENED', 'OFFER_RECEIVED', 'PO_SIMULATED'];
  const timelineEvents = timelineOrder.map((eventType, index) => {
    const event = auditEvents.find((e) => (e.event_type || '').toUpperCase() === eventType);
    return {
      step: index + 1,
      eventType,
      label:
        eventType === 'RFP_OPENED'
          ? 'RFP opened'
          : eventType === 'OFFER_RECEIVED'
          ? 'Offer received'
          : 'PO simulated',
      summary: event?.summary || 'Evento pendiente',
      createdAt: event?.created_at || null,
      completed: Boolean(event),
    };
  });

  const nodeMap = new Map<string, SceneNode>();
  const sceneLinks: SceneLink[] = [];
  synergies.forEach((synergy) => {
    const raw = Array.isArray(synergy.companies_involved_json)
      ? synergy.companies_involved_json
      : [];
    const entries = raw
      .map((entry: any) => ({
        key: companyEntryId(entry) || companyEntryName(entry),
        name: companyEntryName(entry),
        companyId: companyEntryId(entry),
      }))
      .filter((entry: any) => Boolean(entry.key) && Boolean(entry.name));

    entries.forEach((entry: any) => {
      const existing = nodeMap.get(entry.key);
      const currentVolume = extractVolumeTotal(synergy.volume_total_json);
      if (existing) {
        existing.synergyCount += 1;
        existing.totalVolume += currentVolume;
        existing.hasMassiveSynergy = existing.hasMassiveSynergy || currentVolume >= 10000;
      } else {
        nodeMap.set(entry.key, {
          key: entry.key,
          name: entry.name,
          companyId: entry.companyId,
          synergyCount: 1,
          totalVolume: currentVolume,
          hasMassiveSynergy: currentVolume >= 10000,
        });
      }
    });

    const synergyActive = (synergy.status ?? '').toLowerCase() === 'active';
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const sourceKey = entries[i].key;
        const targetKey = entries[j].key;
        if (sourceKey && targetKey) {
          sceneLinks.push({
            sourceKey,
            targetKey,
            intensity: Math.max(0.8, Math.min(2.5, extractVolumeTotal(synergy.volume_total_json) / 8000)),
            synergyActive,
          });
        }
      }
    }
  });

  const sceneNodes = Array.from(nodeMap.values());
  const selectedNode = sceneNodes.find((node) => node.key === selectedCompanyId) || null;
  const selectedNodeSynergies = selectedNode
    ? synergies.filter((synergy) => {
        const involved = Array.isArray(synergy.companies_involved_json) ? synergy.companies_involved_json : [];
        return involved.some((entry: any) =>
          selectedNode.companyId
            ? companyEntryId(entry) === selectedNode.companyId
            : companyEntryName(entry).toLowerCase() === selectedNode.name.toLowerCase()
        );
      })
    : [];
  const selectedNodeNeeds = selectedNode
    ? needs.filter((need) =>
        selectedNode.companyId
          ? need.company_id === selectedNode.companyId
          : (need.company_id || '').toLowerCase().includes(selectedNode.name.toLowerCase())
      )
    : [];
  const selectedNodeSavings = selectedNodeSynergies.reduce((sum, synergy) => {
    const pct =
      typeof synergy.volume_total_json === 'object' &&
      synergy.volume_total_json != null &&
      typeof (synergy.volume_total_json as { estimated_savings_pct?: number }).estimated_savings_pct === 'number'
        ? (synergy.volume_total_json as { estimated_savings_pct: number }).estimated_savings_pct
        : 12;
    return sum + extractVolumeTotal(synergy.volume_total_json) * (pct / 100);
  }, 0);
  const selectedNodeCategories = Array.from(
    new Set(selectedNodeNeeds.map((need) => need.item_category).filter((category): category is string => Boolean(category)))
  );

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
              id: 'analytics' as ViewMode, 
              label: 'Análisis Estratégico',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )
            },
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
              id: 'timeline' as ViewMode, 
              label: 'Línea de Tiempo',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                <div className="relative">
                  <Synergy3DScene
                    nodes={sceneNodes}
                    links={sceneLinks}
                    selectedNodeKey={selectedCompanyId}
                    onNodeSelect={setSelectedCompanyId}
                    industrialDemoMode={sessionDemoLive}
                    sessionDemoActive={sessionDemoLive}
                    onSelectCompany={(name) => {
                      const matched = sceneNodes.find((node) => node.name === name);
                      if (matched) setSelectedCompanyId(matched.key);
                    }}
                  />

                  <div className="absolute top-6 right-6 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-5 min-w-[280px] z-10">
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

                  {selectedNode && (
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-96 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-5 shadow-2xl">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-white font-bold text-lg">{selectedNode.name}</h3>
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
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-zinc-800/60 rounded-lg p-3">
                            <p className="text-zinc-400 text-xs">Sinergias</p>
                            <p className="text-white font-semibold">{selectedNode.synergyCount}</p>
                          </div>
                          <div className="bg-zinc-800/60 rounded-lg p-3">
                            <p className="text-zinc-400 text-xs">Volumen asociado</p>
                            <p className="text-[#9aff8d] font-semibold">{selectedNode.totalVolume.toLocaleString('es-CO')}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-2">
                            <p className="text-zinc-400">% de Ahorro</p>
                            <p className="text-[#9aff8d] font-semibold">
                              {selectedNode.totalVolume > 0
                                ? `${Math.round((selectedNodeSavings / selectedNode.totalVolume) * 100)}%`
                                : '0%'}
                            </p>
                          </div>
                          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-2">
                            <p className="text-zinc-400">Volumen Consolidado</p>
                            <p className="text-white font-semibold">{selectedNode.totalVolume.toLocaleString('es-CO')}</p>
                          </div>
                          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-2">
                            <p className="text-zinc-400">Sinergias detectadas</p>
                            <p className="text-white font-semibold">{selectedNodeSynergies.length}</p>
                          </div>
                          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-2">
                            <p className="text-zinc-400">Categorias activas</p>
                            <p className="text-white font-semibold">
                              {selectedNodeCategories.length > 0 ? selectedNodeCategories.slice(0, 3).join(', ') : 'Sin categorias activas'}
                            </p>
                          </div>
                          <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-2">
                            <p className="text-zinc-400">Empresas aliadas</p>
                            <p className="text-white font-semibold">{Math.max(1, selectedNodeSynergies.length + 1)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-6 left-6 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 z-10">
                    <div className="flex gap-6 text-sm flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#9aff8d]"></div>
                        <span className="text-zinc-300 font-medium">Nodo empresa</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-white"></div>
                        <span className="text-zinc-300 font-medium">Conexión de colaboración</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-300"></div>
                        <span className="text-zinc-300 font-medium">Partículas de ahorro masivo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* Modo 2: Análisis Estratégico */}
          {activeMode === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <SectionCard title="" description="">
                  <div className="text-center py-2">
                    <p className="text-4xl font-bold text-[#9aff8d] mb-2">
                      ${totalSavings > 1_000_000 ? `${(totalSavings / 1_000_000).toFixed(1)}M` : totalSavings.toLocaleString('es-CO')}
                    </p>
                    <p className="text-base text-zinc-400 font-medium">Ahorro Potencial</p>
                  </div>
                </SectionCard>
                <SectionCard title="" description="">
                  <div className="text-center py-2">
                    <p className="text-4xl font-bold text-white mb-2">
                      {totalVolume > 1_000_000 ? `${(totalVolume / 1_000_000).toFixed(1)}M` : totalVolume.toLocaleString('es-CO')}
                    </p>
                    <p className="text-base text-zinc-400 font-medium">Volumen Consolidado</p>
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
                    <p className="text-4xl font-bold text-white mb-2">{synergies.length}</p>
                    <p className="text-base text-zinc-400 font-medium">Total sinergias</p>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="Radar de Eficiencia" description="Price vs Delivery efficiency del ranking">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarEfficiencyData}>
                        <PolarGrid stroke="#3f3f46" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                          labelStyle={{ color: '#d4d4d8' }}
                        />
                        <Radar
                          name="Eficiencia"
                          dataKey="value"
                          stroke="#9aff8d"
                          fill="#9aff8d"
                          fillOpacity={0.35}
                        />
                        <Radar
                          name="Benchmark"
                          dataKey="benchmark"
                          stroke="#6b7280"
                          fill="#6b7280"
                          fillOpacity={0.1}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <SectionCard title="Donut de Ahorro por Categoría" description="Distribución estimada de ahorros">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie
                          data={savingsDonutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={118}
                          paddingAngle={5}
                          labelLine={false}
                          label={renderDonutLabel}
                        >
                          {savingsDonutData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number | string | undefined) => `${value ?? 0}%`}
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                          labelStyle={{ color: '#d4d4d8', fontSize: 14 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 14, color: '#fafafa' }}
                          iconType="circle"
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <SectionCard title="Barras de Volumen Consolidado" description="Demanda individual vs demanda consolidada del cluster">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volumeBarsData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                        <XAxis
                          dataKey="category"
                          tick={{ fill: '#a1a1aa', fontSize: 11 }}
                          angle={-15}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                          labelStyle={{ color: '#d4d4d8' }}
                        />
                        <Legend />
                        <Bar dataKey="individual" name="Demanda individual" fill="#64748b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cluster" name="Demanda cluster" fill="#9aff8d" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <SectionCard title="Status Timeline" description="Progreso operativo desde RFP_OPENED hasta PO_SIMULATED">
                  <div className="space-y-4">
                    {timelineEvents.map((step, index) => (
                      <div key={step.eventType} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold ${
                              step.completed
                                ? 'bg-[#9aff8d] text-[#232323] border-[#9aff8d]'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {step.step}
                          </div>
                          {index < timelineEvents.length - 1 && (
                            <div className={`w-0.5 h-8 ${step.completed ? 'bg-[#9aff8d]/70' : 'bg-zinc-700'}`} />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white font-medium">{step.label}</p>
                            <span className="text-[11px] text-zinc-400">{step.eventType}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">{step.summary}</p>
                          {step.createdAt && (
                            <p className="text-[11px] text-zinc-500 mt-1">
                              {new Date(step.createdAt).toLocaleString('es-CO')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-zinc-800">
                      <p className="text-xs text-zinc-500">
                        Eventos cargados: {auditEvents.length} | Scoring runs: {scoringRuns.length}
                      </p>
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
        </>
      )}
    </div>
  );
}

