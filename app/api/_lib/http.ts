/**
 * HTTP helper con timeout y manejo de errores
 */

interface FetchOptions extends RequestInit {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 segundos

/**
 * Fetch con timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Helper para crear respuesta de error estandarizada
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  correlationId?: string
): Response {
  return Response.json(
    {
      error: message,
      ...(correlationId && { correlation_id: correlationId }),
    },
    { status }
  );
}

/**
 * Helper para crear respuesta de éxito estandarizada
 */
export function createSuccessResponse(
  data: any,
  status: number = 200,
  correlationId?: string
): Response {
  return Response.json(
    {
      data,
      ...(correlationId && { correlation_id: correlationId }),
    },
    { status }
  );
}







