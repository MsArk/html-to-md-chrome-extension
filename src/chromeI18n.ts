const FALLBACK_MESSAGES = {
  appTitle: 'HTML -> Markdown',
  appSubtitle: 'Token Analyzer',
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
  errorActiveTabInvalidUrl: 'The active tab does not have a valid HTTP/HTTPS URL.',
  errorQueuedInvalidPayload: 'The server responded 202 without a valid payload.',
  errorUnknownServer: 'Unknown error. Check that the server is running.',
  rateLimitRetry: 'Too many requests. Retry in $1s.',
  rateLimitGeneric: 'Too many requests. Wait before retrying.',
  serverErrorStatus: 'Server error: $1',
  retryInSuffix: 'Retry in $1s.',
  backendErrorInvalidUrl: 'The URL is not valid. Use an http or https address.',
  backendErrorFetchFailed: 'Could not download the target page.',
  backendErrorFetchTimeout: 'The server took too long to download the page.',
  backendErrorInvalidContentType: 'The URL did not return compatible HTML for analysis.',
  backendErrorBodyTooLarge: 'The page is too large to process.',
  backendErrorInvalidSelector: 'The CSS selector is invalid.',
  backendErrorSelectorNotFound: 'The selector did not match any elements on the page.',
  backendErrorUrlRateLimited: 'Too many requests for this URL. Wait before retrying.',
  backendErrorTooManyRequests: 'Too many requests from your IP. Wait before retrying.',
  backendErrorInvalidJson: 'The server received invalid JSON.',
  backendErrorMissingField: 'A required field is missing in the request.',
  backendErrorServerError: 'Internal server error. Try again in a few seconds.',
  backendErrorInternalServerError: 'Internal server error. Try again in a few seconds.',
} as const;

export type I18nKey = keyof typeof FALLBACK_MESSAGES;

function isChromeI18nAvailable(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.i18n?.getMessage === 'function';
}

function applySubstitutions(template: string, substitutions?: string | string[]): string {
  if (!substitutions) {
    return template;
  }

  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return values.reduce((acc, value, index) => {
    return acc.split(`$${index + 1}`).join(value);
  }, template);
}

export function t(key: I18nKey, substitutions?: string | string[]): string {
  if (isChromeI18nAvailable()) {
    const translated = chrome.i18n.getMessage(key, substitutions);
    if (translated) {
      return translated;
    }
  }

  return applySubstitutions(FALLBACK_MESSAGES[key], substitutions);
}

export function getUiLocale(): string {
  if (typeof chrome !== 'undefined' && typeof chrome.i18n?.getUILanguage === 'function') {
    const uiLanguage = chrome.i18n.getUILanguage();
    if (uiLanguage) {
      return uiLanguage;
    }
  }
  return 'en-US';
}
