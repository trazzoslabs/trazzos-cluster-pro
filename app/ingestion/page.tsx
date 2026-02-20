'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';
import StatusBadge from '../components/ui/StatusBadge';
import CopyButton from '../components/ui/CopyButton';

interface SessionResponse {
  [key: string]: any;
}

interface IngestionJob {
  job_id: string;
  status: string | null;
  started_at: string | null;
}

export default function IngestionPage() {
  // IDs fijos según requerimiento
  const FIXED_COMPANY_ID = 'aaaa1111-1111-4111-a111-111111111111'; // Reficar
  const FIXED_USER_ID = 'bff82884-0263-4bc1-8895-3567c2c02b55';

  // Form inputs
  const [datasetType, setDatasetType] = useState<string>('shutdowns');
  const [companyId, setCompanyId] = useState<string>(FIXED_COMPANY_ID);
  const [userId, setUserId] = useState<string>(FIXED_USER_ID);
  const [userEmail, setUserEmail] = useState<string>('');
  const [appUrl, setAppUrl] = useState<string>('http://localhost:3000');
  const [file, setFile] = useState<File | null>(null);
  
  // Error global para mostrar en alerta roja
  const [globalError, setGlobalError] = useState<string | null>(null);

  // User profile loading state
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Step 1 - Session
  const [sessionResponse, setSessionResponse] = useState<SessionResponse | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [errorSession, setErrorSession] = useState<string | null>(null);
  const [successSession, setSuccessSession] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // Step 2 - Upload
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<number | null>(null);
  const [errorUpload, setErrorUpload] = useState<string | null>(null);
  const [successUpload, setSuccessUpload] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Step 3 - Confirm
  const [confirmResponse, setConfirmResponse] = useState<any>(null);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [errorConfirm, setErrorConfirm] = useState<string | null>(null);
  const [successConfirm, setSuccessConfirm] = useState(false);

  // Recent Jobs
  const [recentJobs, setRecentJobs] = useState<IngestionJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Load user profile on mount
  useEffect(() => {
    fetchUserProfile();
    fetchRecentJobs();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoadingProfile(true);
      setProfileError(null);

      const response = await fetch('/api/auth/profile');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to fetch profile: ${response.statusText}`);
      }

      const result = await response.json();
      const profile = result.data;

      if (profile) {
        // Mantener los IDs fijos, solo actualizar email
        setUserEmail(profile.email || '');
        // Los IDs se mantienen en los valores fijos
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user profile';
      setProfileError(errorMessage);
      console.error('Error fetching user profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchRecentJobs = async () => {
    try {
      setLoadingJobs(true);
      const response = await fetch('/api/data/ingestion-jobs');
      if (response.ok) {
        const result = await response.json();
        const jobs = (result.data || []).slice(0, 10);
        setRecentJobs(jobs);
      }
    } catch (err) {
      console.error('Error fetching recent jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Extract signedUrl from response
  const extractSignedUrl = (response: SessionResponse): string | null => {
    const possibleKeys = ['signed_url', 'signedUrl', 'url', 'upload_url', 'signedUploadUrl'];
    for (const key of possibleKeys) {
      if (response[key]) {
        return response[key];
      }
    }
    return null;
  };

  // Extract IDs from response
  const extractIds = (response: SessionResponse) => {
    const jobIdKeys = ['job_id', 'jobId', 'jobId'];
    const uploadIdKeys = ['upload_id', 'uploadId', 'uploadId'];
    const correlationIdKeys = ['correlation_id', 'correlationId', 'correlationId'];
    const hashKeys = ['hash', 'payload_hash', 'payload_hash_sha256'];

    return {
      jobId: findNestedValue(response, jobIdKeys),
      uploadId: findNestedValue(response, uploadIdKeys),
      correlationId: findNestedValue(response, correlationIdKeys),
      hash: findNestedValue(response, hashKeys),
    };
  };

  const findNestedValue = (obj: any, keys: string[]): string | null => {
    for (const key of keys) {
      if (obj[key]) return obj[key];
      // Buscar en objetos anidados
      for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          const found = findNestedValue(obj[k], [key]);
          if (found) return found;
        }
      }
    }
    return null;
  };

  // Step 1: Create session
  const handleCreateSession = async () => {
    console.log('[handleCreateSession] Iniciando creación de sesión...');
    setGlobalError(null);
    
    if (!file) {
      const errorMsg = 'Por favor selecciona un archivo';
      console.error('[handleCreateSession] Error:', errorMsg);
      setErrorSession(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    console.log('[handleCreateSession] Archivo seleccionado:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Validar tipo de archivo
    const validExtensions = ['.csv', '.json', '.jsonl', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      const errorMsg = `Tipo de archivo no soportado. Use: ${validExtensions.join(', ')}`;
      console.error('[handleCreateSession] Error:', errorMsg);
      setErrorSession(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    // Usar IDs fijos siempre
    const finalCompanyId = FIXED_COMPANY_ID;
    const finalUserId = FIXED_USER_ID;

    console.log('[handleCreateSession] IDs a usar:', {
      company_id: finalCompanyId,
      user_id: finalUserId,
    });

    try {
      setLoadingSession(true);
      setErrorSession(null);
      setSuccessSession(false);

      const payload = {
        company_id: finalCompanyId,
        user_id: finalUserId,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        dataset_type: datasetType,
      };

      console.log('[handleCreateSession] Enviando request a /api/workflows/upload-session:', payload);

      const response = await fetch('/api/workflows/upload-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[handleCreateSession] Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const errorMsg = errorData.error || errorData.message || `Failed to create session: ${response.statusText}`;
        console.error('[handleCreateSession] Error en respuesta:', errorMsg);
        throw new Error(errorMsg);
      }

      const result = await response.json();
      const data = result.data || result;
      
      console.log('[handleCreateSession] Datos recibidos:', data);
      
      setSessionResponse(data);
      setSuccessSession(true);
      
      const ids = extractIds(data);
      if (ids.jobId) {
        setJobId(ids.jobId);
        console.log('[handleCreateSession] Job ID extraído:', ids.jobId);
      }
      
      const url = extractSignedUrl(data);
      if (url) {
        setSignedUrl(url);
        console.log('[handleCreateSession] Signed URL obtenida');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      console.error('[handleCreateSession] Error capturado:', err);
      setErrorSession(errorMessage);
      setGlobalError(errorMessage);
      setSuccessSession(false);
    } finally {
      setLoadingSession(false);
      console.log('[handleCreateSession] Finalizado, loadingSession:', false);
    }
  };

  // Step 2: Upload file
  const handleUploadFile = async () => {
    console.log('[handleUploadFile] Iniciando subida de archivo...');
    setGlobalError(null);
    
    if (!file) {
      const errorMsg = 'Archivo es requerido';
      console.error('[handleUploadFile] Error:', errorMsg);
      setErrorUpload(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    if (!signedUrl) {
      const errorMsg = 'Falta signed_url. Por favor crea una sesión primero.';
      console.error('[handleUploadFile] Error:', errorMsg);
      setErrorUpload(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    console.log('[handleUploadFile] Subiendo archivo:', {
      name: file.name,
      size: file.size,
      type: file.type,
      signedUrl: signedUrl.substring(0, 50) + '...',
    });

    try {
      setUploading(true);
      setErrorUpload(null);
      setSuccessUpload(false);

      // Usar FormData para soportar diferentes tipos de archivo
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      console.log('[handleUploadFile] Respuesta de subida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      setUploadStatus(response.status);

      if (response.status === 200 || response.status === 201 || response.status === 204) {
        console.log('[handleUploadFile] Archivo subido exitosamente');
        setSuccessUpload(true);
      } else {
        const errorText = await response.text().catch(() => '');
        const errorMsg = `Upload failed with status ${response.status}: ${errorText || 'Unknown error'}`;
        console.error('[handleUploadFile] Error en subida:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
      console.error('[handleUploadFile] Error capturado:', err);
      setErrorUpload(errorMessage);
      setGlobalError(errorMessage);
      setSuccessUpload(false);
    } finally {
      setUploading(false);
      console.log('[handleUploadFile] Finalizado, uploading:', false);
    }
  };

  // Step 3: Confirm
  const handleConfirm = async () => {
    console.log('[handleConfirm] Iniciando confirmación...');
    setGlobalError(null);
    
    if (!sessionResponse) {
      const errorMsg = 'Sesión no encontrada. Por favor crea una sesión primero.';
      console.error('[handleConfirm] Error:', errorMsg);
      setErrorConfirm(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    if (!successUpload) {
      const errorMsg = 'Por favor sube el archivo primero antes de confirmar.';
      console.error('[handleConfirm] Error:', errorMsg);
      setErrorConfirm(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    const ids = extractIds(sessionResponse);
    if (!ids.uploadId) {
      const errorMsg = 'Falta upload_id en respuesta de sesión.';
      console.error('[handleConfirm] Error:', errorMsg);
      setErrorConfirm(errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    console.log('[handleConfirm] IDs extraídos:', ids);

    try {
      setLoadingConfirm(true);
      setErrorConfirm(null);
      setSuccessConfirm(false);

      const payload = {
        upload_id: ids.uploadId,
        user_email: userEmail.trim() || 'user@example.com', // Fallback si no hay email
        app_url: appUrl.trim() || undefined,
      };

      console.log('[handleConfirm] Enviando request a /api/workflows/upload-confirm:', payload);

      const response = await fetch('/api/workflows/upload-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[handleConfirm] Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const errorMsg = errorData.error || errorData.message || `Failed to confirm: ${response.statusText}`;
        console.error('[handleConfirm] Error en respuesta:', errorMsg);
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log('[handleConfirm] Datos recibidos:', result);
      
      setConfirmResponse(result.data || result);
      setSuccessConfirm(true);
      
      // Refresh jobs list
      fetchRecentJobs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm';
      console.error('[handleConfirm] Error capturado:', err);
      setErrorConfirm(errorMessage);
      setGlobalError(errorMessage);
      setSuccessConfirm(false);
    } finally {
      setLoadingConfirm(false);
      console.log('[handleConfirm] Finalizado, loadingConfirm:', false);
    }
  };

  // Función unificada para manejar el submit del formulario
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[handleUpload] Formulario enviado');
    setGlobalError(null);
    
    // Validar archivo primero
    if (!file) {
      const errorMsg = 'Por favor selecciona un archivo';
      console.error('[handleUpload] Error:', errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    // Validar tipo de archivo
    const validExtensions = ['.csv', '.json', '.jsonl', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      const errorMsg = `Tipo de archivo no soportado. Use: ${validExtensions.join(', ')}`;
      console.error('[handleUpload] Error:', errorMsg);
      setGlobalError(errorMsg);
      return;
    }

    // Flujo: Si no hay sesión, crear una. Si hay sesión pero no se subió, subir. Si ya se subió, confirmar.
    if (!successSession) {
      await handleCreateSession();
    } else if (!successUpload && signedUrl) {
      await handleUploadFile();
    } else if (successUpload) {
      await handleConfirm();
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

  return (
    <div>
      <PageTitle
        title="Cargas de Datos"
        subtitle="Sube y procesa archivos para análisis y normalización"
      />

      {/* A. Subir archivo */}
      <SectionCard
        title="Subir archivo"
        description="Inicia una nueva carga de datos al sistema"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Tipo de Dataset <span className="text-red-400">*</span>
            </label>
            <select
              value={datasetType}
              onChange={(e) => setDatasetType(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            >
              <option value="shutdowns">shutdowns</option>
              <option value="needs">needs</option>
              <option value="suppliers">suppliers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Archivo <span className="text-red-400">*</span>
            </label>
            <input
              type="file"
              accept=".csv,.json,.jsonl,.xlsx"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] || null;
                setFile(selectedFile);
                if (selectedFile) {
                  console.log('[File Input] Archivo seleccionado:', {
                    name: selectedFile.name,
                    size: selectedFile.size,
                    type: selectedFile.type,
                  });
                }
              }}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9aff8d]"
            />
            {file && (
              <p className="mt-2 text-xs text-zinc-500">
                Seleccionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Company ID (UUID) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={companyId}
              disabled
              readOnly
              placeholder="Reficar (fijo)"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-zinc-500">Valor fijo: Reficar</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              User ID (UUID) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={userId}
              disabled
              readOnly
              placeholder="Usuario fijo"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-zinc-500">Valor fijo asignado</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              User Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              readOnly
              placeholder={loadingProfile ? 'Cargando...' : 'user@example.com'}
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 cursor-not-allowed"
            />
            {userEmail && (
              <p className="mt-1 text-xs text-zinc-500">Obtenido automáticamente de tu perfil</p>
            )}
          </div>
        </div>

        {/* Alerta de error global (roja) */}
        {globalError && (
          <div className="bg-red-900/30 border-2 border-red-600 rounded-lg p-4 mb-4 animate-pulse">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-red-200 font-semibold text-sm mb-1">Error en la carga</p>
                <p className="text-red-300 text-sm">{globalError}</p>
              </div>
            </div>
          </div>
        )}

        {profileError && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-yellow-300 text-sm">
              ⚠️ Advertencia: {profileError}. Los campos se llenarán automáticamente cuando se resuelva.
            </p>
          </div>
        )}

        {errorSession && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">Error: {errorSession}</p>
          </div>
        )}

        {successSession && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 mb-4">
            <p className="text-green-300 text-sm">✓ Sesión creada exitosamente</p>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loadingSession || uploading || loadingConfirm || !file}
              className="px-6 py-3 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-700 disabled:text-zinc-400 text-[#232323] rounded-md transition-colors font-medium disabled:cursor-not-allowed"
            >
              {loadingSession ? 'Iniciando...' : uploading ? 'Subiendo...' : loadingConfirm ? 'Confirmando...' : successUpload ? 'Confirmar y procesar' : successSession ? 'Subir archivo' : 'Iniciar carga'}
            </button>

            {successSession && !successUpload && (
              <button
                type="button"
                onClick={handleUploadFile}
                disabled={uploading || loadingSession || loadingConfirm || !signedUrl || !file}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-white rounded-md transition-colors font-medium disabled:cursor-not-allowed"
              >
                {uploading ? 'Subiendo...' : 'Subir archivo'}
              </button>
            )}

            {successUpload && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loadingConfirm || loadingSession || uploading}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-white rounded-md transition-colors font-medium disabled:cursor-not-allowed"
              >
                {loadingConfirm ? 'Confirmando...' : 'Confirmar y procesar'}
              </button>
            )}
          </div>
        </form>

        {jobId && (
          <div className="mt-6 bg-zinc-900 border border-zinc-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Job ID:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm">{jobId}</span>
                <CopyButton textToCopy={jobId} />
              </div>
            </div>
            <Link
              href={`/ingestion/jobs/${jobId}`}
              className="mt-4 inline-block px-4 py-2 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors font-medium text-sm"
            >
              Ver estado del job
            </Link>
          </div>
        )}
      </SectionCard>

      {/* B. Jobs recientes */}
      <SectionCard
        title="Jobs recientes"
        description="Últimas cargas procesadas en el sistema"
      >
        {loadingJobs ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#9aff8d] mb-2"></div>
            <p className="text-zinc-400 text-sm">Cargando jobs...</p>
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-400">No hay jobs recientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Job ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Inicio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {recentJobs.map((job) => (
                  <tr key={job.job_id} className="hover:bg-zinc-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {job.job_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(job.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/ingestion/jobs/${job.job_id}`}
                        className="inline-block px-3 py-1.5 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-md transition-colors text-sm font-medium"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* C. Acceso directo a resolver mapeo */}
      <SectionCard
        title="Resolver mapeo"
        description="Jobs que requieren mapeo de columnas"
      >
        {loadingJobs ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#9aff8d] mb-2"></div>
            <p className="text-zinc-400 text-sm">Cargando...</p>
          </div>
        ) : (
          (() => {
            const awaitingMapping = recentJobs.filter(j => j.status?.toLowerCase() === 'awaiting_mapping');
            if (awaitingMapping.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-zinc-400">No hay jobs esperando mapeo</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {awaitingMapping.map((job) => (
                  <div key={job.job_id} className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Job ID: <span className="font-mono text-sm">{job.job_id.substring(0, 8)}...</span></p>
                      <p className="text-zinc-400 text-sm">Requiere mapeo de columnas</p>
                    </div>
                    <Link
                      href={`/ingestion/jobs/${job.job_id}`}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-md transition-colors font-medium text-sm"
                    >
                      Resolver mapeo
                    </Link>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </SectionCard>
    </div>
  );
}
