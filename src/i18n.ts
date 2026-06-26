import i18next from 'i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU' };

export async function initI18n(): Promise<void> {
  const saved = localStorage.getItem('lang') || 'en';
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

export function tAll(key: string): string[] {
  return ([fr, en, ru] as Record<string, string>[])
    .map(loc => loc[key])
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.toLowerCase());
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
