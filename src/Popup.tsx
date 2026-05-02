import React, { useState } from 'react';
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
  Server,
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
  const { status, data, error, currentUrl, analyze, reset } = useAnalyze();
  const [copied, setCopied] = useState(false);

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

      {/* ── IDLE ── */}
      {status === 'idle' && (
        <div className="idle-view">
          <p className="idle-desc">
            Analiza la pestaña activa: convierte su HTML a Markdown y cuenta tokens GPT-4.
          </p>
          <button className="btn-primary" onClick={() => analyze()}>
            <Zap size={16} />
            Analizar esta página
          </button>
          <div className="server-hint">
            <Server size={12} />
            <span>Requiere servidor en <code>localhost:3000</code></span>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {status === 'loading' && (
        <div className="loading-view">
          <Loader2 size={32} className="spin" />
          <p>Analizando…</p>
          {currentUrl && <span className="url-chip">{new URL(currentUrl).hostname}</span>}
        </div>
      )}

      {/* ── ERROR ── */}
      {status === 'error' && (
        <div className="error-view">
          <AlertCircle size={32} />
          <p>{error}</p>
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
            <span title={data.url}>{new URL(data.url).hostname}</span>
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
        <button
          type="button"
          className="popup-doc-link"
          onClick={() => openExtensionHtml('preview.html')}
        >
          <ExternalLink size={12} aria-hidden />
          Información de la extensión
        </button>
      </footer>
    </div>
  );
}
