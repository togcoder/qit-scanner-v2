/* ════════════ GIAO DIỆN QUÉT SẢN XUẤT THỜI GIAN THỰC (LIVE SCAN UI) V2 PRO ════════════ */

let lastScannedRecord = null;
let lastScannedMatchInfo = null;
let currentScannedSerialsSet = new Set(); // Set of scanned cleanSNs in current session

function onScanInputKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        onScanManualSubmit();
    }
}

function onScanManualSubmit() {
    const input = document.getElementById('scanner-input');
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        handleScanBarcode(val);
        input.value = '';
        input.focus();
    }
}

function setLiveScanStationFilter(station) {
    liveScanSession.stationFilter = station || 'ALL';
    renderScanStatsOverview();
    focusActiveScanInput();
}

function setLiveScanMatchMode(mode) {
    CFG.SCAN_MATCH_MODE = mode === 'exact' ? 'exact' : 'flex';
    saveCustomConfig();
    renderScanStatsOverview();
    showToast(_t('✓ Chế độ so khớp mã vạch: {0}', CFG.SCAN_MATCH_MODE === 'exact' ? _t('Chính xác 100% (Exact)') : _t('Đa tầng thông minh 3-Tier O(1)')), 'info');
    focusActiveScanInput();
}

function setScanHistoryFilter(filterVal) {
    liveScanSession.historyFilter = filterVal || 'ALL';
    renderScanHistoryTable();
}

function onScanHistorySearch(q) {
    liveScanSession.historySearch = String(q || '').trim();
    renderScanHistoryTable();
}

function triggerQuickSampleScan(type) {
    const pool = (filteredTimelineData && filteredTimelineData.length > 0) ? filteredTimelineData : timelineData;
    if (pool.length === 0) {
        loadBuiltInDemoKlippelLogs();
        return;
    }

    let candidate = null;
    if (type === 'PASS') {
        candidate = pool.find(r => isRecordPass(r));
    } else if (type === 'FAIL') {
        candidate = pool.find(r => !isRecordPass(r));
    } else if (type === 'PURE_SERIAL') {
        candidate = pool.find(r => r.serialNo && r.serialNo !== r.displayID);
        if (candidate) {
            handleScanBarcode(candidate.serialNo);
            return;
        }
    }
    if (!candidate) candidate = pool[0];
    if (candidate) {
        handleScanBarcode(candidate.displayID || candidate.rawSN);
    }
}

function handleScanBarcode(rawBarcode) {
    const processed = typeof preprocessRawScan === 'function' ? preprocessRawScan(rawBarcode) : String(rawBarcode || '').trim();
    const cleanScan = getAlphaNum(processed);
    if (!cleanScan || cleanScan.length < CFG.MIN_SCAN_LEN) {
        showToast('⚠️ ' + _t('Mã quét quá ngắn hoặc không hợp lệ') + ' (' + _t('Tối thiểu {0} ký tự', CFG.MIN_SCAN_LEN) + ')', 'warning');
        return;
    }

    const now = Date.now();
    liveScanSession.totalScans++;
    liveScanSession.timestamps.push(now);
    if (liveScanSession.timestamps.length > 30) liveScanSession.timestamps.shift();

    const match = findRecordByBarcode(rawBarcode, liveScanSession.stationFilter);
    const historyEntry = {
        id: 'SCN_' + now + '_' + Math.random().toString(36).substr(2, 4),
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        rawScan: rawBarcode,
        cleanScan: cleanScan,
        status: 'NOT_FOUND',
        isDuplicate: false,
        matchTier: '',
        record: null
    };

    if (!match) {
        liveScanSession.notFoundScans++;
        lastScannedRecord = null;
        lastScannedMatchInfo = null;
        renderVerdictCard('NOT_FOUND', rawBarcode, null, null);
        playScanSound('NOT_FOUND');
        recordRobotStats(1, 0, 0, 1);
        historyEntry.status = 'NOT_FOUND';
        if (loadedFilesMap.size === 0) {
            showToast(_t('ℹ️ Chưa nạp tệp log Klippel. Bấm [🧪 Nạp Dữ Liệu Mẫu] hoặc sang tab [🎯 KIỂM TRA DANH SÁCH] để đối soát.'), 'info');
        }
    } else {
        const rec = match.record;
        const isPass = isRecordPass(rec);
        const isDuplicate = currentScannedSerialsSet.has(rec.cleanSN);

        currentScannedSerialsSet.add(rec.cleanSN);
        lastScannedRecord = rec;
        lastScannedMatchInfo = match;

        if (isDuplicate) {
            liveScanSession.dupScans++;
        }
        if (isPass) {
            liveScanSession.passScans++;
        } else {
            liveScanSession.failScans++;
        }

        if (isDuplicate) {
            renderVerdictCard(isPass ? 'PASS_DUP' : 'FAIL_DUP', rawBarcode, rec, match);
            playScanSound('DUPLICATE');
        } else {
            renderVerdictCard(isPass ? 'PASS' : 'FAIL', rawBarcode, rec, match);
            playScanSound(isPass ? 'PASS' : 'FAIL');
        }

        recordRobotStats(1, isPass ? 1 : 0, isPass ? 0 : 1, 0);
        historyEntry.status = isPass ? 'PASS' : 'FAIL';
        historyEntry.isDuplicate = isDuplicate;
        historyEntry.matchTier = match.tierName || match.matchType || '';
        historyEntry.record = rec;
    }

    scanHistory.unshift(historyEntry);
    if (scanHistory.length > CFG.HISTORY_LIMIT) {
        scanHistory.pop();
    }
    try {
        localStorage.setItem(LS.HISTORY, JSON.stringify(scanHistory.slice(0, 50)));
    } catch(e) {}

    renderScanHistoryTable();
    renderScanStatsOverview();
}

/**
 * Hiển thị thẻ phán định công nghiệp (Verdict Band) + Dải 6 thông số đo + Hồ sơ kỹ thuật DUT
 */
function renderVerdictCard(status, rawScan, record, matchInfo) {
    const band = document.getElementById('verdict-band');
    const mark = document.getElementById('verdict-mark');
    const title = document.getElementById('verdict-title');
    const sub = document.getElementById('verdict-sub');
    const detailDrawer = document.getElementById('verdict-details');
    const snapshotContainer = document.getElementById('parametric-snapshot-container');
    const inspectorContainer = document.getElementById('dut-inspector-container');

    if (!band || !mark || !title) return;

    band.className = 'verdict-band';
    detailDrawer.innerHTML = '';

    const allRuns = (matchInfo && matchInfo.allRecords) ? matchInfo.allRecords : (record ? findAllRecordsForDUT(record) : []);
    const runCount = allRuns.length || 1;
    const tierBadge = (matchInfo && matchInfo.tierName)
        ? `<span class="meta-chip meta-chip-cyan">${escapeHtml(matchInfo.tierName)}</span>`
        : '';
    const retestBadge = runCount > 1
        ? `<span class="meta-chip meta-chip-warn">${_t('🔄 Đo {0} lượt (Retest ×{1})', runCount, runCount - 1)}</span>`
        : `<span class="meta-chip">${_t('Lần đo thứ 1 (First Run)')}</span>`;

    if (status === 'PASS' || status === 'PASS_DUP') {
        band.classList.add('verdict-pass');
        mark.style.display = 'flex';
        mark.innerHTML = '✓';
        title.innerHTML = _t('PASS · ĐẠT CHUẨN') + (status === 'PASS_DUP' ? ` <span class="badge-dup">${_t('⚠️ QUÉT LẶP')}</span>` : '');
        sub.innerHTML = `
            <div class="verdict-meta-grid">
                <div><span class="vm-lbl">${_t('MÃ ĐỊNH DANH (DUT):')}</span> <strong class="vm-mono">${escapeHtml(record ? record.displayID : rawScan)}</strong></div>
                <div><span class="vm-lbl">MODEL / SERIAL:</span> <strong class="vm-mono">${escapeHtml(record ? (record.modelName || '—') : '—')}</strong> · <strong class="vm-mono" style="color:var(--accent-cyan);">${escapeHtml(record ? (record.serialNo || '—') : '—')}</strong></div>
                <div><span class="vm-lbl">${_t('TRẠM ĐO & GIỜ ĐO:')}</span> <strong style="color:var(--accent-blue);">${escapeHtml(record ? record.stationName : '—')}</strong> · <span class="vm-mono">${record && record.timestamp ? record.timestamp.toLocaleString('vi-VN', { hour12: false }) : '—'}</span></div>
            </div>
        `;
        detailDrawer.innerHTML = `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; align-items:center;">
                <span class="badge-pill badge-pass">${_t('✓ Đạt 100% bài kiểm tra Klippel QC')}</span>
                ${tierBadge}
                ${retestBadge}
                ${record && record.userName ? `<span class="meta-chip">👤 OP: ${escapeHtml(record.userName)}</span>` : ''}
            </div>
        `;
    } else if (status === 'FAIL' || status === 'FAIL_DUP') {
        band.classList.add('verdict-fail');
        mark.style.display = 'flex';
        mark.innerHTML = '✕';
        title.innerHTML = _t('FAIL · SẢN PHẨM LỖI') + (status === 'FAIL_DUP' ? ` <span class="badge-dup">${_t('⚠️ QUÉT LẶP')}</span>` : '');
        sub.innerHTML = `
            <div class="verdict-meta-grid">
                <div><span class="vm-lbl">${_t('MÃ ĐỊNH DANH (DUT):')}</span> <strong class="vm-mono">${escapeHtml(record ? record.displayID : rawScan)}</strong></div>
                <div><span class="vm-lbl">MODEL / SERIAL:</span> <strong class="vm-mono">${escapeHtml(record ? (record.modelName || '—') : '—')}</strong> · <strong class="vm-mono" style="color:#fca5a5;">${escapeHtml(record ? (record.serialNo || '—') : '—')}</strong></div>
                <div><span class="vm-lbl">${_t('TRẠM ĐO & GIỜ ĐO:')}</span> <strong style="color:var(--accent-blue);">${escapeHtml(record ? record.stationName : '—')}</strong> · <span class="vm-mono">${record && record.timestamp ? record.timestamp.toLocaleString('vi-VN', { hour12: false }) : '—'}</span></div>
            </div>
        `;

        let errBadges = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; align-items:center;">';
        const actErrs = record ? activeErrors(record.errors) : [];
        if (actErrs.length > 0) {
            actErrs.forEach(err => {
                errBadges += `<span class="badge-pill badge-fail">✕ ${_t('LỖI:')} ${escapeHtml(getMappedName(err))} <small style="opacity:0.8;">(${escapeHtml(err)})</small></span>`;
            });
        } else {
            errBadges += `<span class="badge-pill badge-fail">✕ Verdict Overall FAIL</span>`;
        }
        errBadges += `${tierBadge} ${retestBadge}</div>`;
        detailDrawer.innerHTML = errBadges;
    } else if (status === 'NOT_FOUND') {
        band.classList.add('verdict-notfound');
        mark.style.display = 'flex';
        mark.innerHTML = '?';
        title.innerHTML = _t('KHÔNG TÌM THẤY DỮ LIỆU');
        sub.innerHTML = `
            <div class="verdict-meta-grid">
                <div><span class="vm-lbl">${_t('CHUỖI QUÉT THÔ:')}</span> <strong class="vm-mono">${escapeHtml(rawScan)}</strong></div>
                <div><span class="vm-lbl">${_t('CHUỖI CHUẨN HÓA:')}</span> <strong class="vm-mono">${escapeHtml(getAlphaNum(rawScan))}</strong></div>
                <div><span class="vm-lbl">${_t('TRẠNG THÁI KHO LOG:')}</span> <span>${loadedFilesMap.size > 0 ? _t('Đã tra cứu trên {0} DUT nhưng không có bản ghi khớp', dictLookupClean.size.toLocaleString()) : _t('Chưa nạp tệp nhật ký Klippel nào vào hệ thống')}</span></div>
            </div>
        `;
    } else {
        band.classList.add('verdict-idle');
        mark.style.display = 'none';
        title.innerHTML = _t('CHỜ QUÉT…');
        sub.innerHTML = _t('Thẻ phán định sẽ hiển thị ngay khi nhận được serial từ đầu đọc.');
    }

    // Cập nhật Dải 6 Thẻ Thông Số Đo Vật Lý (Parametric Snapshot Band)
    if (snapshotContainer) {
        renderParametricSnapshotBand(snapshotContainer, record);
    }

    // Cập nhật Hồ Sơ Kỹ Thuật Chi Tiết DUT (DUT Deep Inspector)
    if (inspectorContainer) {
        renderDUTDeepInspector(inspectorContainer, record, allRuns, rawScan, status);
    }
}

/**
 * Hiển thị dải 6 thẻ thông số vật lý với thanh dung sai trực quan [LSL ───●─── USL]
 */
function renderParametricSnapshotBand(container, record) {
    container.style.display = 'block';

    if (!record || !record.metrics || Object.keys(record.metrics).length === 0) {
        // Hiển thị 6 khung chờ chuẩn công nghiệp khi chưa quét hoặc bản ghi không có metric
        const placeholders = [
            { key: 'Re (DC Resistance)', unit: 'Ω', spec: 'LSL 14.90 · USL 18.30 Ω' },
            { key: 'fs (Resonance Freq)', unit: 'Hz', spec: 'LSL 93.50 · USL 126.50 Hz' },
            { key: 'SPL / Level', unit: 'dB', spec: 'LSL 103.79 · USL 105.79 dB' },
            { key: 'Qts (Total Q Factor)', unit: '', spec: 'LSL 0.58 · USL 0.80' },
            { key: 'impPt (Impedance)', unit: 'Ω', spec: 'LSL 17.50 · USL 21.50 Ω' },
            { key: 'rmseZ (Model Error)', unit: '%', spec: 'LSL 0.00 · USL 2.50 %' }
        ];
        let html = `<div class="snapshot-grid">`;
        placeholders.forEach(p => {
            html += `
                <div class="snapshot-card snapshot-idle">
                    <div class="snapshot-head">
                        <span class="snapshot-name">${escapeHtml(p.key)}</span>
                        <span class="snapshot-dot dot-idle"></span>
                    </div>
                    <div class="snapshot-val">— <small>${escapeHtml(p.unit)}</small></div>
                    <div class="snapshot-bar-track"><div class="snapshot-bar-fill" style="width:0%;"></div></div>
                    <div class="snapshot-spec">${escapeHtml(p.spec)}</div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
        return;
    }

    const metricKeys = Object.keys(record.metrics);
    let html = `<div class="snapshot-grid">`;

    metricKeys.slice(0, 6).forEach(k => {
        const m = record.metrics[k];
        const hasMin = m.minLimit !== null && !isNaN(m.minLimit);
        const hasMax = m.maxLimit !== null && !isNaN(m.maxLimit);
        let stateClass = 'pass';
        let statusLabel = 'OK';
        let pctPos = 50;

        if (hasMin && m.value < m.minLimit) {
            stateClass = 'fail';
            statusLabel = _t('LOW (Dưới LSL)');
            pctPos = 4;
        } else if (hasMax && m.value > m.maxLimit) {
            stateClass = 'fail';
            statusLabel = _t('HIGH (Vượt USL)');
            pctPos = 96;
        } else if (hasMin && hasMax && (m.maxLimit - m.minLimit) > 0) {
            const marginPct = (window.CFG && CFG.NEAR_FAIL_MARGIN_PCT) ? CFG.NEAR_FAIL_MARGIN_PCT : 15;
            const margin = span * (marginPct / 100);
            if ((m.value - m.minLimit) <= margin || (m.maxLimit - m.value) <= margin) {
                stateClass = 'warn';
                statusLabel = _t('CẬN BIÊN');
            }
        }

        const formattedVal = Math.abs(m.value) >= 100
            ? m.value.toFixed(2)
            : (Math.abs(m.value) >= 0.1 ? m.value.toFixed(3) : m.value.toFixed(4));

        html += `
            <div class="snapshot-card snapshot-${stateClass}">
                <div class="snapshot-head">
                    <span class="snapshot-name" title="${escapeHtml(k)}">${escapeHtml(m.name)} ${m.condition ? `<small>(${escapeHtml(m.condition)})</small>` : ''}</span>
                    <span class="snapshot-status-tag tag-${stateClass}">${statusLabel}</span>
                </div>
                <div class="snapshot-val">${formattedVal} <small>${escapeHtml(m.unit || '')}</small></div>
                <div class="snapshot-bar-track" title="" data-i18n-title="Vị trí giá trị đo trong dải dung sai [LSL - USL]">
                    <div class="snapshot-bar-zone"></div>
                    <div class="snapshot-bar-marker marker-${stateClass}" style="left:${pctPos.toFixed(1)}%;"></div>
                </div>
                <div class="snapshot-spec">
                    <span>LSL: <strong>${hasMin ? m.minLimit : '—'}</strong></span>
                    <span>USL: <strong>${hasMax ? m.maxLimit : '—'}</strong></span>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * Hiển thị Bảng Hồ Sơ Kỹ Thuật Chi Tiết của sản phẩm vừa quét (Task Verdicts, Grades, DB Path, Lịch sử Retest)
 */
function renderDUTDeepInspector(container, record, allRuns, rawScan, status) {
    if (!record) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'block';

    // 1. Danh sách toàn bộ Task Verdicts
    const taskEntries = Object.entries(record.taskVerdicts || {});
    let tasksHtml = '';
    if (taskEntries.length === 0) {
        tasksHtml = `<span style="font-size:11.5px; color:var(--text-muted);">${_t('Không có cột Task rời rạc')}</span>`;
    } else {
        tasksHtml = `<div style="display:flex; flex-wrap:wrap; gap:6px;">`;
        taskEntries.forEach(([tName, vCode]) => {
            const grade = (record.taskGrades && record.taskGrades[tName]) ? ` · Grade ${record.taskGrades[tName]}` : '';
            if (vCode === 1) {
                tasksHtml += `<span class="badge-pill badge-pass" style="font-size:11px;">✓ ${escapeHtml(getMappedName(tName))}${escapeHtml(grade)}</span>`;
            } else if (vCode === 0) {
                const isHidden = !isErrorVisible(tName);
                tasksHtml += `<span class="badge-pill ${isHidden ? 'badge-warn' : 'badge-fail'}" style="font-size:11px;">${isHidden ? _t('🙈 (Đã ẩn)') : '✕'} ${escapeHtml(getMappedName(tName))}${escapeHtml(grade)}</span>`;
            } else {
                tasksHtml += `<span class="badge-pill" style="background:rgba(148,163,184,0.12); color:var(--text-muted); border:1px solid var(--border-color); font-size:11px;">— ${escapeHtml(getMappedName(tName))} (SKIP)</span>`;
            }
        });
        tasksHtml += `</div>`;
    }

    // 2. Bảng lịch sử các lần đo của cùng mã Serial này
    let runsHtml = '';
    if (allRuns && allRuns.length > 1) {
        runsHtml = `
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color);">
                <div style="font-size:11px; font-weight:800; color:var(--accent-cyan); text-transform:uppercase; margin-bottom:8px;">
                    ${_t('🔄 LỊCH SỬ CÁC LƯỢT ĐO CỦA SẢN PHẨM NÀY ({0} LẦN ĐO TRONG HỆ THỐNG)', allRuns.length)}
                </div>
                <div class="table-wrapper">
                    <table class="data-table" style="font-size:11.5px;">
                        <thead>
                            <tr>
                                <th>${_t('Lần Đo')}</th>
                                <th>${_t('Thời Gian')}</th>
                                <th>${_t('Trạm Đo')}</th>
                                <th>${_t('Tệp Nguồn')}</th>
                                <th>${_t('Phán Định')}</th>
                                <th>${_t('Chi Tiết Lỗi / Thông Số')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allRuns.map((r, i) => {
                                const p = isRecordPass(r);
                                const errs = activeErrors(r.errors).map(getMappedName).join(', ');
                                const isCurrent = r.id === record.id;
                                return `
                                    <tr style="${isCurrent ? 'background:rgba(0,242,254,0.08);' : ''}">
                                        <td style="font-family:var(--font-mono); font-weight:700;">${_t('Lần #{0}', i + 1)} ${isCurrent ? `<span style="color:var(--accent-cyan);">(${_t('Đang xem')})</span>` : ''}</td>
                                        <td style="font-family:var(--font-mono);">${r.timestamp ? r.timestamp.toLocaleString('vi-VN', { hour12: false }) : '—'}</td>
                                        <td><strong style="color:var(--accent-blue);">${escapeHtml(r.stationName)}</strong></td>
                                        <td style="color:var(--text-muted);">${escapeHtml(r.fileName)}</td>
                                        <td><span class="badge-pill ${p ? 'badge-pass' : 'badge-fail'}">${p ? 'PASS' : 'FAIL'}</span></td>
                                        <td>${p ? `<span style="color:#10b981;">${_t('Đạt tất cả tiêu chí')}</span>` : `<span style="color:#f87171; font-weight:700;">${escapeHtml(errs || 'Overall FAIL')}</span>`}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="card" style="padding:14px 18px; border-left:4px solid var(--accent-cyan);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; color:var(--accent-cyan); text-transform:uppercase;">${_t('🔬 HỒ SƠ KỸ THUẬT CHI TIẾT DUT')}</span>
                    <span class="meta-chip">${_t('Tệp:')} <strong>${escapeHtml(record.fileName)}</strong></span>
                    ${record.dbPath ? `<span class="meta-chip" title="${escapeHtml(record.dbPath)}">🗄️ DB: <span style="font-family:var(--font-mono);">${escapeHtml(record.dbPath.length > 55 ? '...' + record.dbPath.slice(-52) : record.dbPath)}</span></span>` : ''}
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-secondary" onclick="copyTextSafe('${escapeHtml(record.displayID)}', '${_t('✅ Đã copy mã DUT: {0}', escapeHtml(record.displayID))}')">${_t('📋 Copy Mã DUT')}</button>
                    <button class="btn btn-sm btn-outline" onclick="inspectRecordInModal('${escapeHtml(record.id)}')">${_t('🔍 Mở Cửa Sổ Đầy Đủ')}</button>
                </div>
            </div>
            <div>
                <div style="font-size:10.5px; font-weight:700; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase;">${_t('Trạng Thái Từng Bài Đo Âm Học (Klippel Task Verdicts):')}</div>
                ${tasksHtml}
            </div>
            ${runsHtml}
        </div>
    `;
}

/**
 * Mở Modal hiển thị toàn bộ thông số của 1 bản ghi bất kỳ khi nhấp từ bảng Lịch sử hoặc Đối soát
 */
function inspectRecordInModal(recordId) {
    const rec = timelineData.find(r => r.id === recordId) || lastScannedRecord;
    if (!rec) return;
    const allRuns = findAllRecordsForDUT(rec);
    openMatrixDetailModal(rec.displayID || rec.cleanSN, null, true);
}

/**
 * Xem lại 1 lượt quét trong lịch sử ngay trên Verdict Card & Inspector
 */
function selectScanHistoryItem(index) {
    const item = scanHistory[index];
    if (!item) return;
    if (item.record) {
        const match = findRecordByBarcode(item.rawScan);
        renderVerdictCard(item.isDuplicate ? (item.status + '_DUP') : item.status, item.rawScan, item.record, match);
    } else {
        renderVerdictCard('NOT_FOUND', item.rawScan, null, null);
    }
}

function renderScanHistoryTable() {
    const tbody = document.getElementById('scan-history-tbody');
    const countLabel = document.getElementById('scan-history-count-label');
    if (!tbody) return;

    const filter = liveScanSession.historyFilter || 'ALL';
    const q = (liveScanSession.historySearch || '').toUpperCase();

    const filtered = scanHistory.filter(item => {
        if (filter === 'PASS' && item.status !== 'PASS') return false;
        if (filter === 'FAIL' && item.status !== 'FAIL') return false;
        if (filter === 'DUP' && !item.isDuplicate) return false;
        if (filter === 'NOT_FOUND' && item.status !== 'NOT_FOUND') return false;
        if (q) {
            const hay = `${item.rawScan} ${item.cleanScan} ${item.record ? item.record.stationName : ''} ${item.record ? item.record.modelName : ''}`.toUpperCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (countLabel) {
        countLabel.textContent = `${filtered.length} / ${scanHistory.length} ${_t('lượt')}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:24px;">${scanHistory.length === 0 ? _t('Chưa có lượt quét nào trong phiên. Hãy quét mã vạch hoặc bấm nút [Quét Thử Mẫu] phía trên.') : _t('Không có lượt quét nào khớp với bộ lọc hiện tại.')}</td></tr>`;
        return;
    }

    let html = '';
    filtered.slice(0, 50).forEach((item, idx) => {
        const origIdx = scanHistory.indexOf(item);
        const isPass = item.status === 'PASS';
        const isNotFound = item.status === 'NOT_FOUND';
        const badgeClass = isNotFound ? 'badge-warn' : (isPass ? 'badge-pass' : 'badge-fail');
        const badgeText = isNotFound ? 'NOT FOUND' : (isPass ? 'PASS' : 'FAIL');
        const dupTag = item.isDuplicate ? `<span class="badge-pill badge-warn" style="font-size:9.5px; margin-left:4px;">${_t('LẶP')}</span>` : '';

        const rec = item.record;
        let reVal = '—', fsVal = '—', splVal = '—';
        if (rec && rec.metrics) {
            for (let mk in rec.metrics) {
                const lower = mk.toLowerCase();
                if (lower.startsWith('re') || lower.includes('ohm')) reVal = rec.metrics[mk].value.toFixed(2);
                else if (lower.startsWith('fs') || lower.includes('hz')) fsVal = rec.metrics[mk].value.toFixed(1);
                else if (lower.includes('level') || lower.includes('spl') || lower.includes('sens')) splVal = rec.metrics[mk].value.toFixed(2);
            }
        }

        const errText = (rec && !isPass && rec.errors && rec.errors.length > 0)
            ? activeErrors(rec.errors).map(getMappedName).join(', ')
            : (isNotFound ? _t('Không có bản ghi log') : _t('Đạt 100%'));

        html += `
            <tr style="cursor:pointer;" onclick="selectScanHistoryItem(${origIdx})" title="" data-i18n-title="Nhấp để xem lại toàn bộ hồ sơ đo của lượt quét này">
                <td style="text-align:center; font-weight:700; color:var(--text-muted);">${scanHistory.length - origIdx}</td>
                <td style="font-family:var(--font-mono); color:var(--text-muted); font-size:11.5px;">${item.time}</td>
                <td style="font-weight:700; font-family:var(--font-mono); color:var(--text-main);">
                    ${escapeHtml(item.rawScan)}
                    ${rec && rec.modelName ? `<div style="font-size:10px; color:var(--text-muted);">Model: ${escapeHtml(rec.modelName)}</div>` : ''}
                </td>
                <td><span style="font-weight:700; color:var(--accent-blue);">${rec ? escapeHtml(rec.stationName) : '—'}</span></td>
                <td style="font-family:var(--font-mono); text-align:right;">${reVal}</td>
                <td style="font-family:var(--font-mono); text-align:right;">${fsVal}</td>
                <td style="font-family:var(--font-mono); text-align:right;">${splVal}</td>
                <td><span class="badge-pill ${badgeClass}">${badgeText}</span>${dupTag}</td>
                <td style="font-size:11px; color:${isPass ? 'var(--text-muted)' : '#fca5a5'}; max-width:190px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(errText)}">${escapeHtml(errText)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function renderScanStatsOverview() {
    const scTotal = document.getElementById('sc-total-count');
    const scPass = document.getElementById('sc-pass-count');
    const scFail = document.getElementById('sc-fail-count');
    const scYield = document.getElementById('sc-yield-rate');
    const banner = document.getElementById('scan-no-log-banner');

    // Cập nhật thống kê phiên quét trực tiếp (Live Session KPIs)
    const sesTotalEl = document.getElementById('ses-total-count');
    const sesPassEl = document.getElementById('ses-pass-count');
    const sesFailEl = document.getElementById('ses-fail-count');
    const sesDupEl = document.getElementById('ses-dup-count');
    const sesNfEl = document.getElementById('ses-nf-count');
    const sesPaceEl = document.getElementById('ses-pace-val');

    if (banner) {
        banner.style.display = (loadedFilesMap.size === 0) ? 'flex' : 'none';
    }

    if (scTotal) scTotal.textContent = filteredTimelineData.length.toLocaleString();
    if (scPass) scPass.textContent = analysisData.passCount.toLocaleString();
    if (scFail) scFail.textContent = analysisData.failCount.toLocaleString();
    if (scYield) scYield.textContent = (analysisData.finalPassRate || 0).toFixed(1) + '%';

    if (sesTotalEl) sesTotalEl.textContent = liveScanSession.totalScans.toLocaleString();
    if (sesPassEl) sesPassEl.textContent = liveScanSession.passScans.toLocaleString();
    if (sesFailEl) sesFailEl.textContent = liveScanSession.failScans.toLocaleString();
    if (sesDupEl) sesDupEl.textContent = liveScanSession.dupScans.toLocaleString();
    if (sesNfEl) sesNfEl.textContent = liveScanSession.notFoundScans.toLocaleString();

    if (sesPaceEl) {
        const ts = liveScanSession.timestamps;
        if (ts.length >= 2) {
            const avgSec = ((ts[ts.length - 1] - ts[0]) / (ts.length - 1)) / 1000;
            sesPaceEl.textContent = avgSec < 60 ? `${avgSec.toFixed(1)}${_t('s/mã')}` : '—';
        } else {
            sesPaceEl.textContent = '—';
        }
    }

    // Cập nhật dropdown lọc trạm đo tại màn hình Scan nếu có
    const stSelect = document.getElementById('scan-station-filter');
    if (stSelect) {
        const stations = Array.from(new Set(Array.from(loadedFilesMap.values()).filter(f => f.active).map(f => f.stationName)));
        const cur = liveScanSession.stationFilter || 'ALL';
        let opts = `<option value="ALL" ${cur === 'ALL' ? 'selected' : ''}>${_t('🏭 Tất cả trạm đo ({0})', stations.length)}</option>`;
        stations.forEach(s => {
            opts += `<option value="${escapeHtml(s)}" ${cur === s ? 'selected' : ''}>${_t('Trạm: {0}', escapeHtml(s))}</option>`;
        });
        stSelect.innerHTML = opts;
    }

    // Khởi tạo dải 6 thẻ thông số nếu chưa quét lần nào
    const snapshotContainer = document.getElementById('parametric-snapshot-container');
    if (snapshotContainer && !lastScannedRecord && snapshotContainer.innerHTML.trim() === '') {
        renderParametricSnapshotBand(snapshotContainer, null);
    }
}

function resetLiveScanSessionStats() {
    liveScanSession.totalScans = 0;
    liveScanSession.passScans = 0;
    liveScanSession.failScans = 0;
    liveScanSession.dupScans = 0;
    liveScanSession.notFoundScans = 0;
    liveScanSession.timestamps = [];
    currentScannedSerialsSet.clear();
    renderScanStatsOverview();
    showToast(_t('✓ Đã đặt lại bộ đếm phiên quét hiện tại'), 'info');
}

/**
 * Xuất Lịch Sử Quét Trực Tiếp ra tệp CSV / Excel
 */
function exportScanHistoryExcel() {
    if (!scanHistory || scanHistory.length === 0) {
        showToast(_t('⚠️ Chưa có lượt quét nào để xuất.'), 'warning');
        return;
    }

    let csv = '\uFEFF' + [_t('STT'), _t('Thời Gian'), _t('Mã Quét Thô'), _t('Serial Chuẩn Hóa'), _t('Trạng Thái'), _t('Quét Lặp'), _t('Trạm Đo'), 'Model', 'Re (Ω)', 'fs (Hz)', 'SPL (dB)', _t('Lỗi Chi Tiết')].join(',') + '\n';
    scanHistory.forEach((item, idx) => {
        const rec = item.record;
        let reVal = '', fsVal = '', splVal = '';
        if (rec && rec.metrics) {
            for (let mk in rec.metrics) {
                const lower = mk.toLowerCase();
                if (lower.startsWith('re') || lower.includes('ohm')) reVal = rec.metrics[mk].value;
                else if (lower.startsWith('fs') || lower.includes('hz')) fsVal = rec.metrics[mk].value;
                else if (lower.includes('level') || lower.includes('spl') || lower.includes('sens')) splVal = rec.metrics[mk].value;
            }
        }
        const errs = (rec && rec.errors) ? activeErrors(rec.errors).map(getMappedName).join('; ') : '';
        csv += `${idx + 1},"${item.time}","${item.rawScan}","${item.cleanScan}","${item.status}","${item.isDuplicate ? 'YES' : 'NO'}","${rec ? rec.stationName : ''}","${rec ? (rec.modelName || '') : ''}","${reVal}","${fsVal}","${splVal}","${errs}"\n`;
    });

    downloadBlobFile(csv, `QIT_Live_Scan_History_${toLocalDateStr(new Date())}.csv`, 'text/csv;charset=utf-8');
    showToast(_t('✅ Đã xuất lịch sử quét thành công!'), 'success');
}
