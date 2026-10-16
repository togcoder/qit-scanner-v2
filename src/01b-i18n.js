/* ════════════ ĐỘNG CƠ DỊCH THUẬT GIAO DIỆN NÂNG CAO (PRO i18n ENGINE) ════════════ */
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
            document.documentElement.setAttribute('lang', lang);

            const sel = document.getElementById('lang-select');
            if (sel) sel.value = lang;

            const settingsSel = document.getElementById('settings-lang');
            if (settingsSel) settingsSel.value = lang;

            applyTranslations();

            // Vẽ lại toàn bộ các view động
            if (typeof renderAllViews === 'function') {
                try { renderAllViews(); } catch(e) { console.warn('renderAllViews error on setLang:', e); }
            }

            if (typeof renderAuditDashboard === 'function') {
                try { renderAuditDashboard(); } catch(e) {}
            }

            // Nếu Modal cài đặt đang mở, render lại nội dung modal
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal && !settingsModal.classList.contains('hidden') && typeof renderSettingsModalContent === 'function') {
                try { renderSettingsModalContent(); } catch(e) {}
            }

            // Cập nhật thanh trạng thái & thông tin phiên
            if (typeof updateStatusBar === 'function') {
                try { updateStatusBar(); } catch(e) {}
            }
        }
    }

    function _t(key, ...args) {
        if (!key) return '';
        const dict = (typeof I18N_DICT !== 'undefined' && I18N_DICT[currentLang]) ? I18N_DICT[currentLang] : (typeof I18N_DICT !== 'undefined' ? I18N_DICT.vi : null);
        let str = (dict && dict[key] !== undefined) ? dict[key] : ((typeof I18N_DICT !== 'undefined' && I18N_DICT.vi && I18N_DICT.vi[key] !== undefined) ? I18N_DICT.vi[key] : key);

        if (args.length > 0 && typeof str === 'string') {
            args.forEach((arg, idx) => {
                str = str.replace(new RegExp(`\\{${idx}\\}`, 'g'), (arg !== null && arg !== undefined) ? arg : '');
            });
        }
        return str;
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

        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            if (key) el.setAttribute('aria-label', _t(key));
        });
    }

    return {
        setLang,
        getLang: () => currentLang,
        _t,
        applyTranslations
    };
})();

function _t(key, ...args) {
    return QIT.i18n._t(key, ...args);
}
