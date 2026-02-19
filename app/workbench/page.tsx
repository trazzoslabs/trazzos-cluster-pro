'use client';

import { useEffect, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import StepCard from '../components/ui/StepCard';
import StatusBadge from '../components/ui/StatusBadge';
import CopyButton from '../components/ui/CopyButton';

interface Rfp {
  rfp_id: string;
  synergy_id: string | null;
  status: string | null;
  published_at: string | null;
  closing_at: string | null;
}

interface Offer {
  offer_id: string;
  rfp_id: string;
  supplier_id: string | null;
  price_total: number | null;
  currency: string | null;
  lead_time_days: number | null;
  submitted_at: string | null;
}

interface ScoringRun {
  run_id: string;
  rfp_id: string;
  weights_version_id: string | null;
  results_json: any;
  created_at: string | null;
}

interface PurchaseOrder {
  po_id: string;
  rfp_id: string;
  offer_id: string | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string | null;
}

interface EvidenceRecord {
  evidence_id: string;
  entity_type: string;
  entity_id: string;
  payload_hash_sha256: string | null;
  created_at: string | null;
}

interface AuditEvent {
  event_id: string;
  correlation_id: string | null;
  event_type: string | null;
  summary: string | null;
  created_at: string | null;
}

export default function WorkbenchPage() {
  const [selectedRfpId, setSelectedRfpId] = useState<string>('');
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [loadingRfps, setLoadingRfps] = useState(true);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState(false);

  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([]);
  const [loadingScoring, setLoadingScoring] = useState(false);
  const [generatingScoring, setGeneratingScoring] = useState(false);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [scoringSuccess, setScoringSuccess] = useState(false);

  const [committeeDecision, setCommitteeDecision] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState(false);

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const [loadingPO, setLoadingPO] = useState(false);

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [correlationId, setCorrelationId] = useState<string>('');

  useEffect(() => {
    fetchRfps();
  }, []);

  useEffect(() => {
    if (selectedRfpId) {
      fetchOffers();
      fetchScoringRuns();
      fetchPurchaseOrder();
    }
  }, [selectedRfpId]);

  useEffect(() => {
    if (correlationId) {
      fetchAuditEvents();
    }
  }, [correlationId]);

  const fetchRfps = async () => {
    try {
      setLoadingRfps(true);
      const response = await fetch('/api/data/rfps');
      if (response.ok) {
        const result = await response.json();
        setRfps(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching RFPs:', err);
    } finally {
      setLoadingRfps(false);
    }
  };

  const fetchOffers = async () => {
    try {
      setLoadingOffers(true);
      const response = await fetch(`/api/data/offers?rfp_id=${selectedRfpId}`);
      if (response.ok) {
        const result = await response.json();
        setOffers(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching offers:', err);
    } finally {
      setLoadingOffers(false);
    }
  };

  const fetchScoringRuns = async () => {
    try {
      setLoadingScoring(true);
      const response = await fetch(`/api/data/scoring-runs?rfp_id=${selectedRfpId}`);
      if (response.ok) {
        const result = await response.json();
        setScoringRuns(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching scoring runs:', err);
    } finally {
      setLoadingScoring(false);
    }
  };

  const fetchPurchaseOrder = async () => {
    try {
      setLoadingPO(true);
      const response = await fetch(`/api/data/purchase-orders?rfp_id=${selectedRfpId}`);
      if (response.ok) {
        const result = await response.json();
        const pos = result.data || [];
        if (pos.length > 0) {
          setPurchaseOrder(pos[0]);
          // Fetch evidence
          const evidenceRes = await fetch(`/api/data/evidence?entity_type=purchase_order&entity_id=${pos[0].po_id}`);
          if (evidenceRes.ok) {
            const evidenceData = await evidenceRes.json();
            if (evidenceData.data && evidenceData.data.length > 0) {
              setEvidence(evidenceData.data[0]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching purchase order:', err);
    } finally {
      setLoadingPO(false);
    }
  };

  const fetchAuditEvents = async () => {
    try {
      setLoadingAudit(true);
      const response = await fetch(`/api/data/audit-events?correlation_id=${correlationId}`);
      if (response.ok) {
        const result = await response.json();
        setAuditEvents(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching audit events:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleCreateOffer = async () => {
    if (!selectedRfpId) {
      setOfferError('Por favor selecciona un RFP primero');
      return;
    }

    try {
      setSubmittingOffer(true);
      setOfferError(null);
      setOfferSuccess(false);

      const response = await fetch('/api/workflows/offer-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfp_id: selectedRfpId,
          supplier_id: '00000000-0000-0000-0000-000000000000', // Demo
          price_total: 100000,
          currency: 'COP',
          lead_time_days: 30,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to create offer');
      }

      setOfferSuccess(true);
      await fetchOffers();
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleGenerateScoring = async () => {
    if (!selectedRfpId) {
      setScoringError('Por favor selecciona un RFP primero');
      return;
    }

    try {
      setGeneratingScoring(true);
      setScoringError(null);
      setScoringSuccess(false);

      const response = await fetch('/api/workflows/scoring-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfp_id: selectedRfpId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to generate scoring');
      }

      setScoringSuccess(true);
      await fetchScoringRuns();
    } catch (err) {
      setScoringError(err instanceof Error ? err.message : 'Failed to generate scoring');
    } finally {
      setGeneratingScoring(false);
    }
  };

  const handleCommitteeDecision = async (decision: 'approve' | 'reject') => {
    if (!selectedRfpId) {
      setDecisionError('Por favor selecciona un RFP primero');
      return;
    }

    if (decision === 'approve' && !selectedOfferId) {
      setDecisionError('Por favor selecciona una oferta para aprobar');
      return;
    }

    try {
      setSubmittingDecision(true);
      setDecisionError(null);
      setDecisionSuccess(false);

      const response = await fetch('/api/workflows/committee-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfp_id: selectedRfpId,
          decision,
          offer_id: decision === 'approve' ? selectedOfferId : undefined,
          justification: justification.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to submit decision');
      }

      const result = await response.json();
      setDecisionSuccess(true);
      setCorrelationId(result.data?.correlation_id || '');
      await fetchPurchaseOrder();
      if (result.data?.correlation_id) {
        await fetchAuditEvents();
      }
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
    }).format(amount);
  };

  const selectedRfp = rfps.find(r => r.rfp_id === selectedRfpId);
  const hasOffers = offers.length > 0;
  const hasScoring = scoringRuns.length > 0;
  const hasDecision = decisionSuccess;
  const hasPO = purchaseOrder !== null;

  return (
    <div>
      <PageTitle
        title="Gestión de Decisiones"
        subtitle="Wizard guiado para el proceso completo de evaluación y decisión de RFPs"
      />

      {/* Paso 1: Seleccionar RFP */}
      <StepCard
        stepNumber={1}
        title="Seleccionar RFP"
        description="Elige el RFP que deseas gestionar"
        isActive={!selectedRfpId}
        isCompleted={!!selectedRfpId}
      >
        {loadingRfps ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#9aff8d]"></div>
            <p className="text-zinc-400 text-sm mt-2">Cargando RFPs...</p>
          </div>
        ) : (
          <div>
            <select
              value={selectedRfpId}
              onChange={(e) => setSelectedRfpId(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            >
              <option value="">-- Seleccionar RFP --</option>
              {rfps.map((rfp) => (
                <option key={rfp.rfp_id} value={rfp.rfp_id}>
                  {rfp.rfp_id.substring(0, 8)}... - {rfp.status || 'N/A'}
                </option>
              ))}
            </select>
            {selectedRfp && (
              <div className="mt-4 p-3 bg-zinc-900 rounded-lg">
                <p className="text-sm text-zinc-400">
                  Status: <StatusBadge status={selectedRfp.status} />
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Publicado: {formatDate(selectedRfp.published_at)}
                </p>
              </div>
            )}
          </div>
        )}
      </StepCard>

      {/* Paso 2: Registrar Oferta */}
      <StepCard
        stepNumber={2}
        title="Registrar Oferta"
        description="Crea una oferta demo para el RFP seleccionado"
        isActive={!!selectedRfpId && !hasOffers}
        isCompleted={hasOffers}
      >
        {!selectedRfpId ? (
          <p className="text-zinc-400 text-sm">Primero selecciona un RFP</p>
        ) : (
          <div>
            <button
              onClick={handleCreateOffer}
              disabled={submittingOffer || hasOffers}
              className="px-6 py-3 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-700 disabled:text-zinc-400 text-[#232323] rounded-md transition-colors font-medium disabled:cursor-not-allowed"
            >
              {submittingOffer ? 'Creando...' : 'Crear oferta demo'}
            </button>

            {offerError && (
              <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {offerError}</p>
              </div>
            )}

            {offerSuccess && (
              <div className="mt-4 bg-green-900/20 border border-green-800 rounded-lg p-3">
                <p className="text-green-300 text-sm">✓ Oferta creada exitosamente</p>
              </div>
            )}

            {loadingOffers ? (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#9aff8d]"></div>
              </div>
            ) : offers.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-900">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300">Oferta ID</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300">Precio</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300">Lead Time</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700">
                    {offers.map((offer) => (
                      <tr key={offer.offer_id} className="hover:bg-zinc-700/50">
                        <td className="px-4 py-2 text-xs text-zinc-400 font-mono">
                          {offer.offer_id.substring(0, 8)}...
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {formatCurrency(offer.price_total, offer.currency)}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {offer.lead_time_days || 'N/A'} días
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {formatDate(offer.submitted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </StepCard>

      {/* Paso 3: Generar Evaluación (Scoring) */}
      <StepCard
        stepNumber={3}
        title="Generar Evaluación (Scoring)"
        description="Ejecuta el algoritmo de scoring para evaluar las ofertas"
        isActive={hasOffers && !hasScoring}
        isCompleted={hasScoring}
      >
        {!selectedRfpId ? (
          <p className="text-zinc-400 text-sm">Completa los pasos anteriores</p>
        ) : (
          <div>
            <button
              onClick={handleGenerateScoring}
              disabled={generatingScoring || hasScoring}
              className="px-6 py-3 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-700 disabled:text-zinc-400 text-[#232323] rounded-md transition-colors font-medium disabled:cursor-not-allowed"
            >
              {generatingScoring ? 'Generando...' : 'Generar evaluación'}
            </button>

            {scoringError && (
              <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {scoringError}</p>
              </div>
            )}

            {scoringSuccess && (
              <div className="mt-4 bg-green-900/20 border border-green-800 rounded-lg p-3">
                <p className="text-green-300 text-sm">✓ Evaluación generada exitosamente</p>
              </div>
            )}

            {loadingScoring ? (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#9aff8d]"></div>
              </div>
            ) : scoringRuns.length > 0 && (
              <div className="mt-6">
                <p className="text-sm text-zinc-400 mb-2">Última evaluación:</p>
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-2">
                    Creada: {formatDate(scoringRuns[0].created_at)}
                  </p>
                  {scoringRuns[0].results_json && (
                    <details className="mt-2">
                      <summary className="text-sm text-[#9aff8d] cursor-pointer">Ver resultados JSON</summary>
                      <pre className="mt-2 text-xs text-zinc-400 overflow-x-auto">
                        {JSON.stringify(scoringRuns[0].results_json, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </StepCard>

      {/* Paso 4: Decisión del Comité */}
      <StepCard
        stepNumber={4}
        title="Decisión del Comité"
        description="Aprueba o rechaza el RFP basado en la evaluación"
        isActive={hasScoring && !hasDecision}
        isCompleted={hasDecision}
      >
        {!selectedRfpId || !hasScoring ? (
          <p className="text-zinc-400 text-sm">Completa los pasos anteriores</p>
        ) : (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Justificación
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Razón de la decisión..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
                rows={3}
              />
            </div>

            {offers.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Oferta a aprobar (si aplica)
                </label>
                <select
                  value={selectedOfferId}
                  onChange={(e) => setSelectedOfferId(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
                >
                  <option value="">-- Seleccionar oferta --</option>
                  {offers.map((offer) => (
                    <option key={offer.offer_id} value={offer.offer_id}>
                      {formatCurrency(offer.price_total, offer.currency)} - {offer.lead_time_days} días
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => handleCommitteeDecision('approve')}
                disabled={submittingDecision || hasDecision}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-white rounded-md transition-colors font-medium disabled:cursor-not-allowed"
              >
                {submittingDecision ? 'Procesando...' : 'Aprobar'}
              </button>
              <button
                onClick={() => handleCommitteeDecision('reject')}
                disabled={submittingDecision || hasDecision}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-white rounded-md transition-colors font-medium disabled:cursor-not-allowed"
              >
                {submittingDecision ? 'Procesando...' : 'Rechazar'}
              </button>
            </div>

            {decisionError && (
              <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {decisionError}</p>
              </div>
            )}

            {decisionSuccess && (
              <div className="mt-4 bg-green-900/20 border border-green-800 rounded-lg p-3">
                <p className="text-green-300 text-sm">✓ Decisión registrada exitosamente</p>
              </div>
            )}
          </div>
        )}
      </StepCard>

      {/* Paso 5: Orden de Compra */}
      <StepCard
        stepNumber={5}
        title="Orden de Compra"
        description="Visualiza la orden de compra generada y su evidencia"
        isActive={hasDecision && !hasPO}
        isCompleted={hasPO}
      >
        {!selectedRfpId || !hasDecision ? (
          <p className="text-zinc-400 text-sm">Completa los pasos anteriores</p>
        ) : loadingPO ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#9aff8d]"></div>
            <p className="text-zinc-400 text-sm mt-2">Cargando orden de compra...</p>
          </div>
        ) : purchaseOrder ? (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400">PO ID:</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm">{purchaseOrder.po_id}</span>
                  <CopyButton textToCopy={purchaseOrder.po_id} />
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400">Monto:</span>
                <span className="text-white font-semibold">
                  {formatCurrency(purchaseOrder.total_amount, purchaseOrder.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Creada:</span>
                <span className="text-white text-sm">{formatDate(purchaseOrder.created_at)}</span>
              </div>
            </div>

            {evidence && (
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400">Evidence ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm">{evidence.evidence_id}</span>
                    <CopyButton textToCopy={evidence.evidence_id} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Hash SHA256:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-xs">
                      {evidence.payload_hash_sha256?.substring(0, 16)}...
                    </span>
                    {evidence.payload_hash_sha256 && (
                      <CopyButton textToCopy={evidence.payload_hash_sha256} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-zinc-400 text-sm">No hay orden de compra generada aún</p>
        )}
      </StepCard>

      {/* Paso 6: Ver Trazabilidad */}
      <StepCard
        stepNumber={6}
        title="Ver Trazabilidad"
        description="Consulta los eventos de auditoría relacionados con este proceso"
        isActive={hasPO}
        isCompleted={auditEvents.length > 0}
      >
        {!correlationId ? (
          <p className="text-zinc-400 text-sm">
            {hasDecision ? 'Ingresa el correlation_id para ver la trazabilidad' : 'Completa los pasos anteriores'}
          </p>
        ) : (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Correlation ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={correlationId}
                  onChange={(e) => setCorrelationId(e.target.value)}
                  placeholder="UUID"
                  className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
                />
                <CopyButton textToCopy={correlationId} />
              </div>
            </div>

            {loadingAudit ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#9aff8d]"></div>
              </div>
            ) : auditEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-900">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300">Fecha</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300">Tipo</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-300">Resumen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700">
                    {auditEvents.map((event) => (
                      <tr key={event.event_id} className="hover:bg-zinc-700/50">
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {formatDate(event.created_at)}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {event.event_type || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {event.summary || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-zinc-400 text-sm">No hay eventos de auditoría para este correlation_id</p>
            )}
          </div>
        )}
      </StepCard>
    </div>
  );
}
