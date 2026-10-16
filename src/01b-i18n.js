/* ════════════ ĐỘNG CƠ DỊCH THUẬT GIAO DIỆN ════════════ */
var QIT = (typeof window !== 'undefined' && window.QIT) ? window.QIT : {};
if (typeof window !== 'undefined') window.QIT = QIT;

QIT.i18n = (function() {
    let currentLang = 'vi';
    try {
        if (typeof LS !== 'undefined' && LS.LANG && typeof localStorage !== 'undefined') {
            currentLang = localStorage.getItem(LS.LANG) || 'vi';
        }
    } catch(e) {}

    function setLang(lang) {
        if (typeof I18N_DICT !== 'undefined' && !I18N_DICT[lang]) lang = 'vi';
        currentLang = lang;
        if (typeof LS !== 'undefined' && LS.LANG && typeof localStorage !== 'undefined') {
            localStorage.setItem(LS.LANG, lang);
        }

        if (typeof document !== 'undefined') {
            const sel = document.getElementById('lang-select');
            if (sel) sel.value = lang;
            applyTranslations();
        }
    }

    function _t(key) {
        if (!key) return '';
        const dict = (typeof I18N_DICT !== 'undefined' && I18N_DICT[currentLang]) ? I18N_DICT[currentLang] : (typeof I18N_DICT !== 'undefined' ? I18N_DICT.vi : null);
        return (dict && dict[key]) ? dict[key] : key;
    }

    function applyTranslations() {
        if (typeof document === 'undefined') return;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.innerHTML = _t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.setAttribute('title', _t(key));
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.setAttribute('placeholder', _t(key));
        });
    }

    return {
        setLang,
        getLang: () => currentLang,
        _t,
        applyTranslations
    };
})();

function _t(key) {
    return QIT.i18n._t(key);
}
