import i18next from 'i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ru from './locales/ru.json';
const LOCALE_MAP = { fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU' };
async function getInstallerLang() {
    try {
        const internals = window.__TAURI_INTERNALS__;
        if (!internals)
            return null;
        const ini = await internals.invoke('read_installer_lang');
        const match = ini.match(/^lang\s*=\s*(\w+)/m);
        if (match)
            return match[1];
    }
    catch { /* pas de lang.ini */ }
    return null;
}
export async function initI18n() {
    let saved = localStorage.getItem('lang');
    if (!saved) {
        saved = await getInstallerLang() || 'en';
        if (saved !== 'en')
            localStorage.setItem('lang', saved);
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
export function t(key, opts) {
    return i18next.t(key, opts);
}
export async function setLang(lang) {
    await i18next.changeLanguage(lang);
    localStorage.setItem('lang', lang);
}
export function getLang() {
    return i18next.language || 'en';
}
export function getLocale() {
    return LOCALE_MAP[getLang()] || 'en-GB';
}
export function applyStaticTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPh);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === getLang());
    });
}
