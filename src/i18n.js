import i18next from 'i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ru from './locales/ru.json';
const LOCALE_MAP = { fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU' };
export async function initI18n() {
    const saved = localStorage.getItem('lang') || 'fr';
    await i18next.init({
        lng: saved,
        fallbackLng: 'fr',
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
    return i18next.language || 'fr';
}
export function getLocale() {
    return LOCALE_MAP[getLang()] || 'fr-FR';
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
