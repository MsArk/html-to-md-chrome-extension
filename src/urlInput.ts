const LOCALHOST_NO_SCHEME_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?(?:[/?#].*)?$/i;

function isHttpLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ResolveTargetUrlResult {
  url: string;
  source: 'activeTab' | 'manual';
}

/**
 * Resolves popup input into a valid HTTP(S) URL.
 * - Empty input keeps the active tab behavior.
 * - Local hosts without scheme (localhost/127.0.0.1/[::1]) default to http://.
 */
export function resolveTargetUrl(rawManualUrl: string | undefined, activeTabUrl: string | undefined): ResolveTargetUrlResult | null {
  const manualUrl = rawManualUrl?.trim();

  if (manualUrl) {
    const normalizedManualUrl = LOCALHOST_NO_SCHEME_PATTERN.test(manualUrl)
      ? `http://${manualUrl}`
      : manualUrl;

    if (!isHttpLikeUrl(normalizedManualUrl)) {
      return null;
    }

    return {
      url: normalizedManualUrl,
      source: 'manual',
    };
  }

  const tabUrl = activeTabUrl?.trim() ?? '';
  if (!isHttpLikeUrl(tabUrl)) {
    return null;
  }

  return {
    url: tabUrl,
    source: 'activeTab',
  };
}
