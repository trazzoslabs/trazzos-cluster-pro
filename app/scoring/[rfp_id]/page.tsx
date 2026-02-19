'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';

interface ScoringWeightsVersion {
  weights_version_id: string;
  rfp_id: string | null;
  weights_json: any;
  created_by: string | null;
  created_at: string | null;
}

interface ScoringRun {
  run_id: string;
  rfp_id: string | null;
  weights_version_id: string | null;
  results_json: any;
  created_at: string | null;
}

export default function ScoringPage() {
  const params = useParams();
  const rfpId = params.rfp_id as string;

  const [weightsVersions, setWeightsVersions] = useState<ScoringWeightsVersion[]>([]);
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      if (!rfpId) return;

      try {
        setLoading(true);
        setError(null);

        const [weightsRes, runsRes] = await Promise.all([
          fetch(`/api/data/scoring-weights?rfp_id=${rfpId}`),
          fetch(`/api/data/scoring-runs?rfp_id=${rfpId}`),
        ]);

        if (!weightsRes.ok) {
          throw new Error(`Failed to fetch scoring weights: ${weightsRes.statusText}`);
        }
        if (!runsRes.ok) {
          throw new Error(`Failed to fetch scoring runs: ${runsRes.statusText}`);
        }

        const weightsResult = await weightsRes.json();
        const runsResult = await runsRes.json();

        console.log('Scoring weights result:', weightsResult);
        console.log('Scoring runs result:', runsResult);
        console.log('Scoring runs data:', runsResult.data);
        console.log('Number of runs:', runsResult.data?.length || 0);

        setWeightsVersions(weightsResult.data || []);
        const runs = runsResult.data || [];
        console.log('Setting scoring runs:', runs);
        setScoringRuns(runs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('Error fetching scoring data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [rfpId]);

  const handleGenerateScoring = async () => {
    if (!rfpId) {
      setError('RFP ID is required');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const response = await fetch('/api/workflows/scoring-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rfp_id: rfpId,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `Failed to generate scoring: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Scoring run response:', result);
      
      // Refrescar scoring runs inmediatamente
      const runsRes = await fetch(`/api/data/scoring-runs?rfp_id=${rfpId}`);
      if (runsRes.ok) {
        const runsResult = await runsRes.json();
        console.log('Refreshed scoring runs:', runsResult);
        const updatedRuns = runsResult.data || [];
        console.log('Updated runs array:', updatedRuns);
        setScoringRuns(updatedRuns);
        
        // Expandir automáticamente el último run si existe
        if (result.run_row && result.run_row.run_id) {
          setExpandedResults((prev) => ({
            ...prev,
            [result.run_row.run_id]: true,
          }));
        }
      } else {
        console.error('Failed to refresh scoring runs:', runsRes.status, runsRes.statusText);
        const errorText = await runsRes.text();
        console.error('Error response:', errorText);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate scoring');
      console.error('Error generating scoring:', err);
    } finally {
      setGenerating(false);
    }
  };

  const toggleResult = (runId: string) => {
    setExpandedResults((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }));
  };

  const formatJSON = (json: any): string => {
    try {
      return JSON.stringify(json, null, 2);
    } catch {
      return String(json);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-textured">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-4"></div>
            <p className="text-zinc-400">Cargando scoring...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-textured">
      <Header backUrl={`/rfp/${rfpId}`} backLabel="Volver a RFP" />
      <main className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white mb-2">
            Scoring
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono">
            RFP ID: {rfpId}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-300">Error: {error}</p>
          </div>
        )}

        {/* Scoring Weights Section */}
        {weightsVersions.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              Versiones de Pesos
            </h2>
            <div className="space-y-4">
              {weightsVersions.map((version) => (
                <div
                  key={version.weights_version_id}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 shadow-lg"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-mono text-zinc-500 mb-2">
                        Version ID: {version.weights_version_id.substring(0, 8)}...
                      </p>
                      <p className="text-xs text-zinc-500">
                        Creado: {formatDate(version.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs text-zinc-300 font-mono">
                      {formatJSON(version.weights_json)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Scoring Runs Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white">
              Ejecuciones de Scoring
            </h2>
            <button
              onClick={handleGenerateScoring}
              disabled={generating}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-green-400 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generar scoring
                </>
              )}
            </button>
          </div>

          {scoringRuns.length === 0 ? (
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 text-center">
              <p className="text-zinc-400">No hay ejecuciones de scoring disponibles</p>
              <p className="text-xs text-zinc-500 mt-2">
                Haz clic en "Generar scoring" para crear la primera ejecución
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {scoringRuns.map((run, index) => (
                <div
                  key={run.run_id}
                  className={`bg-zinc-800 border rounded-lg overflow-hidden transition-all shadow-lg ${
                    index === 0
                      ? 'border-green-500/50 shadow-xl'
                      : 'border-zinc-700'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-mono text-zinc-500">
                          Run ID: {run.run_id.substring(0, 8)}...
                        </p>
                        {index === 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-900/30 text-green-400 rounded">
                            Más reciente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        Creado: {formatDate(run.created_at)}
                      </p>
                      {run.weights_version_id && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Weights Version: {run.weights_version_id.substring(0, 8)}...
                        </p>
                      )}
                      {run.results_json && (
                        <p className="text-xs text-green-400 mt-1 font-medium">
                          ✓ Resultados disponibles
                        </p>
                      )}
                      </div>
                      <button
                        onClick={() => toggleResult(run.run_id)}
                        className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-md transition-colors flex items-center gap-2"
                      >
                        {expandedResults[run.run_id] ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Ocultar
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            Ver resultados
                          </>
                        )}
                      </button>
                    </div>

                    {expandedResults[run.run_id] && run.results_json && (
                      <div className="mt-4 border-t border-zinc-700 pt-4 animate-in fade-in slide-in-from-top duration-200">
                        <h3 className="text-sm font-semibold mb-3 text-zinc-300">
                          Resultados JSON
                        </h3>
                        <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
                            {formatJSON(run.results_json)}
                          </pre>
                        </div>
                      </div>
                    )}
                    {expandedResults[run.run_id] && !run.results_json && (
                      <div className="mt-4 border-t border-zinc-700 pt-4">
                        <p className="text-sm text-zinc-500 italic">
                          No hay resultados disponibles para esta ejecución
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

