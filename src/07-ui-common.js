/* ════════════ QUẢN LÝ GIAO DIỆN CHUNG, THEME, ÂM THANH & XUẤT BÁO CÁO V2 PRO ════════════ */

let currentTab = 'scan'; // 'scan' | 'audit' | 'analysis' | 'parametric' | 'files'

function switchTab(tabId) {
    if (tabId === 'settings') {
        openSettingsModal();
        return;
    }

    // Tự động giải phóng màn hình nạp ban đầu khi người dùng chủ động chọn bất kỳ tab nào
    const setupScr = document.getElementById('setup-screen');
    const mainScr = document.getElementById('main-app-screen');
    if (setupScr && !setupScr.classList.contains('hidden')) {
        setupScr.classList.add('hidden');
    }
    if (mainScr && mainScr.classList.contains('hidden')) {
        mainScr.classList.remove('hidden');
    }

    currentTab = tabId;

    // Cập nhật trạng thái các nút tab
    document.querySelectorAll('.header-nav .nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('tab-btn-' + tabId);
    if (activeBtn) activeBtn.classList.add('active');

    // Cập nhật hiển thị các pane
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.classList.add('hidden');
    });
    const activePane = document.getElementById('pane-' + tabId);
    if (activePane) {
        activePane.classList.remove('hidden');
        activePane.classList.add('active');
    }

    // Render nội dung tương ứng theo tab
    if (tabId === 'scan') {
        renderScanStatsOverview();
        renderScanHistoryTable();
        focusActiveScanInput();
    } else if (tabId === 'audit') {
        renderAuditDashboard();
        focusActiveScanInput();
    } else if (tabId === 'analysis') {
        renderAnalysisDashboard();
    } else if (tabId === 'parametric') {
        renderParametricDashboard();
    } else if (tabId === 'files') {
        renderFilesManager();
    }

    updateStatusBar();
}

function renderAllViews() {
    renderScanStatsOverview();
    renderScanHistoryTable();
    if (typeof renderAuditDashboard === 'function') renderAuditDashboard();
    renderAnalysisDashboard();
    renderParametricDashboard();
    renderFilesManager();
    updateStatusBar();
}

function focusActiveScanInput() {
    const id = (currentTab === 'audit') ? 'audit-scanner-input' : 'scanner-input';
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) {
        setTimeout(() => el.focus(), 100);
    }
}

/* ════════════ CẬP NHẬT STATUS BAR & ĐỒNG HỒ THỜI GIAN THỰC ════════════ */
function updateStatusBar() {
    const stEl = document.getElementById('sb-stations');
    const cyEl = document.getElementById('sb-cycle');
    const recEl = document.getElementById('sb-records');
    const limEl = document.getElementById('sb-limits');
    const fpyEl = document.getElementById('sb-fpy');
    const audEl = document.getElementById('sb-audit');
    const navFilesBadge = document.getElementById('nav-badge-files');
    const navAuditBadge = document.getElementById('nav-badge-audit');

    const activeFiles = Array.from(loadedFilesMap.values()).filter(f => f.active);
    const activeStations = Array.from(new Set(activeFiles.map(f => f.stationName)));

    if (stEl) {
        stEl.textContent = activeStations.length > 0
            ? `${activeStations.join(' · ')} (${_t('{0}/{1} tệp', activeFiles.length, loadedFilesMap.size)})`
            : _t('Chưa nạp tệp');
    }

    if (cyEl) {
        cyEl.textContent = `${currentGapThreshold} ${_t('phút')}`;
    }

    if (recEl) {
        recEl.textContent = _t('{0} mẫu ({1} DUT)', filteredTimelineData.length.toLocaleString(), analysisData.uniqueUnitsCount.toLocaleString());
    }

    if (fpyEl) {
        fpyEl.textContent = filteredTimelineData.length > 0
            ? `${(analysisData.fpy || 0).toFixed(1)}% / ${(analysisData.finalPassRate || 0).toFixed(1)}%`
            : '—';
    }

    if (limEl) {
        limEl.textContent = allKnownMetrics.size > 0 ? _t('{0} thông số SPC', allKnownMetrics.size) : _t('Sẵn sàng');
    }

    if (audEl) {
        const gCount = (auditState && auditState.groups) ? auditState.groups.length : 0;
        const tot = (auditState && auditState.targetList) ? auditState.targetList.length : 0;
        const sc = (auditState && auditState.scannedCount) ? auditState.scannedCount : 0;
        audEl.textContent = tot > 0 ? _t('{0}/{1} mã ({2} Group)', sc, tot, gCount) : _t('0 mã');
    }

    if (navFilesBadge) {
        navFilesBadge.textContent = loadedFilesMap.size;
        navFilesBadge.style.display = loadedFilesMap.size > 0 ? 'inline-flex' : 'none';
    }

    if (navAuditBadge) {
        const gCount = (auditState && auditState.groups) ? auditState.groups.length : 0;
        navAuditBadge.textContent = gCount > 0 ? `${gCount}G` : '';
        navAuditBadge.style.display = gCount > 0 ? 'inline-flex' : 'none';
    }
}

function initRealtimeClock() {
    function tick() {
        const clockEl = document.getElementById('sb-clock');
        if (clockEl) {
            clockEl.textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        }
    }
    tick();
    setInterval(tick, 1000);
}

/* ════════════ ĐIỀU KHIỂN SPLASH SCREEN (LOGO SYSTEM V3) ════════════ */
function showSplash(title, sub) {
    const splash = document.getElementById('qit-splash');
    if (!splash) return;
    if (title) {
        const titleEl = splash.querySelector('.qit-splash-title');
        if (titleEl) titleEl.textContent = title;
    }
    if (sub) {
        const subEl = splash.querySelector('.qit-splash-sub');
        if (subEl) subEl.textContent = sub;
    }
    splash.setAttribute('data-qit-open', 'true');
}

function hideSplash() {
    const splash = document.getElementById('qit-splash');
    if (!splash) return;
    splash.removeAttribute('data-qit-open');
}

/* ════════════ QUẢN LÝ THEME & THU PHÓNG (ZOOM) ════════════ */
function initTheme() {
    const savedTheme = localStorage.getItem(LS.THEME) || 'dark';
    setTheme(savedTheme);
    applyUiZoom(CFG.UI_ZOOM);
    applyTableDensity(CFG.TABLE_DENSITY);
    initRealtimeClock();
}

function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        const sun = document.getElementById('sun-icon');
        const moon = document.getElementById('moon-icon');
        if (sun) sun.classList.remove('hidden');
        if (moon) moon.classList.add('hidden');
    } else {
        document.body.classList.remove('light-theme');
        const sun = document.getElementById('sun-icon');
        const moon = document.getElementById('moon-icon');
        if (sun) sun.classList.add('hidden');
        if (moon) moon.classList.remove('hidden');
    }
    try { localStorage.setItem(LS.THEME, theme); } catch(e) {}
    if (currentTab === 'analysis') renderAnalysisDashboard();
    if (currentTab === 'parametric') renderParametricDashboard();
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    setTheme(isLight ? 'dark' : 'light');
}

function applyUiZoom(zoomPct) {
    const cleanZoom = Math.min(150, Math.max(80, parseInt(zoomPct, 10) || 100));
    const scale = cleanZoom / 100;
    if (document.documentElement && document.documentElement.style) {
        if (typeof document.documentElement.style.setProperty === 'function') {
            document.documentElement.style.setProperty('--ui-zoom', scale);
        } else {
            document.documentElement.style['--ui-zoom'] = scale;
        }
        document.documentElement.style.fontSize = `${16 * scale}px`;
    }
    const appContainer = document.getElementById('app-container');
    if (appContainer && appContainer.style) {
        appContainer.style.zoom = scale;
    }
    CFG.UI_ZOOM = cleanZoom;
    saveCustomConfig();
}

function applyTableDensity(density) {
    document.body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
    document.body.classList.add(`density-${density}`);
    CFG.TABLE_DENSITY = density;
    saveCustomConfig();
}

function saveCustomConfig() {
    try {
        localStorage.setItem(LS.CFG_CUSTOM, JSON.stringify(CFG));
    } catch(e) {}
}

/* ════════════ HỘP THOẠI XÁC NHẬN & NHẬP LIỆU TRONG TRANG (SANDBOX-SAFE MODAL) ════════════ */
let activeDialogCallback = null;

function openAppDialog({ title, message, showInput = false, inputPlaceholder = '', inputDefault = '', confirmText = _t('Xác Nhận'), cancelText = _t('Hủy Bỏ'), danger = false, onConfirm }) {
    // Fallback cho môi trường kiểm thử tự động Node.js không có DOM thật
    let modal = document.getElementById('qit-custom-dialog-modal');
    if (!modal && typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function') {
        modal = document.createElement('div');
        modal.id = 'qit-custom-dialog-modal';
        modal.className = 'modal hidden';
        document.body.appendChild(modal);
    }
    if (!modal || !modal.classList || typeof window === 'undefined' || !window.requestAnimationFrame) {
        if (typeof onConfirm === 'function') onConfirm(inputDefault || _t('Sự kiện kỹ thuật'));
        return;
    }

    activeDialogCallback = onConfirm;

    modal.innerHTML = `
        <div class="modal-card" style="max-width:460px;">
            <div class="modal-header">
                <h3 style="font-size:15px; font-weight:800; margin:0; color:${danger ? 'var(--status-fail)' : 'var(--accent-cyan)'};">${escapeHtml(title || _t('Xác Nhận Hệ Thống'))}</h3>
                <button class="btn-icon" onclick="closeAppDialog()">✕</button>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:13px; color:var(--text-main); line-height:1.55;">${message}</div>
                ${showInput ? `
                    <input type="text" id="qit-dialog-input" class="settings-input" style="width:100%; font-size:13px; padding:10px 12px;" placeholder="${escapeHtml(inputPlaceholder)}" value="${escapeHtml(inputDefault)}">
                ` : ''}
            </div>
            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="closeAppDialog()">${escapeHtml(cancelText)}</button>
                <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" onclick="confirmAppDialog()">${escapeHtml(confirmText)}</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    const inp = document.getElementById('qit-dialog-input');
    if (inp && typeof inp.focus === 'function') {
        setTimeout(() => inp.focus(), 60);
    }
}

function closeAppDialog() {
    const modal = document.getElementById('qit-custom-dialog-modal');
    if (modal) modal.classList.add('hidden');
    activeDialogCallback = null;
}

function confirmAppDialog() {
    const inp = document.getElementById('qit-dialog-input');
    const val = inp ? inp.value : true;
    const cb = activeDialogCallback;
    closeAppDialog();
    if (typeof cb === 'function') cb(val);
}

/* ════════════ HỆ THỐNG ÂM THANH & GIỌNG NÓI (WEB AUDIO & SPEECH) ════════════ */
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function toggleAudioMute() {
    audioMuted = !audioMuted;
    try { localStorage.setItem(LS.MUTED, audioMuted); } catch(e) {}
    const btn = document.getElementById('audio-toggle-btn');
    if (btn) btn.innerText = audioMuted ? '🔇' : '🔊';
    showToast(audioMuted ? _t('🔇 Đã tắt âm thanh') : _t('🔊 Đã bật âm thanh'), 'info');
}

function onVolumeSliderInput(val) {
    const pct = parseInt(val, 10);
    audioVolume = pct / 100;
    try { localStorage.setItem(LS.VOLUME, audioVolume); } catch(e) {}
    const modalLabel = document.getElementById('modal-volume-val');
    if (modalLabel) modalLabel.textContent = pct + '%';
}

function playScanSound(type = 'PASS') {
    if (audioMuted) return;
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const vol = (typeof audioVolume === 'number' && audioVolume >= 0) ? audioVolume : 1.3;

        if (type === 'PASS') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12);
            gain.gain.setValueAtTime(0.4 * vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice(_t('Đạt'));
        } else if (type === 'FAIL') {
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(160, now);
            osc1.frequency.exponentialRampToValueAtTime(90, now + 0.25);
            gain1.gain.setValueAtTime(0.6 * vol, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.26);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(120, now + 0.08);
            osc2.frequency.exponentialRampToValueAtTime(70, now + 0.28);
            gain2.gain.setValueAtTime(0.4 * vol, now + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.29);

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice(_t('Lỗi'));
        } else if (type === 'NOT_FOUND') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.setValueAtTime(450, now + 0.1);
            gain.gain.setValueAtTime(0.5 * vol, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.23);

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice(_t('Không tìm thấy'));
        } else if (type === 'DUPLICATE') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(700, now);
            gain.gain.setValueAtTime(0.3 * vol, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.09);

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice(_t('Trùng'));
        }
    } catch(e) {
        console.warn('Audio play error:', e);
    }
}

function speakVoice(text) {
    if ('speechSynthesis' in window && text) {
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = CFG.VOICE_LANG || 'vi-VN';
            utterance.rate = 1.2;
            utterance.volume = Math.min(1.0, audioVolume);
            window.speechSynthesis.speak(utterance);
        } catch(e) {}
    }
}

/* ════════════ THÔNG BÁO TOAST TỰ ĐỘNG ════════════ */
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = msg;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (typeof toast.remove === 'function') {
                toast.remove();
            } else if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, CFG.TOAST_MS);
}

function setProcessingButtonState(isProcessing, text) {
    const btn = document.getElementById('btn-process');
    if (btn) {
        btn.disabled = isProcessing;
        btn.innerText = text;
    }
}

function resetApp() {
    openAppDialog({
        title: _t('🔄 Nạp Mới & Quản Lý Nguồn Dữ Liệu'),
        message: _t('Bạn muốn quay về màn hình nạp tệp nhật ký Klippel mới (và làm mới dữ liệu log hiện tại)? Dữ liệu các Group kiểm tra danh sách (Audit) vẫn được giữ an toàn.'),
        confirmText: _t('🔄 Về Màn Hình Nạp Tệp'),
        cancelText: _t('Ở Lại'),
        onConfirm: () => {
            resetAllData();
            filesToLoad = [];
            const prev = document.getElementById('file-list-preview');
            if (prev) prev.innerHTML = '';
            const finput = document.getElementById('file-input');
            if (finput) finput.value = '';
            setProcessingButtonState(false, _t('TIẾN HÀNH XỬ LÝ DỮ LIỆU'));
            document.getElementById('main-app-screen').classList.add('hidden');
            document.getElementById('setup-screen').classList.remove('hidden');
            updateStatusBar();
        }
    });
}

/**
 * Tiện ích sao chép văn bản an toàn trong mọi môi trường (kể cả Sandbox iframe)
 */
function copyTextSafe(text, successMsg) {
    if (!text) return;
    const done = () => showToast(successMsg || _t('✅ Đã sao chép vào Clipboard!'), 'success');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}

function fallbackCopy(text, cb) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (cb) cb();
    } catch (e) {
        showToast(_t('⚠️ Không thể truy cập Clipboard tự động.'), 'warning');
    }
}

/* ════════════ XUẤT DỮ LIỆU EXCEL TỔNG HỢP V2 PRO ════════════ */
async function exportFullExcelReport() {
    if (typeof ExcelJS === 'undefined') {
        showToast(_t('⚠️ Thư viện ExcelJS chưa tải xong. Vui lòng thử lại sau giây lát.'), 'warning');
        return;
    }

    if (filteredTimelineData.length === 0) {
        showToast(_t('⚠️ Không có dữ liệu log để xuất báo cáo. Bạn có thể bấm "Nạp Dữ Liệu Mẫu" hoặc nạp file log.'), 'warning');
        return;
    }

    showToast(_t('⏳ Đang tạo báo cáo Excel 5-Sheet chi tiết...'), 'info');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QIT Scanner v2 Pro';
    workbook.created = new Date();

    // SHEET 1: TỔNG QUAN CHẤT LƯỢNG & KPI
    const wsSummary = workbook.addWorksheet('Quality Summary');
    wsSummary.addRow([_t('QIT SCANNER V2 PRO — BÁO CÁO PHÂN TÍCH CHẤT LƯỢNG KLIPPEL QC')]);
    wsSummary.addRow([_t('Thời gian xuất báo cáo:'), new Date().toLocaleString()]);
    wsSummary.addRow([_t('Số tệp đã nạp:'), loadedFilesMap.size]);
    wsSummary.addRow([_t('Bộ lọc hiện tại:'), currentActiveFileFilter]);
    wsSummary.addRow([]);
    wsSummary.addRow([_t('CHỈ SỐ KPI CHẤT LƯỢNG'), _t('GIÁ TRỊ')]);
    wsSummary.addRow([_t('Tổng số sản phẩm thực tế (Unique DUT)'), analysisData.uniqueUnitsCount]);
    wsSummary.addRow([_t('Tổng số bản ghi đo thô (Records)'), analysisData.rawRecordsCount]);
    wsSummary.addRow([_t('Sản phẩm Đạt chuẩn (PASS)'), analysisData.passCount]);
    wsSummary.addRow([_t('Sản phẩm Lỗi (FAIL/NG)'), analysisData.failCount]);
    wsSummary.addRow(['First Pass Yield (FPY %)', (analysisData.fpy || 0).toFixed(2) + '%']);
    wsSummary.addRow([_t('Tỷ lệ Đạt thực tế (Final Yield %)'), (analysisData.finalPassRate || 0).toFixed(2) + '%']);
    wsSummary.addRow([_t('Số sản phẩm phải đo lại (Retest)'), analysisData.retestCount]);

    // SHEET 2: BẢNG PARETO LỖI 80/20
    const wsPareto = workbook.addWorksheet('Pareto Defects');
    wsPareto.addRow([_t('Hạng'), _t('Mã Lỗi Kỹ Thuật (Raw Error)'), _t('Tên Hiển Thị (Alias)'), _t('Số Lượt Lỗi'), _t('% Đóng Góp Lỗi'), _t('% SP Bị Ảnh Hưởng'), _t('% Tích Lũy Pareto')]);
    analysisData.errorPareto.forEach((item, idx) => {
        wsPareto.addRow([
            idx + 1,
            item.rawName,
            getMappedName(item.rawName),
            item.count,
            (item.pctOfDefects || 0).toFixed(2) + '%',
            (item.pctOfUnits || 0).toFixed(2) + '%',
            (item.cumPercent || 0).toFixed(2) + '%'
        ]);
    });

    // SHEET 3: MA TRẬN ĐA LƯỢT ĐO (MULTI-RUN MATRIX)
    const wsMatrix = workbook.addWorksheet('Multi-Run Matrix');
    const matrixHeader = ['STT', 'Serial Number / ID'];
    matrixData.runs.forEach(r => matrixHeader.push(`${r.stationName} (${r.fileName})`));
    matrixHeader.push(_t('Phán Định Cuối'), _t('Tổng Lần Đo'));
    wsMatrix.addRow(matrixHeader);

    matrixData.rows.forEach((row, idx) => {
        const rowData = [idx + 1, row.rawSN || row.sn];
        matrixData.runs.forEach(r => {
            const res = row.runResults[r.id];
            if (!res) rowData.push('—');
            else if (res.pass) rowData.push(res.count > 1 ? `PASS (${res.count}x)` : 'PASS');
            else rowData.push(`FAIL: ${res.errors.join(', ')}`);
        });
        rowData.push(row.finalVerdict ? 'PASS' : 'FAIL', row.totalScans);
        wsMatrix.addRow(rowData);
    });

    // SHEET 4: NĂNG LỰC QUY TRÌNH CPK (PARAMETRIC STATS)
    const wsCpk = workbook.addWorksheet('Parametric & Cpk');
    wsCpk.addRow([_t('Thông Số Đo'), _t('Điều Kiện Kích Thích'), _t('Đơn Vị'), _t('LSL (Min Limit)'), _t('USL (Max Limit)'), _t('Số Mẫu (N)'), _t('Trung Bình (Mean)'), _t('Độ Lệch Chuẩn (StdDev)'), 'Min', 'Max', 'Cp', 'Cpk', 'Ppk', _t('Đánh Giá Năng Lực')]);
    parametricAnalysisMap.forEach(m => {
        let rating = 'N/A';
        if (m.cpk !== null) {
            if (m.cpk >= CFG.CPK_EXCELLENT) rating = _t('Xuất sắc (>=1.67)');
            else if (m.cpk >= CFG.CPK_CAPABLE) rating = _t('Đạt năng lực (>=1.33)');
            else if (m.cpk >= CFG.CPK_MARGINAL) rating = _t('Cận biên (1.00 - 1.33)');
            else rating = _t('Không đạt (<1.00)');
        }
        wsCpk.addRow([
            m.name,
            m.condition || 'Standard',
            m.unit,
            m.lsl !== null ? m.lsl : '—',
            m.usl !== null ? m.usl : '—',
            m.count,
            m.mean.toFixed(4),
            m.stdDev.toFixed(4),
            m.min.toFixed(4),
            m.max.toFixed(4),
            m.cp !== null ? m.cp.toFixed(3) : '—',
            m.cpk !== null ? m.cpk.toFixed(3) : '—',
            m.ppk !== null ? m.ppk.toFixed(3) : '—',
            rating
        ]);
    });

    // SHEET 5: TOÀN BỘ DỮ LIỆU ĐO CHI TIẾT (RAW RECORDS)
    const wsRaw = workbook.addWorksheet('Raw Measurements');
    const rawHeaders = ['ID', _t('Tệp Nguồn'), _t('Trạm Đo'), _t('Mã Model'), 'Serial Number', _t('Định Danh Gốc'), _t('Ngày Giờ'), _t('Kết Luận Tổng Thể'), _t('Lỗi Phát Hiện')];
    const metricKeys = Array.from(allKnownMetrics.keys());
    metricKeys.forEach(k => rawHeaders.push(k));
    wsRaw.addRow(rawHeaders);

    filteredTimelineData.forEach(r => {
        const row = [
            r.id,
            r.fileName,
            r.stationName,
            r.modelName,
            r.serialNo,
            r.displayID,
            r.timestamp ? r.timestamp.toLocaleString() : '',
            r.verdictOverall === 1 ? 'PASS' : 'FAIL',
            r.errors.join('; ')
        ];
        metricKeys.forEach(k => {
            if (r.metrics && r.metrics[k] && r.metrics[k].value !== undefined) {
                row.push(r.metrics[k].value);
            } else {
                row.push('');
            }
        });
        wsRaw.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QIT_Scanner_v2_Pro_Report_${toLocalDateStr(new Date())}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast(_t('✅ Đã xuất báo cáo Excel 5-Sheet tổng thể thành công!'), 'success');
}

/**
 * Trợ giúp tải tệp Blob (HTML, CSV, JSON) về máy tính
 */
function downloadBlobFile(content, fileName, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 250);
}
