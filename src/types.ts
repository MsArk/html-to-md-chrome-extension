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
  outputFiles: {
    json: string;
    html: string;
    md: string;
  };
  timingsMs: Timings;
}

export type Status = 'idle' | 'loading' | 'success' | 'error';
