'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PageTitle from '../../../components/ui/PageTitle';
import SectionCard from '../../../components/ui/SectionCard';
import StatusBadge from '../../../components/ui/StatusBadge';
import CopyButton from '../../../components/ui/CopyButton';

interface ScoringRun {
  run_id: string;
  rfp_id: string | null;
  weights_version_id: string | null;
  results_json: any;
  created_at: string | null;
}

interface Offer {
  offer_id: string;
  rfp_id: string | null;
  supplier_id: string | null;
  price_total: number;
  currency: string | null;
  lead_time_days: number | null;
  terms_json: any;
  status: string | null;
  submitted_at: string | null;
}

interface PurchaseOrder {
  po_id: string;
  rfp_id: string | null;
  offer_id: string | null;
  status: string | null;
  po_document_path: string | null;
  evidence_id: string | null;
  created_at: string | null;
}

interface AuditEvent {
  event_id: string;
  correlation_id: string | null;
  event_type: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  company_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  payload_hash_sha256: string | null;
  created_at: string | null;
}

export default function WorkbenchPage() {
  const params = useParams();
  const rfpId = params.rfp_id as string;

  // Data states
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // Loading states
  const [loadingScoring, setLoadingScoring] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Error states
  const [errorScoring, setErrorScoring] = useState<string | null>(null);
  const [errorOffers, setErrorOffers] = useState<string | null>(null);
  const [errorPOs, setErrorPOs] = useState<string | null>(null);
  const [errorAudit, setErrorAudit] = useState<string | null>(null);

  // Action states
  const [generatingScoring, setGeneratingScoring] = useState(false);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Form states
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({
    price_total: '',
    currency: 'COP',
    lead_time_days: '',
    notes: '',
  });
  const [justification, setJustification] = useState('');

  // Correlation ID
  const [lastCorrelationId, setLastCorrelationId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    if (!rfpId) return;

    async function loadData() {
      // Load scoring runs
      try {
        setLoadingScoring(true);
        const res = await fetch(`/api/data/scoring-runs?rfp_id=${rfpId}`);
        if (res.ok) {
          const result = await res.json();
          setScoringRuns(result.data || []);
        } else {
          setErrorScoring('Failed to load scoring runs');
        }
      } catch (err) {
        setErrorScoring('Error loading scoring runs');
      } finally {
        setLoadingScoring(false);
      }

      // Load offers
      try {
        setLoadingOffers(true);
        const res = await fetch(`/api/data/offers?rfp_id=${rfpId}`);
        if (res.ok) {
          const result = await res.json();
          setOffers(result.data || []);
        } else {
          setErrorOffers('Failed to load offers');
        }
      } catch (err) {
        setErrorOffers('Error loading offers');
      } finally {
        setLoadingOffers(false);
      }

      // Load purchase orders
      try {
        setLoadingPOs(true);
        const res = await fetch(`/api/data/purchase-orders?rfp_id=${rfpId}`);
        if (res.ok) {
          const result = await res.json();
          setPurchaseOrders(result.data || []);
        } else {
          setErrorPOs('Failed to load purchase orders');
        }
      } catch (err) {
        setErrorPOs('Error loading purchase orders');
      } finally {
        setLoadingPOs(false);
      }
    }

    loadData();
  }, [rfpId]);

  // Load audit events when correlation_id changes
  useEffect(() => {
    if (!lastCorrelationId) {
      setAuditEvents([]);
      return;
    }

    async function loadAudit() {
      try {
        setLoadingAudit(true);
        setErrorAudit(null);
        const res = await fetch(`/api/data/audit-events?correlation_id=${lastCorrelationId}`);
        if (res.ok) {
          const result = await res.json();
          setAuditEvents(result.data || []);
        } else {
          setErrorAudit('Failed to load audit events');
        }
      } catch (err) {
        setErrorAudit('Error loading audit events');
      } finally {
        setLoadingAudit(false);
      }
    }

    loadAudit();
  }, [lastCorrelationId]);

  // Generate scoring
  const handleGenerateScoring = async () => {
    if (!rfpId) return;

    try {
      setGeneratingScoring(true);
      setErrorScoring(null);

      const res = await fetch('/api/workflows/scoring-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfp_id: rfpId }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to generate scoring');
      }

      // Refresh scoring runs
      const refreshRes = await fetch(`/api/data/scoring-runs?rfp_id=${rfpId}`);
      if (refreshRes.ok) {
        const result = await refreshRes.json();
        setScoringRuns(result.data || []);
      }
    } catch (err) {
      setErrorScoring(err instanceof Error ? err.message : 'Failed to generate scoring');
    } finally {
      setGeneratingScoring(false);
    }
  };

  // Submit offer
  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfpId) return;

    try {
      setSubmittingOffer(true);
      setErrorOffers(null);

      const res = await fetch('/api/workflows/offer-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfp_id: rfpId,
          price_total: parseFloat(offerForm.price_total),
          currency: offerForm.currency,
          lead_time_days: offerForm.lead_time_days ? parseInt(offerForm.lead_time_days) : null,
          terms_json: offerForm.notes ? { notes: offerForm.notes } : null,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to submit offer');
      }

      const result = await res.json();

      // Reset form
      setOfferForm({
        price_total: '',
        currency: 'COP',
        lead_time_days: '',
        notes: '',
      });

      // Refresh offers
      const refreshRes = await fetch(`/api/data/offers?rfp_id=${rfpId}`);
      if (refreshRes.ok) {
        const result = await refreshRes.json();
        setOffers(result.data || []);
        // Auto-select new offer if available
        if (result.offer && result.offer.offer_id) {
          setSelectedOfferId(result.offer.offer_id);
        }
      }
    } catch (err) {
      setErrorOffers(err instanceof Error ? err.message : 'Failed to submit offer');
    } finally {
      setSubmittingOffer(false);
    }
  };

  // Submit committee decision
  const handleSubmitDecision = async (decision: 'approve' | 'reject') => {
    if (!rfpId) return;
    if (decision === 'approve' && !selectedOfferId) {
      setErrorPOs('Please select an offer to approve');
      return;
    }

    try {
      setSubmittingDecision(true);
      setErrorPOs(null);

      const correlationId = crypto.randomUUID();

      const res = await fetch('/api/workflows/committee-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfp_id: rfpId,
          offer_id: decision === 'approve' ? selectedOfferId : null,
          decision: decision,
          justification: justification || null,
          correlation_id: correlationId,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to submit decision');
      }

      // Save correlation ID
      setLastCorrelationId(correlationId);

      // Reset justification
      setJustification('');

      // Refresh purchase orders
      const refreshRes = await fetch(`/api/data/purchase-orders?rfp_id=${rfpId}`);
      if (refreshRes.ok) {
        const result = await refreshRes.json();
        setPurchaseOrders(result.data || []);
      }
    } catch (err) {
      setErrorPOs(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setSubmittingDecision(false);
    }
  };


  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('es-ES');
    } catch {
      return dateString;
    }
  };

  const formatJSON = (json: any): string => {
    try {
      return JSON.stringify(json, null, 2);
    } catch {
      return String(json);
    }
  };

  const latestScoringRun = scoringRuns.length > 0 ? scoringRuns[0] : null;

  return (
    <div className="min-h-screen bg-textured">
      <Header backUrl={`/rfp/${rfpId}`} backLabel="Volver a RFP" />
      <main className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <h1 className="text-2xl font-semibold text-white mb-6">
          Workbench - RFP {rfpId.substring(0, 8)}...
        </h1>

        {/* Scoring Section */}
        <SectionCard title="Scoring">
          <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleGenerateScoring}
                disabled={generatingScoring}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-400 text-white rounded-md transition-colors text-sm font-medium disabled:cursor-not-allowed"
              >
                {generatingScoring ? 'Generando...' : 'Generar scoring'}
              </button>
            </div>

            {errorScoring && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">Error: {errorScoring}</p>
              </div>
            )}

            {loadingScoring ? (
              <p className="text-zinc-400 text-sm">Cargando scoring runs...</p>
            ) : scoringRuns.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay scoring runs disponibles</p>
            ) : (
              <div className="space-y-4">
                <p className="text-zinc-400 text-sm">
                  Total runs: {scoringRuns.length} | Último: {formatDate(latestScoringRun?.created_at)}
                </p>
                {latestScoringRun?.results_json && (
                  <details className="bg-zinc-900 rounded-lg p-4">
                    <summary className="text-white font-medium cursor-pointer mb-2">
                      Ver último results_json
                    </summary>
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words overflow-x-auto">
                      {formatJSON(latestScoringRun.results_json)}
                    </pre>
                  </details>
                )}
              </div>
            )}
        </SectionCard>

        {/* Offers Section */}
        <SectionCard title="Offers">

            {errorOffers && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">Error: {errorOffers}</p>
              </div>
            )}

            {/* Create Offer Form */}
            <form onSubmit={handleSubmitOffer} className="mb-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Precio Total <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={offerForm.price_total}
                    onChange={(e) => setOfferForm({ ...offerForm, price_total: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                    disabled={submittingOffer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Moneda</label>
                  <select
                    value={offerForm.currency}
                    onChange={(e) => setOfferForm({ ...offerForm, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={submittingOffer}
                  >
                    <option value="COP">COP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="MXN">MXN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Tiempo Entrega (días)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={offerForm.lead_time_days}
                    onChange={(e) => setOfferForm({ ...offerForm, lead_time_days: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Opcional"
                    disabled={submittingOffer}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Notas</label>
                <textarea
                  value={offerForm.notes}
                  onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={2}
                  placeholder="Notas opcionales"
                  disabled={submittingOffer}
                />
              </div>
              <button
                type="submit"
                disabled={submittingOffer}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-400 text-white rounded-md transition-colors text-sm font-medium disabled:cursor-not-allowed"
              >
                {submittingOffer ? 'Enviando...' : 'Crear Oferta'}
              </button>
            </form>

            {/* Offers List */}
            {loadingOffers ? (
              <p className="text-zinc-400 text-sm">Cargando ofertas...</p>
            ) : offers.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay ofertas disponibles</p>
            ) : (
              <div className="space-y-2">
                <p className="text-zinc-400 text-sm font-medium mb-2">Seleccionar oferta:</p>
                {offers.map((offer) => (
                  <label
                    key={offer.offer_id}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedOfferId === offer.offer_id
                        ? 'bg-green-900/20 border-green-500/50'
                        : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="offer"
                      value={offer.offer_id}
                      checked={selectedOfferId === offer.offer_id}
                      onChange={(e) => setSelectedOfferId(e.target.value)}
                      className="text-green-500"
                    />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">
                        {offer.price_total.toLocaleString()} {offer.currency}
                      </p>
                      <p className="text-zinc-400 text-xs">
                        ID: {offer.offer_id.substring(0, 8)}... | 
                        {offer.lead_time_days && ` ${offer.lead_time_days} días`} |
                        {offer.status && ` Status: ${offer.status}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Committee Section */}
        <SectionCard title="Committee Decision">

            {errorPOs && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">Error: {errorPOs}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Justificación
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Justificación de la decisión..."
                  disabled={submittingDecision}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSubmitDecision('approve')}
                  disabled={submittingDecision || !selectedOfferId}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
                >
                  {submittingDecision ? 'Procesando...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleSubmitDecision('reject')}
                  disabled={submittingDecision}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
                >
                  {submittingDecision ? 'Procesando...' : 'Reject'}
                </button>
              </div>

              {selectedOfferId && (
                <p className="text-zinc-400 text-xs">
                  Oferta seleccionada: {selectedOfferId.substring(0, 8)}...
                </p>
              )}
            </div>
        </SectionCard>

        {/* Purchase Orders Section */}
        <SectionCard title="Purchase Orders">

            {loadingPOs ? (
              <p className="text-zinc-400 text-sm">Cargando purchase orders...</p>
            ) : purchaseOrders.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay purchase orders disponibles</p>
            ) : (
              <div className="space-y-3">
                {purchaseOrders.map((po) => (
                  <div
                    key={po.po_id}
                    className="bg-zinc-900 border border-zinc-700 rounded-md p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium mb-1">
                          PO ID: {po.po_id.substring(0, 8)}...
                        </p>
                        <p className="text-zinc-400 text-xs">
                          Status: {po.status || 'N/A'} | 
                          Created: {formatDate(po.created_at)}
                        </p>
                        {po.evidence_id && (
                          <p className="text-zinc-400 text-xs mt-1">
                            Evidence ID: {po.evidence_id.substring(0, 8)}...
                            <button
                              onClick={() => copyToClipboard(po.evidence_id!)}
                              className="ml-2 text-green-400 hover:text-green-300 text-xs"
                            >
                              [Copiar]
                            </button>
                          </p>
                        )}
                      </div>
                      <CopyButton textToCopy={po.po_id} label="Copiar ID" />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Audit Trail Section */}
        <SectionCard title="Audit Trail">
          {lastCorrelationId && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-xs">Correlation ID:</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-xs font-mono">
                  {lastCorrelationId.substring(0, 8)}...
                </span>
                <CopyButton textToCopy={lastCorrelationId} label="[Copiar]" />
              </div>
            </div>
          )}

            {!lastCorrelationId ? (
              <p className="text-zinc-400 text-sm">
                Ejecuta una decisión del comité para ver el audit trail
              </p>
            ) : (
              <>
                {errorAudit && (
                  <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-red-300 text-sm">Error: {errorAudit}</p>
                  </div>
                )}

                {loadingAudit ? (
                  <p className="text-zinc-400 text-sm">Cargando audit events...</p>
                ) : auditEvents.length === 0 ? (
                  <p className="text-zinc-400 text-sm">No hay audit events para este correlation_id</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-900">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">
                            Event Type
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">
                            Entity
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">
                            Summary
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">
                            Hash
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-700">
                        {auditEvents.map((event) => (
                          <tr key={event.event_id} className="hover:bg-zinc-700/50">
                            <td className="px-3 py-2 text-xs text-zinc-400">
                              {event.event_type || 'N/A'}
                            </td>
                            <td className="px-3 py-2 text-xs text-zinc-400">
                              {event.entity_type || 'N/A'}:                               {event.entity_id ? event.entity_id.substring(0, 8) + '...' : 'N/A'}
                              {event.entity_id && (
                                <CopyButton textToCopy={event.entity_id} label="[C]" />
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-zinc-400">
                              {event.summary || 'N/A'}
                            </td>
                            <td className="px-3 py-2 text-xs text-zinc-400 font-mono">
                              {event.payload_hash_sha256 ? (
                                <>
                                  {event.payload_hash_sha256.substring(0, 12)}...
                                  <button
                                    onClick={() => copyToClipboard(event.payload_hash_sha256!)}
                                    className="ml-1 text-green-400 hover:text-green-300"
                                  >
                                    [C]
                                  </button>
                                </>
                              ) : (
                                'N/A'
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-zinc-400">
                              {formatDate(event.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
        </SectionCard>
    </div>
  );
}

