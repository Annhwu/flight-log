import i18next from 'i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU' };

async function getInstallerLang(): Promise<string | null> {
  try {
    const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke: <T>(cmd: string) => Promise<T> } }).__TAURI_INTERNALS__;
    if (!internals) return null;
    const ini = await internals.invoke<string>('read_installer_lang');
    const match = ini.match(/^lang\s*=\s*(\w+)/m);
    if (match) return match[1];
  } catch { /* pas de lang.ini */ }
  return null;
}

export async function initI18n(): Promise<void> {
  let saved = localStorage.getItem('lang');
  if (!saved) {
    saved = await getInstallerLang() || 'en';
    if (saved !== 'en') localStorage.setItem('lang', saved);
  }
  await i18next.init({
    lng: saved,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ru: { translation: ru },
    },
  });
}

export function t(key: string, opts?: Record<string, unknown>): string {
  return i18next.t(key, opts as any) as string;
}

export async function setLang(lang: string): Promise<void> {
  await i18next.changeLanguage(lang);
  localStorage.setItem('lang', lang);
}

export function getLang(): string {
  return i18next.language || 'en';
}

export function getLocale(): string {
  return LOCALE_MAP[getLang()] || 'en-GB';
}

export function applyStaticTranslations(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-ph]').forEach(el => {
    (el as HTMLInputElement).placeholder = t(el.dataset.i18nPh!);
  });
  document.querySelectorAll<HTMLElement>('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}
