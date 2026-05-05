export interface Stats {
  tokens: number;
  characters: number;
  content: string;
}

export interface Timings {
  fetch: number;
  convert: number;
  tokenize: number;
  total: number;
}

export interface AnalyzeResponse {
  url: string;
  html: Stats;
  markdown: Stats;
  timingsMs: Timings;
  cached?: boolean;
}

export interface BackendError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface BackendErrorResponse {
  error: BackendError;
}

export interface AnalyzeQueuedResponse {
  queued: true;
  url: string;
  jobId?: string;
  pollAfterMs?: number;
}

export interface AnalyzeClientError {
  message: string;
  code?: string;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
}

export type Status = 'idle' | 'loading' | 'queued' | 'success' | 'error';
