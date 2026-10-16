/* ════════════ QUẢN LÝ GIAO DIỆN CHUNG, THEME, ÂM THANH & XUẤT BÁO CÁO V2 ════════════ */

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
        focusActiveScanInput();
    } else if (tabId === 'audit') {
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
    renderAnalysisDashboard();
    renderParametricDashboard();
    renderFilesManager();
    updateStatusBar();
}

function focusActiveScanInput() {
    const id = (currentTab === 'audit') ? 'audit-scanner-input' : 'scanner-input';
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) {
        setTimeout(() => el.focus(), 120);
    }
}

/* ════════════ CẬP NHẬT STATUS BAR & ĐỒNG HỒ THỜI GIAN THỰC ════════════ */
function updateStatusBar() {
    const stEl = document.getElementById('sb-stations');
    const cyEl = document.getElementById('sb-cycle');
    const recEl = document.getElementById('sb-records');
    const limEl = document.getElementById('sb-limits');

    if (stEl) {
        const activeStations = Array.from(loadedFilesMap.values()).filter(f => f.active).map(f => f.stationName);
        stEl.textContent = activeStations.length > 0 ? Array.from(new Set(activeStations)).join(', ') : '—';
    }

    if (cyEl) {
        cyEl.textContent = `${currentGapThreshold} phút`;
    }

    if (recEl) {
        recEl.textContent = `${filteredTimelineData.length.toLocaleString()} bản ghi`;
    }

    if (limEl) {
        limEl.textContent = allKnownMetrics.size > 0 ? `${allKnownMetrics.size} thông số` : 'BẬT';
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
    localStorage.setItem(LS.THEME, theme);
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    setTheme(isLight ? 'dark' : 'light');
}

function applyUiZoom(zoomPct) {
    const scale = (zoomPct || 100) / 100;
    document.documentElement.style.fontSize = `${16 * scale}px`;
    CFG.UI_ZOOM = zoomPct;
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
    localStorage.setItem(LS.MUTED, audioMuted);
    const btn = document.getElementById('audio-toggle-btn');
    if (btn) btn.innerText = audioMuted ? '🔇' : '🔊';
    showToast(audioMuted ? '🔇 Đã tắt âm thanh' : '🔊 Đã bật âm thanh', 'info');
}

function onVolumeSliderInput(val) {
    const pct = parseInt(val, 10);
    audioVolume = pct / 100;
    localStorage.setItem(LS.VOLUME, audioVolume);
    const label = document.getElementById('volume-value');
    if (label) label.textContent = pct + '%';
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

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice('Đạt');
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

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice('Lỗi');
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

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice('Không tìm thấy');
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

            if (CFG.VOICE_ALERTS_ENABLED) speakVoice('Trùng');
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
    if (confirm(_t('Bạn có chắc chắn muốn nạp lại tệp mới? Toàn bộ dữ liệu phiên hiện tại sẽ được làm mới.'))) {
        resetAllData();
        filesToLoad = [];
        const prev = document.getElementById('file-list-preview');
        if (prev) prev.innerHTML = '';
        const finput = document.getElementById('file-input');
        if (finput) finput.value = '';
        setProcessingButtonState(false, _t('TIẾN HÀNH XỬ LÝ DỮ LIỆU'));
        document.getElementById('main-app-screen').classList.add('hidden');
        document.getElementById('setup-screen').classList.remove('hidden');
        switchTab('scan');
    }
}

/* ════════════ XUẤT DỮ LIỆU EXCEL TỔNG HỢP V2 ════════════ */
async function exportFullExcelReport() {
    if (typeof ExcelJS === 'undefined') {
        showToast('⚠️ Thư viện ExcelJS chưa tải xong. Vui lòng thử lại sau giây lát.', 'warning');
        return;
    }

    if (filteredTimelineData.length === 0) {
        showToast('⚠️ Không có dữ liệu để xuất báo cáo.', 'warning');
        return;
    }

    showToast('⏳ Đang tạo báo cáo Excel chi tiết...', 'info');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QIT Scanner v2';
    workbook.created = new Date();

    // SHEET 1: TỔNG QUAN CHẤT LƯỢNG & KPI
    const wsSummary = workbook.addWorksheet('Quality Summary');
    wsSummary.addRow(['QIT SCANNER V2 — BÁO CÁO PHÂN TÍCH CHẤT LƯỢNG KLIPPEL QC']);
    wsSummary.addRow(['Thời gian xuất báo cáo:', new Date().toLocaleString()]);
    wsSummary.addRow(['Số tệp đã nạp:', loadedFilesMap.size]);
    wsSummary.addRow(['Bộ lọc hiện tại:', currentActiveFileFilter]);
    wsSummary.addRow([]);
    wsSummary.addRow(['CHỈ SỐ KPI CHẤT LƯỢNG', 'GIÁ TRỊ']);
    wsSummary.addRow(['Tổng số sản phẩm thực tế (Unique DUT)', analysisData.uniqueUnitsCount]);
    wsSummary.addRow(['Tổng số bản ghi đo thô (Records)', analysisData.rawRecordsCount]);
    wsSummary.addRow(['Sản phẩm Đạt chuẩn (PASS)', analysisData.passCount]);
    wsSummary.addRow(['Sản phẩm Lỗi (FAIL/NG)', analysisData.failCount]);
    wsSummary.addRow(['First Pass Yield (FPY %)', (analysisData.fpy || 0).toFixed(2) + '%']);
    wsSummary.addRow(['Tỷ lệ Đạt thực tế (Final Yield %)', (analysisData.finalPassRate || 0).toFixed(2) + '%']);
    wsSummary.addRow(['Số sản phẩm phải đo lại (Retest)', analysisData.retestCount]);

    // SHEET 2: BẢNG PARETO LỖI 80/20
    const wsPareto = workbook.addWorksheet('Pareto Defects');
    wsPareto.addRow(['Hạng', 'Mã Lỗi Kỹ Thuật (Raw Error)', 'Tên Hiển Thị (Alias)', 'Số Lượt Lỗi', '% Đóng Góp Lỗi', '% SP Bị Ảnh Hưởng', '% Tích Lũy Pareto']);
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
    matrixHeader.push('Phán Định Cuối', 'Tổng Lần Đo');
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
    wsCpk.addRow(['Thông Số Đo', 'Điều Kiện Kích Thích', 'Đơn Vị', 'LSL (Min Limit)', 'USL (Max Limit)', 'Số Mẫu (N)', 'Trung Bình (Mean)', 'Độ Lệch Chuẩn (StdDev)', 'Min', 'Max', 'Cp', 'Cpk', 'Đánh Giá Năng Lực']);
    parametricAnalysisMap.forEach(m => {
        let rating = 'N/A';
        if (m.cpk !== null) {
            if (m.cpk >= CFG.CPK_EXCELLENT) rating = 'Xuất sắc (>=1.67)';
            else if (m.cpk >= CFG.CPK_CAPABLE) rating = 'Đạt năng lực (>=1.33)';
            else if (m.cpk >= CFG.CPK_MARGINAL) rating = 'Cận biên (1.00 - 1.33)';
            else rating = 'Không đạt (<1.00)';
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
            rating
        ]);
    });

    // SHEET 5: TOÀN BỘ DỮ LIỆU ĐO CHI TIẾT (RAW RECORDS)
    const wsRaw = workbook.addWorksheet('Raw Measurements');
    const rawHeaders = ['ID', 'Tệp Nguồn', 'Trạm Đo', 'Mã Model', 'Serial Number', 'Định Danh Gốc', 'Ngày Giờ', 'Kết Luận Tổng Thể', 'Lỗi Phát Hiện'];
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
    a.download = `QIT_Scanner_v2_Report_${toLocalDateStr(new Date())}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('✅ Đã xuất báo cáo Excel tổng thể thành công!', 'success');
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
