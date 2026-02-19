'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PageTitle from '../../components/ui/PageTitle';
import SectionCard from '../../components/ui/SectionCard';
import StatusBadge from '../../components/ui/StatusBadge';
import CopyButton from '../../components/ui/CopyButton';

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
  attachments_path: string | null;
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

interface CommitteeDecision {
  decision_id: string;
  rfp_id: string | null;
  decision: string;
  justification: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
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

// Stepper Component
function Stepper({ 
  hasScoring, 
  hasOffers, 
  hasCommittee, 
  hasPO, 
  hasAudit 
}: {
  hasScoring: boolean;
  hasOffers: boolean;
  hasCommittee: boolean;
  hasPO: boolean;
  hasAudit: boolean;
}) {
  const steps = [
    { label: 'Scoring', completed: hasScoring },
    { label: 'Offers', completed: hasOffers },
    { label: 'Comité', completed: hasCommittee },
    { label: 'PO/Evidencia', completed: hasPO },
    { label: 'Auditoría', completed: hasAudit },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  step.completed
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}
              >
                {step.completed ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <span className={`mt-2 text-xs font-medium ${step.completed ? 'text-green-400' : 'text-zinc-500'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 transition-colors ${
                  step.completed ? 'bg-green-600' : 'bg-zinc-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


export default function RfpDetailPage() {
  const params = useParams();
  const rfpId = params.rfp_id as string;

  // Data states
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [committeeDecisions, setCommitteeDecisions] = useState<CommitteeDecision[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // Loading states per section
  const [loadingScoring, setLoadingScoring] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [loadingCommittee, setLoadingCommittee] = useState(true);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);

  // Error states per section
  const [errorScoring, setErrorScoring] = useState<string | null>(null);
  const [errorOffers, setErrorOffers] = useState<string | null>(null);
  const [errorCommittee, setErrorCommittee] = useState<string | null>(null);
  const [errorPOs, setErrorPOs] = useState<string | null>(null);
  const [errorAudit, setErrorAudit] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    supplier_name: '',
    price_total: '',
    currency: 'COP',
    lead_time_days: '',
  });

  // Load all data
  useEffect(() => {
    if (!rfpId) return;

    async function fetchData() {
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

      // Load committee decisions
      try {
        setLoadingCommittee(true);
        const res = await fetch(`/api/data/committee-decisions?rfp_id=${rfpId}`);
        if (res.ok) {
          const result = await res.json();
          setCommitteeDecisions(result.data || []);
        } else {
          setErrorCommittee('Failed to load committee decisions');
        }
      } catch (err) {
        setErrorCommittee('Error loading committee decisions');
      } finally {
        setLoadingCommittee(false);
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

      // Load audit events
      try {
        setLoadingAudit(true);
        const res = await fetch(`/api/data/audit-events?entity_id=${rfpId}`);
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

    fetchData();
  }, [rfpId]);

  // Format currency
  const formatCurrency = (amount: number, currency: string | null = 'COP') => {
    try {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency || 'COP',
      }).format(amount);
    } catch {
      return `${amount.toLocaleString('es-CO')} ${currency || 'COP'}`;
    }
  };

  // Format date
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


  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.supplier_name.trim()) {
      errors.supplier_name = 'El nombre del proveedor es requerido';
    }

    if (!formData.price_total.trim()) {
      errors.price_total = 'El precio total es requerido';
    } else {
      const price = parseFloat(formData.price_total);
      if (isNaN(price) || price <= 0) {
        errors.price_total = 'El precio debe ser un número mayor a 0';
      }
    }

    if (formData.lead_time_days && formData.lead_time_days.trim()) {
      const days = parseInt(formData.lead_time_days);
      if (isNaN(days) || days < 0) {
        errors.lead_time_days = 'El tiempo de entrega debe ser un número positivo';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rfpId) {
      setErrorOffers('RFP ID is required');
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorOffers(null);
      setSubmitSuccess(false);
      setFormErrors({});

      const response = await fetch('/api/workflows/offer-submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rfp_id: rfpId,
          supplier_name: formData.supplier_name.trim(),
          price_total: parseFloat(formData.price_total),
          currency: formData.currency,
          lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `Failed to submit offer: ${response.statusText}`);
      }

      setSubmitSuccess(true);

      setFormData({
        supplier_name: '',
        price_total: '',
        currency: 'COP',
        lead_time_days: '',
      });

      setTimeout(async () => {
        const offersRes = await fetch(`/api/data/offers?rfp_id=${rfpId}`);
        if (offersRes.ok) {
          const result = await offersRes.json();
          setOffers(result.data || []);
        }
        setTimeout(() => {
          setShowForm(false);
          setSubmitSuccess(false);
        }, 1000);
      }, 500);
    } catch (err) {
      setErrorOffers(err instanceof Error ? err.message : 'Failed to submit offer');
      console.error('Error submitting offer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseForm = () => {
    if (!submitting) {
      setShowForm(false);
      setFormData({
        supplier_name: '',
        price_total: '',
        currency: 'COP',
        lead_time_days: '',
      });
      setFormErrors({});
      setSubmitSuccess(false);
      setErrorOffers(null);
    }
  };

  // Get latest audit event for trust panel
  const latestAuditEvent = auditEvents.length > 0 ? auditEvents[0] : null;

  // Stepper completion states
  const hasScoring = scoringRuns.length > 0;
  const hasOffers = offers.length > 0;
  const hasCommittee = committeeDecisions.length > 0;
  const hasPO = purchaseOrders.length > 0;
  const hasAudit = auditEvents.length > 0;

  return (
    <div>
      <PageTitle 
        title="RFP Detalle"
        subtitle={`RFP ID: ${rfpId}`}
      />

        {/* Stepper */}
        <Stepper
          hasScoring={hasScoring}
          hasOffers={hasOffers}
          hasCommittee={hasCommittee}
          hasPO={hasPO}
          hasAudit={hasAudit}
        />

        {/* Trust Panel */}
        {latestAuditEvent && (
          <SectionCard 
            title="Confianza Verificable"
            className="border-green-500/50"
          >
              <div className="space-y-3">
                {latestAuditEvent.correlation_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Correlation ID:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-300 font-mono">
                        {latestAuditEvent.correlation_id.substring(0, 8)}...
                      </span>
                      <CopyButton textToCopy={latestAuditEvent.correlation_id} />
                    </div>
                  </div>
                )}
                {latestAuditEvent.payload_hash_sha256 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Hash SHA256:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-300 font-mono">
                        {latestAuditEvent.payload_hash_sha256.substring(0, 16)}...
                      </span>
                      <CopyButton textToCopy={latestAuditEvent.payload_hash_sha256} />
                    </div>
                  </div>
                )}
              </div>
          </SectionCard>
        )}

        {/* Scoring Section */}
        <SectionCard title="Scoring">
            {loadingScoring ? (
              <p className="text-zinc-400 text-sm">Cargando scoring runs...</p>
            ) : errorScoring ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {errorScoring}</p>
              </div>
            ) : scoringRuns.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay scoring runs disponibles</p>
            ) : (
              <div className="space-y-2">
                <p className="text-zinc-400 text-sm">
                  Total runs: {scoringRuns.length} | Último: {formatDate(scoringRuns[0]?.created_at)}
                </p>
              </div>
            )}
        </SectionCard>

        {/* Offers Section */}
        <SectionCard 
          title="Ofertas"
          description="Gestión de ofertas para este RFP"
        >
          <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setShowForm(true)}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Enviar oferta
              </button>
            </div>

            {errorOffers && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">Error: {errorOffers}</p>
              </div>
            )}

            {/* Modal */}
            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-zinc-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-zinc-700">
                  <div className="sticky top-0 bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Nueva Oferta</h3>
                    <button
                      onClick={handleCloseForm}
                      disabled={submitting}
                      className="text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleSubmitOffer} className="p-6 space-y-5">
                    {submitSuccess && (
                      <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-center gap-3">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-green-200 text-sm font-medium">¡Oferta enviada exitosamente!</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-300">
                        Nombre del Proveedor <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.supplier_name}
                        onChange={(e) => {
                          setFormData({ ...formData, supplier_name: e.target.value });
                          if (formErrors.supplier_name) {
                            setFormErrors({ ...formErrors, supplier_name: '' });
                          }
                        }}
                        className={`w-full px-4 py-2.5 border rounded-lg bg-zinc-900 text-white transition-colors focus:outline-none focus:ring-2 ${
                          formErrors.supplier_name
                            ? 'border-red-700 focus:ring-red-500'
                            : 'border-zinc-700 focus:ring-green-500'
                        }`}
                        placeholder="Ingresa el nombre del proveedor"
                        disabled={submitting}
                      />
                      {formErrors.supplier_name && (
                        <p className="mt-1.5 text-sm text-red-400">{formErrors.supplier_name}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-zinc-300">
                          Precio Total <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={formData.price_total}
                          onChange={(e) => {
                            setFormData({ ...formData, price_total: e.target.value });
                            if (formErrors.price_total) {
                              setFormErrors({ ...formErrors, price_total: '' });
                            }
                          }}
                          className={`w-full px-4 py-2.5 border rounded-lg bg-zinc-900 text-white transition-colors focus:outline-none focus:ring-2 ${
                            formErrors.price_total
                              ? 'border-red-700 focus:ring-red-500'
                              : 'border-zinc-700 focus:ring-green-500'
                          }`}
                          placeholder="0.00"
                          disabled={submitting}
                        />
                        {formErrors.price_total && (
                          <p className="mt-1.5 text-sm text-red-400">{formErrors.price_total}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-zinc-300">Moneda</label>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full px-4 py-2.5 border border-zinc-700 rounded-lg bg-zinc-900 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={submitting}
                        >
                          <option value="COP">COP</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="MXN">MXN</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-300">
                        Tiempo de Entrega (días)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.lead_time_days}
                        onChange={(e) => {
                          setFormData({ ...formData, lead_time_days: e.target.value });
                          if (formErrors.lead_time_days) {
                            setFormErrors({ ...formErrors, lead_time_days: '' });
                          }
                        }}
                        className={`w-full px-4 py-2.5 border rounded-lg bg-zinc-900 text-white transition-colors focus:outline-none focus:ring-2 ${
                          formErrors.lead_time_days
                            ? 'border-red-700 focus:ring-red-500'
                            : 'border-zinc-700 focus:ring-green-500'
                        }`}
                        placeholder="Opcional"
                        disabled={submitting}
                      />
                      {formErrors.lead_time_days && (
                        <p className="mt-1.5 text-sm text-red-400">{formErrors.lead_time_days}</p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleCloseForm}
                        disabled={submitting}
                        className="flex-1 px-4 py-2.5 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || submitSuccess}
                        className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-green-400 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submitting ? 'Enviando...' : submitSuccess ? 'Enviado' : 'Enviar Oferta'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {loadingOffers ? (
              <p className="text-zinc-400 text-sm">Cargando ofertas...</p>
            ) : offers.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay ofertas disponibles</p>
            ) : (
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Supplier ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Precio Total</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Moneda</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Tiempo Entrega</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Fecha Envío</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700">
                      {offers.map((offer) => (
                        <tr key={offer.offer_id} className="hover:bg-zinc-700/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                            {offer.supplier_id ? offer.supplier_id.substring(0, 8) + '...' : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            {formatCurrency(offer.price_total, offer.currency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            {offer.currency || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            {offer.lead_time_days ? `${offer.lead_time_days} días` : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            <StatusBadge status={offer.status} />
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            {formatDate(offer.submitted_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </SectionCard>

        {/* Committee Decision Section */}
        <SectionCard title="Decisión del Comité">
            {loadingCommittee ? (
              <p className="text-zinc-400 text-sm">Cargando decisiones...</p>
            ) : errorCommittee ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {errorCommittee}</p>
              </div>
            ) : committeeDecisions.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay decisiones del comité disponibles</p>
            ) : (
              <div className="space-y-4">
                {committeeDecisions.map((decision) => (
                  <div
                    key={decision.decision_id}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusBadge status={decision.decision} />
                        </div>
                        {decision.justification && (
                          <p className="text-sm text-zinc-400 mt-2">{decision.justification}</p>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">{formatDate(decision.decided_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Purchase Orders Section */}
        <SectionCard title="Órdenes de Compra">
            {loadingPOs ? (
              <p className="text-zinc-400 text-sm">Cargando purchase orders...</p>
            ) : errorPOs ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {errorPOs}</p>
              </div>
            ) : purchaseOrders.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay purchase orders disponibles</p>
            ) : (
              <div className="space-y-4">
                {purchaseOrders.map((po) => (
                  <div key={po.po_id} className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-mono text-zinc-500">PO ID:</span>
                          <span className="text-sm text-zinc-300 font-mono">{po.po_id.substring(0, 8)}...</span>
                          <CopyButton textToCopy={po.po_id} />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-zinc-400">Status:</span>
                          <StatusBadge status={po.status} />
                        </div>
                        {po.evidence_id && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-zinc-400">Evidence ID:</span>
                            <span className="text-sm text-zinc-300 font-mono">{po.evidence_id.substring(0, 8)}...</span>
                            <CopyButton textToCopy={po.evidence_id} />
                          </div>
                        )}
                        {po.po_document_path && (
                          <p className="text-sm text-zinc-400 mt-2">
                            Documento: <span className="font-mono">{po.po_document_path}</span>
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">{formatDate(po.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        {/* Audit Section */}
        <SectionCard title="Auditoría">
            {loadingAudit ? (
              <p className="text-zinc-400 text-sm">Cargando eventos de auditoría...</p>
            ) : errorAudit ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-300 text-sm">Error: {errorAudit}</p>
              </div>
            ) : auditEvents.length === 0 ? (
              <p className="text-zinc-400 text-sm">No hay eventos de auditoría disponibles</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Event Type</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Summary</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Hash</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700">
                    {auditEvents.map((event) => (
                      <tr key={event.event_id} className="hover:bg-zinc-700/50">
                        <td className="px-3 py-2 text-xs text-zinc-400">{event.event_type || 'N/A'}</td>
                        <td className="px-3 py-2 text-xs text-zinc-400">{event.summary || 'N/A'}</td>
                        <td className="px-3 py-2 text-xs text-zinc-400 font-mono">
                          {event.payload_hash_sha256 ? (
                            <div className="flex items-center gap-2">
                              <span>{event.payload_hash_sha256.substring(0, 12)}...</span>
                              <CopyButton textToCopy={event.payload_hash_sha256!} />
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-400">{formatDate(event.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </SectionCard>
    </div>
  );
}
