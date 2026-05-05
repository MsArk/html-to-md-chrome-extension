import { useState, useCallback } from 'react';
import {
  AnalyzeClientError,
  AnalyzeQueuedResponse,
  AnalyzeResponse,
  BackendErrorResponse,
  Status,
} from './types';
import { DEFAULT_LANGUAGE, Language } from './i18n';

const DEFAULT_SERVER_URL = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 30_000;

const ERROR_MESSAGES: Record<Language, Record<string, string>> = {
  en: {
    INVALID_URL: 'The URL is not valid. Use an http or https address.',
    FETCH_FAILED: 'Could not download the target page.',
    FETCH_TIMEOUT: 'The server took too long to download the page.',
    INVALID_CONTENT_TYPE: 'The URL did not return compatible HTML for analysis.',
    BODY_TOO_LARGE: 'The page is too large to process.',
    INVALID_SELECTOR: 'The CSS selector is invalid.',
    SELECTOR_NOT_FOUND: 'The selector did not match any elements on the page.',
    URL_RATE_LIMITED: 'Too many requests for this URL. Wait before retrying.',
    TOO_MANY_REQUESTS: 'Too many requests from your IP. Wait before retrying.',
    INVALID_JSON: 'The server received invalid JSON.',
    MISSING_FIELD: 'A required field is missing in the request.',
    SERVER_ERROR: 'Internal server error. Try again in a few seconds.',
    INTERNAL_SERVER_ERROR: 'Internal server error. Try again in a few seconds.',
  },
  es: {
    INVALID_URL: 'La URL no es valida. Usa una direccion http o https.',
    FETCH_FAILED: 'No se pudo descargar la pagina objetivo.',
    FETCH_TIMEOUT: 'El servidor tardo demasiado en descargar la pagina.',
    INVALID_CONTENT_TYPE: 'La URL no devolvio HTML compatible para analizar.',
    BODY_TOO_LARGE: 'La pagina es demasiado grande para procesarla.',
    INVALID_SELECTOR: 'El selector CSS es invalido.',
    SELECTOR_NOT_FOUND: 'El selector no encontro elementos en la pagina.',
    URL_RATE_LIMITED: 'Demasiadas solicitudes para esta URL. Espera antes de reintentar.',
    TOO_MANY_REQUESTS: 'Demasiadas solicitudes desde tu IP. Espera antes de reintentar.',
    INVALID_JSON: 'El servidor recibio JSON invalido.',
    MISSING_FIELD: 'Falta un campo requerido en la solicitud.',
    SERVER_ERROR: 'Error interno del servidor. Intenta de nuevo en unos segundos.',
    INTERNAL_SERVER_ERROR: 'Error interno del servidor. Intenta de nuevo en unos segundos.',
  },
};

interface AnalyzeOptions {
  url?: string;
  selector?: string;
  clean?: boolean;
}

function isQueuedResponse(value: unknown): value is AnalyzeQueuedResponse {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as AnalyzeQueuedResponse).queued === true &&
    typeof (value as AnalyzeQueuedResponse).url === 'string'
  );
}

function isBackendErrorResponse(value: unknown): value is BackendErrorResponse {
  return value !== null && typeof value === 'object' && 'error' in value;
}

function getRetryAfterSeconds(response: Response, details?: Record<string, unknown>): number | undefined {
  const fromDetails = details?.retryAfter;
  if (typeof fromDetails === 'number' && Number.isFinite(fromDetails)) {
    return fromDetails > 0 ? Math.ceil(fromDetails) : undefined;
  }
  if (typeof fromDetails === 'string') {
    const parsed = Number.parseFloat(fromDetails);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed);
    }
  }

  const retryAfterHeader = response.headers.get('retry-after');
  if (!retryAfterHeader) {
    return undefined;
  }
  const retryAfterNumber = Number.parseFloat(retryAfterHeader);
  if (Number.isFinite(retryAfterNumber) && retryAfterNumber > 0) {
    return Math.ceil(retryAfterNumber);
  }
  return undefined;
}

function getRateLimitMessage(language: Language, retryAfterSeconds?: number): string {
  if (language === 'es') {
    return retryAfterSeconds
      ? `Demasiadas solicitudes. Reintenta en ${retryAfterSeconds}s.`
      : 'Demasiadas solicitudes. Espera antes de reintentar.';
  }

  return retryAfterSeconds
    ? `Too many requests. Retry in ${retryAfterSeconds}s.`
    : 'Too many requests. Wait before retrying.';
}

function getServerStatusMessage(language: Language, status: number): string {
  if (language === 'es') {
    return `Error del servidor: ${status}`;
  }
  return `Server error: ${status}`;
}

async function parseHttpError(response: Response, language: Language): Promise<AnalyzeClientError> {
  const body = await response.json().catch(() => null);
  if (isBackendErrorResponse(body) && body.error && typeof body.error.code === 'string') {
    const code = body.error.code;
    const details = body.error.details;
    const retryAfterSeconds = response.status === 429
      ? getRetryAfterSeconds(response, details)
      : undefined;
    const mappedMessage = ERROR_MESSAGES[language][code] ?? body.error.message;
    const message = retryAfterSeconds
      ? language === 'es'
        ? `${mappedMessage} Reintenta en ${retryAfterSeconds}s.`
        : `${mappedMessage} Retry in ${retryAfterSeconds}s.`
      : mappedMessage;
    return {
      code,
      details,
      retryAfterSeconds,
      message,
    };
  }

  const retryAfterSeconds = response.status === 429 ? getRetryAfterSeconds(response) : undefined;
  const fallbackMessage = response.status === 429
    ? getRateLimitMessage(language, retryAfterSeconds)
    : getServerStatusMessage(language, response.status);
  return { message: fallbackMessage, retryAfterSeconds };
}

function getInitialServerUrl(): string {
  const envUrl = import.meta.env.VITE_ANALYZE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }
  return DEFAULT_SERVER_URL;
}

export function useAnalyze(language: Language = DEFAULT_LANGUAGE) {
  const apiBaseUrl = getInitialServerUrl();
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [queued, setQueued] = useState<AnalyzeQueuedResponse | null>(null);
  const [error, setError] = useState<AnalyzeClientError | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const analyze = useCallback(async (options?: AnalyzeOptions) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus('loading');
    setData(null);
    setQueued(null);
    setError(null);

    try {
      // If no URL provided, get active tab URL
      let targetUrl = options?.url;
      if (!targetUrl) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetUrl = tab?.url ?? '';
      }

      if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        throw new Error(
          language === 'es'
            ? 'La pestana activa no tiene una URL HTTP/HTTPS valida.'
            : 'The active tab does not have a valid HTTP/HTTPS URL.'
        );
      }

      setCurrentUrl(targetUrl);

      const query = new URLSearchParams({
        url: targetUrl,
      });

      const selector = options?.selector?.trim();
      if (selector) {
        query.set('selector', selector);
      }

      if (typeof options?.clean === 'boolean') {
        query.set('clean', options.clean ? 'standard' : 'minimal');
      }

      const response = await fetch(
        `${apiBaseUrl}/analyze?${query.toString()}`,
        { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
      );

      if (response.status === 202) {
        const body = await response.json().catch(() => null);
        if (isQueuedResponse(body)) {
          setQueued(body);
          setStatus('queued');
          return;
        }
        throw new Error(
          language === 'es'
            ? 'El servidor respondio 202 pero sin formato valido.'
            : 'The server responded 202 without a valid payload.'
        );
      }

      if (!response.ok) {
        const parsedError = await parseHttpError(response, language);
        setError(parsedError);
        setStatus('error');
        return;
      }

      const json: AnalyzeResponse = await response.json();
      setData(json);
      setStatus('success');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : language === 'es'
            ? 'Error desconocido. Comprueba que el servidor esta corriendo.'
            : 'Unknown error. Check that the server is running.';
      setError({ message });
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [apiBaseUrl, isSubmitting, language]);

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setQueued(null);
    setError(null);
    setCurrentUrl('');
  }, []);

  return {
    status,
    data,
    queued,
    error,
    currentUrl,
    isSubmitting,
    analyze,
    reset,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
  };
}
