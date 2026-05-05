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
import {
  DEFAULT_LANGUAGE,
  Language,
  loadPreferredLanguage,
  savePreferredLanguage,
} from './i18n';

function formatNum(n: number, locale: string): string {
  return n.toLocaleString(locale);
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

const POPUP_TEXT = {
  en: {
    title: 'HTML -> Markdown',
    subtitle: 'Token Analyzer',
    languageLabel: 'Language',
    selectorLabel: 'CSS selector (optional)',
    selectorPlaceholder: 'main, article, #content',
    cleanToggle: 'Apply clean=standard',
    idleDescription: 'Analyze the active tab: convert HTML to Markdown and estimate AI tokens.',
    analyzeAction: 'Analyze this page',
    analyzingAction: 'Analyzing...',
    loadingMessage: 'Analyzing...',
    queuedMessage: 'Request queued. The backend is processing it in the background.',
    queuedUrl: 'URL:',
    newQueryAction: 'New query',
    unknownError: 'Unknown error',
    errorCode: 'Code:',
    retryAction: 'Retry',
    tokensUnit: 'tokens',
    charsUnit: 'chars',
    reductionLabel: 'Reduction:',
    htmlLabel: 'HTML',
    markdownLabel: 'Markdown',
    timingUnit: 'ms',
    markdownPreview: 'Markdown preview',
    cachedBadge: 'Cached',
    copiedAction: 'Copied!',
    copyMarkdownAction: 'Copy Markdown',
    downloadAction: 'Download .md',
    extensionInfoAction: 'Extension information',
    languageEn: 'EN',
    languageEs: 'ES',
  },
  es: {
    title: 'HTML -> Markdown',
    subtitle: 'Analizador de Tokens',
    languageLabel: 'Idioma',
    selectorLabel: 'Selector CSS (opcional)',
    selectorPlaceholder: 'main, article, #contenido',
    cleanToggle: 'Aplicar clean=standard',
    idleDescription: 'Analiza la pestaña activa: convierte HTML a Markdown y estima tokens para IA.',
    analyzeAction: 'Analizar esta pagina',
    analyzingAction: 'Analizando...',
    loadingMessage: 'Analizando...',
    queuedMessage: 'Solicitud encolada. El backend la procesa en segundo plano.',
    queuedUrl: 'URL:',
    newQueryAction: 'Nueva consulta',
    unknownError: 'Error desconocido',
    errorCode: 'Codigo:',
    retryAction: 'Reintentar',
    tokensUnit: 'tokens',
    charsUnit: 'chars',
    reductionLabel: 'Reduccion:',
    htmlLabel: 'HTML',
    markdownLabel: 'Markdown',
    timingUnit: 'ms',
    markdownPreview: 'Vista previa Markdown',
    cachedBadge: 'Cache',
    copiedAction: 'Copiado!',
    copyMarkdownAction: 'Copiar Markdown',
    downloadAction: 'Descargar .md',
    extensionInfoAction: 'Informacion de la extension',
    languageEn: 'EN',
    languageEs: 'ES',
  },
} as const;

function StatCard({
  icon,
  label,
  tokens,
  chars,
  accent,
  locale,
  tokensUnit,
  charsUnit,
}: {
  icon: React.ReactNode;
  label: string;
  tokens: number;
  chars: number;
  accent: string;
  locale: string;
  tokensUnit: string;
  charsUnit: string;
}) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-header">
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-tokens">{formatNum(tokens, locale)} <span>{tokensUnit}</span></div>
      <div className="stat-chars">{formatNum(chars, locale)} {charsUnit}</div>
    </div>
  );
}

function ReductionBadge({ reduction, label }: { reduction: string; label: string }) {
  return (
    <div className="reduction-badge">
      <Zap size={14} />
      <span>{label} <strong>{reduction}</strong></span>
    </div>
  );
}

function MarkdownPreview({ content, title }: { content: string; title: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = expanded ? content : content.slice(0, 600) + (content.length > 600 ? '\n...' : '');

  return (
    <div className="md-preview">
      <div className="md-preview-header">
        <span>{title}</span>
        <button className="btn-icon" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <pre className="md-content">{preview}</pre>
    </div>
  );
}

export default function Popup() {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [copied, setCopied] = useState(false);
  const [selector, setSelector] = useState('');
  const [cleanEnabled, setCleanEnabled] = useState(false);

  const text = POPUP_TEXT[language];
  const locale = language === 'es' ? 'es-ES' : 'en-US';

  const {
    status,
    data,
    queued,
    error,
    currentUrl,
    isSubmitting,
    analyze,
    reset,
  } = useAnalyze(language);

  useEffect(() => {
    let isMounted = true;
    loadPreferredLanguage()
      .then((savedLanguage) => {
        if (isMounted) {
          setLanguage(savedLanguage);
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    await savePreferredLanguage(nextLanguage);
  }

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

  return (
    <div className="popup">
      <header className="header">
        <div className="header-icon">
          <FileCode2 size={20} />
        </div>
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </header>

      <section className="config-card">
        <label className="field-label" htmlFor="language">{text.languageLabel}</label>
        <select
          id="language"
          className="field-input"
          value={language}
          onChange={(event) => {
            void handleLanguageChange(event.target.value === 'es' ? 'es' : 'en');
          }}
          disabled={isSubmitting}
        >
          <option value="en">{text.languageEn}</option>
          <option value="es">{text.languageEs}</option>
        </select>

        <label className="field-label" htmlFor="selector">{text.selectorLabel}</label>
        <input
          id="selector"
          className="field-input"
          value={selector}
          onChange={(event) => setSelector(event.target.value)}
          placeholder={text.selectorPlaceholder}
          disabled={isSubmitting}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={cleanEnabled}
            onChange={(event) => setCleanEnabled(event.target.checked)}
            disabled={isSubmitting}
          />
          <span>{text.cleanToggle}</span>
        </label>
      </section>

      {status === 'idle' && (
        <div className="idle-view">
          <p className="idle-desc">{text.idleDescription}</p>
          <button className="btn-primary" onClick={handleAnalyze} disabled={isSubmitting}>
            <Zap size={16} />
            {isSubmitting ? text.analyzingAction : text.analyzeAction}
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="loading-view">
          <Loader2 size={32} className="spin" />
          <p>{text.loadingMessage}</p>
          {currentUrl && <span className="url-chip">{hostnameFromUrl(currentUrl)}</span>}
        </div>
      )}

      {status === 'queued' && queued && (
        <div className="error-view queued-view">
          <Loader2 size={24} className="spin" />
          <p>{text.queuedMessage}</p>
          <p className="error-meta">{text.queuedUrl} {hostnameFromUrl(queued.url)}</p>
          <button className="btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> {text.newQueryAction}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="error-view">
          <AlertCircle size={32} />
          <p>{error?.message ?? text.unknownError}</p>
          {error?.code && <p className="error-meta">{text.errorCode} {error.code}</p>}
          <button className="btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> {text.retryAction}
          </button>
        </div>
      )}

      {status === 'success' && data && (
        <div className="result-view">
          <div className="result-url">
            <CheckCircle2 size={14} />
            <span title={data.url}>{hostnameFromUrl(data.url)}</span>
            {data.cached && <span className="cache-badge">{text.cachedBadge}</span>}
            <span className="timing">{data.timingsMs.total}{text.timingUnit}</span>
          </div>

          <div className="stats-grid">
            <StatCard
              icon={<FileCode2 size={16} />}
              label={text.htmlLabel}
              tokens={data.html.tokens}
              chars={data.html.characters}
              accent="accent-html"
              locale={locale}
              tokensUnit={text.tokensUnit}
              charsUnit={text.charsUnit}
            />
            <StatCard
              icon={<FileText size={16} />}
              label={text.markdownLabel}
              tokens={data.markdown.tokens}
              chars={data.markdown.characters}
              accent="accent-md"
              locale={locale}
              tokensUnit={text.tokensUnit}
              charsUnit={text.charsUnit}
            />
          </div>

          <ReductionBadge
            reduction={reductionPercent(data.html.tokens, data.markdown.tokens)}
            label={text.reductionLabel}
          />

          <div className="actions">
            <button className="btn-action" onClick={handleCopy}>
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? text.copiedAction : text.copyMarkdownAction}
            </button>
            <button className="btn-action" onClick={handleDownload}>
              <Download size={14} />
              {text.downloadAction}
            </button>
          </div>

          <MarkdownPreview content={data.markdown.content} title={text.markdownPreview} />

          <button className="btn-ghost" onClick={reset}>
            <RotateCcw size={12} /> {text.newQueryAction}
          </button>
        </div>
      )}

      <footer className="popup-footer">
        <button type="button" className="popup-doc-link" onClick={() => openExtensionHtml('preview.html')}>
          <ExternalLink size={12} aria-hidden />
          {text.extensionInfoAction}
        </button>
      </footer>
    </div>
  );
}
