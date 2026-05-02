import { useState, useCallback } from 'react';
import { AnalyzeResponse, Status } from './types';

const SERVER_URL = 'http://localhost:3000';

export function useAnalyze() {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  const analyze = useCallback(async (url?: string) => {
    setStatus('loading');
    setData(null);
    setError(null);

    try {
      // If no URL provided, get active tab URL
      let targetUrl = url;
      if (!targetUrl) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetUrl = tab?.url ?? '';
      }

      if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        throw new Error('La pestaña activa no tiene una URL HTTP/HTTPS válida.');
      }

      setCurrentUrl(targetUrl);

      const response = await fetch(
        `${SERVER_URL}/analyze?url=${encodeURIComponent(targetUrl)}`,
        { signal: AbortSignal.timeout(30000) }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Error del servidor: ${response.status}`);
      }

      const json: AnalyzeResponse = await response.json();
      setData(json);
      setStatus('success');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error desconocido. Comprueba que el servidor está corriendo.';
      setError(message);
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
    setCurrentUrl('');
  }, []);

  return { status, data, error, currentUrl, analyze, reset };
}
