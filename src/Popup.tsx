import React, { useEffect, useState } from 'react';
import {
  FileCode2,
  FileText,
  Zap,
  Copy,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { useAnalyze } from './useAnalyze';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  return n.toLocaleString('es-ES');
}

function reductionPercent(htmlTokens: number, mdTokens: number): string {
  if (htmlTokens === 0) return '0%';
  return (((htmlTokens - mdTokens) / htmlTokens) * 100).toFixed(1) + '%';
}

function downloadBlob(content: string, filename: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/\./g, '_');
  } catch {
    return 'page';
  }
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function openExtensionHtml(path: string) {
  const url = chrome.runtime.getURL(path);
  chrome.tabs.create({ url });
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  tokens,
  chars,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  tokens: number;
  chars: number;
  accent: string;
}) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-header">
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-tokens">{formatNum(tokens)} <span>tokens</span></div>
      <div className="stat-chars">{formatNum(chars)} chars</div>
    </div>
  );
}

function ReductionBadge({ reduction }: { reduction: string }) {
  return (
    <div className="reduction-badge">
      <Zap size={14} />
      <span>Reducción: <strong>{reduction}</strong></span>
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = expanded ? content : content.slice(0, 600) + (content.length > 600 ? '\n...' : '');

  return (
    <div className="md-preview">
      <div className="md-preview-header">
        <span>Vista previa Markdown</span>
        <button className="btn-icon" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <pre className="md-content">{preview}</pre>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Popup() {
  const {
    status,
    data,
    queued,
    error,
    currentUrl,
    serverUrl,
    isSubmitting,
    analyze,
    reset,
    updateServerUrl,
  } = useAnalyze();
  const [copied, setCopied] = useState(false);
  const [selector, setSelector] = useState('');
  const [cleanEnabled, setCleanEnabled] = useState(false);
  const [serverUrlDraft, setServerUrlDraft] = useState(serverUrl);
  const [serverFeedback, setServerFeedback] = useState<string | null>(null);

  useEffect(() => {
    setServerUrlDraft(serverUrl);
  }, [serverUrl]);

  async function handleCopy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.markdown.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!data) return;
    const filename = `${slugFromUrl(data.url)}_${Date.now()}.md`;
    downloadBlob(data.markdown.content, filename);
  }

  async function handleAnalyze() {
    await analyze({ selector, clean: cleanEnabled });
  }

  async function handleSaveServerUrl() {
    try {
      await updateServerUrl(serverUrlDraft);
      setServerFeedback('URL guardada.');
      setTimeout(() => setServerFeedback(null), 2500);
    } catch (err: unknown) {
      setServerFeedback(err instanceof Error ? err.message : 'No se pudo guardar la URL.');
    }
  }

  function openApiDocs() {
    const docsUrl = `${serverUrl.replace(/\/$/, '')}/docs`;
    chrome.tabs.create({ url: docsUrl });
  }

  return (
    <div className="popup">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-icon">
          <FileCode2 size={20} />
        </div>
        <div>
          <h1>HTML → Markdown</h1>
          <p>Token Analyzer</p>
        </div>
      </header>

      <section className="config-card">
        <label className="field-label" htmlFor="server-url">Servidor API</label>
        <div className="field-row">
          <input
            id="server-url"
            className="field-input"
            value={serverUrlDraft}
            onChange={(event) => setServerUrlDraft(event.target.value)}
            placeholder="http://localhost:3000"
            disabled={isSubmitting}
          />
          <button
            className="btn-secondary"
            onClick={handleSaveServerUrl}
            disabled={isSubmitting || serverUrlDraft.trim() === serverUrl}
          >
            Guardar
          </button>
        </div>
        <label className="field-label" htmlFor="selector">Selector CSS (opcional)</label>
        <input
          id="selector"
          className="field-input"
          value={selector}
          onChange={(event) => setSelector(event.target.value)}
          placeholder="main, article, #contenido"
          disabled={isSubmitting}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={cleanEnabled}
            onChange={(event) => setCleanEnabled(event.target.checked)}
            disabled={isSubmitting}
          />
          <span>Aplicar limpieza `clean=standard`</span>
        </label>
        {serverFeedback && <p className="config-feedback">{serverFeedback}</p>}
      </section>

      {/* ── IDLE ── */}
      {status === 'idle' && (
        <div className="idle-view">
          <p className="idle-desc">
            Analiza la pestaña activa: convierte su HTML a Markdown y cuenta tokens para la IA.
          </p>
          <button className="btn-primary" onClick={handleAnalyze} disabled={isSubmitting}>
            <Zap size={16} />
            {isSubmitting ? 'Analizando...' : 'Analizar esta pagina'}
          </button>
        </div>
      )}

      {/* ── LOADING ── */}
      {status === 'loading' && (
        <div className="loading-view">
          <Loader2 size={32} className="spin" />
          <p>Analizando…</p>
          {currentUrl && <span className="url-chip">{hostnameFromUrl(currentUrl)}</span>}
        </div>
      )}

      {status === 'queued' && queued && (
        <div className="error-view queued-view">
          <Loader2 size={24} className="spin" />
          <p>Solicitud encolada. El backend la procesa en segundo plano.</p>
          <p className="error-meta">URL: {hostnameFromUrl(queued.url)}</p>
          <button className="btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> Nueva consulta
          </button>
        </div>
      )}

      {/* ── ERROR ── */}
      {status === 'error' && (
        <div className="error-view">
          <AlertCircle size={32} />
          <p>{error?.message ?? 'Error desconocido'}</p>
          {error?.code && <p className="error-meta">Codigo: {error.code}</p>}
          <button className="btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> Reintentar
          </button>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {status === 'success' && data && (
        <div className="result-view">
          {/* URL */}
          <div className="result-url">
            <CheckCircle2 size={14} />
            <span title={data.url}>{hostnameFromUrl(data.url)}</span>
            {data.cached && <span className="cache-badge">Cache</span>}
            <span className="timing">{data.timingsMs.total}ms</span>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <StatCard
              icon={<FileCode2 size={16} />}
              label="HTML"
              tokens={data.html.tokens}
              chars={data.html.characters}
              accent="accent-html"
            />
            <StatCard
              icon={<FileText size={16} />}
              label="Markdown"
              tokens={data.markdown.tokens}
              chars={data.markdown.characters}
              accent="accent-md"
            />
          </div>

          <ReductionBadge
            reduction={reductionPercent(data.html.tokens, data.markdown.tokens)}
          />

          {/* Actions */}
          <div className="actions">
            <button className="btn-action" onClick={handleCopy}>
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? '¡Copiado!' : 'Copiar Markdown'}
            </button>
            <button className="btn-action" onClick={handleDownload}>
              <Download size={14} />
              Descargar .md
            </button>
          </div>

          {/* Markdown Preview */}
          <MarkdownPreview content={data.markdown.content} />

          {/* Reset */}
          <button className="btn-ghost" onClick={reset}>
            <RotateCcw size={12} /> Nueva consulta
          </button>
        </div>
      )}

      <footer className="popup-footer">
        <button type="button" className="popup-doc-link" onClick={() => openExtensionHtml('preview.html')}>
          <ExternalLink size={12} aria-hidden />
          Informacion de la extension
        </button>
        <button type="button" className="popup-doc-link" onClick={openApiDocs}>
          <ExternalLink size={12} aria-hidden />
          Docs API
        </button>
      </footer>
    </div>
  );
}
