export type Language = 'en' | 'es';

export const DEFAULT_LANGUAGE: Language = 'en';

const LANGUAGE_STORAGE_KEY = 'popupLanguage';

function isSupportedLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'es';
}

function canUseChromeSyncStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.sync);
}

function getLanguageFromLocalStorage(): Language | undefined {
  try {
    const localValue = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(localValue) ? localValue : undefined;
  } catch {
    return undefined;
  }
}

function saveLanguageToLocalStorage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage errors and continue.
  }
}

export async function loadPreferredLanguage(): Promise<Language> {
  if (canUseChromeSyncStorage()) {
    try {
      const result = await chrome.storage.sync.get(LANGUAGE_STORAGE_KEY);
      const syncValue = result[LANGUAGE_STORAGE_KEY];
      if (isSupportedLanguage(syncValue)) {
        return syncValue;
      }
    } catch {
      // Ignore and continue with local fallback.
    }
  }

  return getLanguageFromLocalStorage() ?? DEFAULT_LANGUAGE;
}

export async function savePreferredLanguage(language: Language): Promise<void> {
  if (canUseChromeSyncStorage()) {
    try {
      await chrome.storage.sync.set({ [LANGUAGE_STORAGE_KEY]: language });
      return;
    } catch {
      // Ignore and continue with local fallback.
    }
  }

  saveLanguageToLocalStorage(language);
}
