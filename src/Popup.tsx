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
  ExternalLink,
} from 'lucide-react';
import { useAnalyze } from './useAnalyze';
import { getUiLocale, t } from './chromeI18n';

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
  const [copied, setCopied] = useState(false);
  const [selector, setSelector] = useState('');
  const [cleanEnabled, setCleanEnabled] = useState(false);

  const locale = getUiLocale();

  const {
    status,
    data,
    queued,
    error,
    currentUrl,
    isSubmitting,
    analyze,
    reset,
  } = useAnalyze();

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
          <h1>{t('appTitle')}</h1>
          <p>{t('appSubtitle')}</p>
        </div>
      </header>

      <section className="config-card">
        <label className="field-label" htmlFor="selector">{t('selectorLabel')}</label>
        <input
          id="selector"
          className="field-input"
          value={selector}
          onChange={(event) => setSelector(event.target.value)}
          placeholder={t('selectorPlaceholder')}
          disabled={isSubmitting}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={cleanEnabled}
            onChange={(event) => setCleanEnabled(event.target.checked)}
            disabled={isSubmitting}
          />
          <span>{t('cleanToggle')}</span>
        </label>
      </section>

      {status === 'idle' && (
        <div className="idle-view">
          <p className="idle-desc">{t('idleDescription')}</p>
          <button className="btn-primary" onClick={handleAnalyze} disabled={isSubmitting}>
            <Zap size={16} />
            {isSubmitting ? t('analyzingAction') : t('analyzeAction')}
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="loading-view">
          <Loader2 size={32} className="spin" />
          <p>{t('loadingMessage')}</p>
          {currentUrl && <span className="url-chip">{hostnameFromUrl(currentUrl)}</span>}
        </div>
      )}

      {status === 'queued' && queued && (
        <div className="error-view queued-view">
          <Loader2 size={24} className="spin" />
          <p>{t('queuedMessage')}</p>
          <p className="error-meta">{t('queuedUrl')} {hostnameFromUrl(queued.url)}</p>
          <button className="btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> {t('newQueryAction')}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="error-view">
          <AlertCircle size={32} />
          <p>{error?.message ?? t('unknownError')}</p>
          {error?.code && <p className="error-meta">{t('errorCode')} {error.code}</p>}
          <button className="btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> {t('retryAction')}
          </button>
        </div>
      )}

      {status === 'success' && data && (
        <div className="result-view">
          <div className="result-url">
            <CheckCircle2 size={14} />
            <span title={data.url}>{hostnameFromUrl(data.url)}</span>
            {data.cached && <span className="cache-badge">{t('cachedBadge')}</span>}
            <span className="timing">{data.timingsMs.total}{t('timingUnit')}</span>
          </div>

          <div className="stats-grid">
            <StatCard
              icon={<FileCode2 size={16} />}
              label={t('htmlLabel')}
              tokens={data.html.tokens}
              chars={data.html.characters}
              accent="accent-html"
              locale={locale}
              tokensUnit={t('tokensUnit')}
              charsUnit={t('charsUnit')}
            />
            <StatCard
              icon={<FileText size={16} />}
              label={t('markdownLabel')}
              tokens={data.markdown.tokens}
              chars={data.markdown.characters}
              accent="accent-md"
              locale={locale}
              tokensUnit={t('tokensUnit')}
              charsUnit={t('charsUnit')}
            />
          </div>

          <ReductionBadge
            reduction={reductionPercent(data.html.tokens, data.markdown.tokens)}
            label={t('reductionLabel')}
          />

          <div className="actions">
            <button className="btn-action" onClick={handleCopy}>
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? t('copiedAction') : t('copyMarkdownAction')}
            </button>
            <button className="btn-action" onClick={handleDownload}>
              <Download size={14} />
              {t('downloadAction')}
            </button>
          </div>

          <MarkdownPreview content={data.markdown.content} title={t('markdownPreview')} />

          <button className="btn-ghost" onClick={reset}>
            <RotateCcw size={12} /> {t('newQueryAction')}
          </button>
        </div>
      )}

      <footer className="popup-footer">
        <button type="button" className="popup-doc-link" onClick={() => openExtensionHtml('preview.html')}>
          <ExternalLink size={12} aria-hidden />
          {t('extensionInfoAction')}
        </button>
      </footer>
    </div>
  );
}
