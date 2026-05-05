import { useState, useCallback } from 'react';
import {
  AnalyzeClientError,
  AnalyzeQueuedResponse,
  AnalyzeResponse,
  BackendErrorResponse,
  Status,
} from './types';
import { I18nKey, t } from './chromeI18n';

const DEFAULT_SERVER_URL = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 30_000;

const BACKEND_ERROR_KEYS: Record<string, I18nKey> = {
  INVALID_URL: 'backendErrorInvalidUrl',
  FETCH_FAILED: 'backendErrorFetchFailed',
  FETCH_TIMEOUT: 'backendErrorFetchTimeout',
  INVALID_CONTENT_TYPE: 'backendErrorInvalidContentType',
  BODY_TOO_LARGE: 'backendErrorBodyTooLarge',
  INVALID_SELECTOR: 'backendErrorInvalidSelector',
  SELECTOR_NOT_FOUND: 'backendErrorSelectorNotFound',
  URL_RATE_LIMITED: 'backendErrorUrlRateLimited',
  TOO_MANY_REQUESTS: 'backendErrorTooManyRequests',
  INVALID_JSON: 'backendErrorInvalidJson',
  MISSING_FIELD: 'backendErrorMissingField',
  SERVER_ERROR: 'backendErrorServerError',
  INTERNAL_SERVER_ERROR: 'backendErrorInternalServerError',
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

function getRateLimitMessage(retryAfterSeconds?: number): string {
  return retryAfterSeconds
    ? t('rateLimitRetry', String(retryAfterSeconds))
    : t('rateLimitGeneric');
}

function getServerStatusMessage(status: number): string {
  return t('serverErrorStatus', String(status));
}

async function parseHttpError(response: Response): Promise<AnalyzeClientError> {
  const body = await response.json().catch(() => null);
  if (isBackendErrorResponse(body) && body.error && typeof body.error.code === 'string') {
    const code = body.error.code;
    const details = body.error.details;
    const retryAfterSeconds = response.status === 429
      ? getRetryAfterSeconds(response, details)
      : undefined;
    const mappedKey = BACKEND_ERROR_KEYS[code];
    const mappedMessage = mappedKey ? t(mappedKey) : body.error.message;
    const message = retryAfterSeconds
      ? `${mappedMessage} ${t('retryInSuffix', String(retryAfterSeconds))}`
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
    ? getRateLimitMessage(retryAfterSeconds)
    : getServerStatusMessage(response.status);
  return { message: fallbackMessage, retryAfterSeconds };
}

function getInitialServerUrl(): string {
  const envUrl = import.meta.env.VITE_ANALYZE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }
  return DEFAULT_SERVER_URL;
}

export function useAnalyze() {
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
        throw new Error(t('errorActiveTabInvalidUrl'));
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
        throw new Error(t('errorQueuedInvalidPayload'));
      }

      if (!response.ok) {
        const parsedError = await parseHttpError(response);
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
          : t('errorUnknownServer');
      setError({ message });
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [apiBaseUrl, isSubmitting]);

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
