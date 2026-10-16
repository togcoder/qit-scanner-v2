/* ════════════ GIAO DIỆN QUÉT SẢN XUẤT THỜI GIAN THỰC (LIVE SCAN UI) V2 ════════════ */

let lastScannedRecord = null;
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

function handleScanBarcode(rawBarcode) {
    const cleanScan = getAlphaNum(rawBarcode);
    if (!cleanScan || cleanScan.length < CFG.MIN_SCAN_LEN) {
        showToast('⚠️ ' + _t('Mã quét quá ngắn hoặc không hợp lệ'), 'warning');
        return;
    }

    const match = findRecordByBarcode(rawBarcode);
    const historyEntry = {
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        rawScan: rawBarcode,
        cleanScan: cleanScan,
        status: 'NOT_FOUND',
        record: null
    };

    if (!match) {
        // KHÔNG TÌM THẤY DỮ LIỆU
        renderVerdictCard('NOT_FOUND', rawBarcode, null);
        playScanSound('NOT_FOUND');
        recordRobotStats(1, 0, 0, 1);
        historyEntry.status = 'NOT_FOUND';
        if (loadedFilesMap.size === 0) {
            showToast('ℹ️ Chưa có tệp log Klippel để đối chiếu kết quả đo. Bấm [🎯 KIỂM TRA DANH SÁCH] nếu bạn muốn đối soát danh sách.', 'info');
        }
    } else {
        const rec = match.record;
        const isPass = isRecordPass(rec);
        const isDuplicate = currentScannedSerialsSet.has(rec.cleanSN);

        currentScannedSerialsSet.add(rec.cleanSN);
        lastScannedRecord = rec;

        if (isDuplicate) {
            renderVerdictCard(isPass ? 'PASS_DUP' : 'FAIL_DUP', rawBarcode, rec);
            playScanSound('DUPLICATE');
        } else {
            renderVerdictCard(isPass ? 'PASS' : 'FAIL', rawBarcode, rec);
            playScanSound(isPass ? 'PASS' : 'FAIL');
        }

        recordRobotStats(1, isPass ? 1 : 0, isPass ? 0 : 1, 0);
        historyEntry.status = isPass ? 'PASS' : 'FAIL';
        historyEntry.record = rec;
    }

    // Thêm vào lịch sử quét gần đây
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
 * Hiển thị thẻ phán định cực lớn (Verdict Band)
 */
function renderVerdictCard(status, rawScan, record) {
    const band = document.getElementById('verdict-band');
    const mark = document.getElementById('verdict-mark');
    const title = document.getElementById('verdict-title');
    const sub = document.getElementById('verdict-sub');
    const detailDrawer = document.getElementById('verdict-details');

    if (!band || !mark || !title) return;

    band.className = 'verdict-band';
    detailDrawer.innerHTML = '';

    if (status === 'PASS' || status === 'PASS_DUP') {
        band.classList.add('verdict-pass');
        mark.style.display = 'flex';
        mark.innerHTML = '✓';
        title.innerHTML = _t('SẢN PHẨM ĐẠT CHUẨN') + (status === 'PASS_DUP' ? ' <span class="badge-dup">(' + _t('TRÙNG LẶP / ĐÃ QUÉT') + ')</span>' : '');
        sub.innerHTML = `SN: <strong>${escapeHtml(record ? record.displayID : rawScan)}</strong> | Trạm: <strong>${escapeHtml(record ? record.stationName : '—')}</strong> | Giờ đo: <strong>${record && record.timestamp ? record.timestamp.toLocaleString() : '—'}</strong>`;

        renderParametricSnapshotInVerdict(detailDrawer, record);
    } else if (status === 'FAIL' || status === 'FAIL_DUP') {
        band.classList.add('verdict-fail');
        mark.style.display = 'flex';
        mark.innerHTML = '✕';
        title.innerHTML = _t('SẢN PHẨM LỖI') + (status === 'FAIL_DUP' ? ' <span class="badge-dup">(' + _t('TRÙNG LẶP / ĐÃ QUÉT') + ')</span>' : '');
        sub.innerHTML = `SN: <strong>${escapeHtml(record ? record.displayID : rawScan)}</strong> | Trạm: <strong>${escapeHtml(record ? record.stationName : '—')}</strong> | Giờ đo: <strong>${record && record.timestamp ? record.timestamp.toLocaleString() : '—'}</strong>`;

        // Render các lỗi phát hiện
        let errBadges = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin:8px 0;">';
        const actErrs = record ? activeErrors(record.errors) : [];
        if (actErrs.length > 0) {
            actErrs.forEach(err => {
                errBadges += `<span class="badge-pill badge-fail">⚠️ ${escapeHtml(getMappedName(err))}</span>`;
            });
        } else {
            errBadges += `<span class="badge-pill badge-fail">⚠️ Verdict Overall FAIL</span>`;
        }
        errBadges += '</div>';

        detailDrawer.innerHTML = errBadges;
        renderParametricSnapshotInVerdict(detailDrawer, record);
    } else if (status === 'NOT_FOUND') {
        band.classList.add('verdict-notfound');
        mark.style.display = 'flex';
        mark.innerHTML = '?';
        title.innerHTML = _t('KHÔNG TÌM THẤY DỮ LIỆU');
        sub.innerHTML = `Mã quét: <strong>${escapeHtml(rawScan)}</strong> — ${_t('Không có bản ghi nào khớp trong các tệp log đã nạp.')}`;
    } else {
        band.classList.add('verdict-idle');
        mark.style.display = 'none';
        title.innerHTML = _t('CHỜ QUÉT…');
        sub.innerHTML = _t('Thẻ phán định sẽ hiển thị ngay khi nhận được serial từ đầu đọc.');
    }
}

/**
 * Hiển thị các thông số đo vật lý quan trọng ngay trên thẻ kết quả
 */
function renderParametricSnapshotInVerdict(container, record) {
    if (!record || !record.metrics || Object.keys(record.metrics).length === 0) return;

    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-top:10px;">';
    const metricKeys = Object.keys(record.metrics);

    metricKeys.slice(0, 6).forEach(k => {
        const m = record.metrics[k];
        const hasMin = m.minLimit !== null;
        const hasMax = m.maxLimit !== null;
        let isOutOfSpec = false;
        if (hasMin && m.value < m.minLimit) isOutOfSpec = true;
        if (hasMax && m.value > m.maxLimit) isOutOfSpec = true;

        const valColor = isOutOfSpec ? '#ef4444' : '#10b981';
        const bgBox = isOutOfSpec ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)';
        const borderBox = isOutOfSpec ? 'rgba(239,68,68,0.4)' : 'var(--border-color)';

        html += `
            <div style="background:${bgBox}; border:1px solid ${borderBox}; border-radius:8px; padding:8px 10px;">
                <div style="font-size:10px; font-weight:700; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.name)}</div>
                <div style="font-size:15px; font-weight:800; font-family:var(--font-mono); color:${valColor}; margin:2px 0;">
                    ${m.value >= 100 ? m.value.toFixed(1) : (m.value >= 1 ? m.value.toFixed(2) : m.value.toExponential(2))} <span style="font-size:10px; color:var(--text-muted);">${escapeHtml(m.unit)}</span>
                </div>
                <div style="font-size:9.5px; color:var(--text-sub); font-family:var(--font-mono);">LSL:${hasMin ? m.minLimit : '—'} | USL:${hasMax ? m.maxLimit : '—'}</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML += html;
}

function renderScanHistoryTable() {
    const tbody = document.getElementById('scan-history-tbody');
    if (!tbody) return;

    if (scanHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:16px;">${_t('Chưa có lượt quét nào')}</td></tr>`;
        return;
    }

    let html = '';
    scanHistory.slice(0, 20).forEach((item, idx) => {
        const isPass = item.status === 'PASS';
        const isNotFound = item.status === 'NOT_FOUND';
        const badgeClass = isNotFound ? 'badge-warn' : (isPass ? 'badge-pass' : 'badge-fail');
        const badgeText = isNotFound ? 'NOT FOUND' : (isPass ? 'PASS' : 'FAIL');

        const rec = item.record;
        let reVal = '—', fsVal = '—', splVal = '—';
        if (rec && rec.metrics) {
            for (let mk in rec.metrics) {
                const lower = mk.toLowerCase();
                if (lower.startsWith('re') || lower.includes('ohm')) reVal = rec.metrics[mk].value.toFixed(2);
                else if (lower.startsWith('fs') || lower.includes('hz')) fsVal = rec.metrics[mk].value.toFixed(1);
                else if (lower.includes('level') || lower.includes('spl') || lower.includes('sens')) splVal = rec.metrics[mk].value.toFixed(1);
            }
        }

        html += `
            <tr>
                <td style="text-align:center; font-weight:700; color:var(--text-muted);">${idx + 1}</td>
                <td style="font-family:var(--font-mono); color:var(--text-muted); font-size:11.5px;">${item.time}</td>
                <td style="font-weight:700; font-family:var(--font-mono); color:var(--text-main);">${escapeHtml(item.rawScan)}</td>
                <td><span style="font-weight:700; color:var(--accent-blue);">${rec ? escapeHtml(rec.stationName) : '—'}</span></td>
                <td style="font-family:var(--font-mono);">${reVal}</td>
                <td style="font-family:var(--font-mono);">${fsVal}</td>
                <td style="font-family:var(--font-mono);">${splVal}</td>
                <td><span class="badge-pill ${badgeClass}">${badgeText}</span></td>
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

    if (banner) {
        banner.style.display = (loadedFilesMap.size === 0) ? 'flex' : 'none';
    }

    if (scTotal) scTotal.textContent = filteredTimelineData.length.toLocaleString();
    if (scPass) scPass.textContent = analysisData.passCount.toLocaleString();
    if (scFail) scFail.textContent = analysisData.failCount.toLocaleString();
    if (scYield) scYield.textContent = (analysisData.finalPassRate || 0).toFixed(1) + '%';
}

/**
 * Xuất Lịch Sử Quét Trực Tiếp ra tệp CSV / Excel
 */
function exportScanHistoryExcel() {
    if (!scanHistory || scanHistory.length === 0) {
        showToast('⚠️ Chưa có lượt quét nào để xuất.', 'warning');
        return;
    }

    let csv = '\uFEFFSTT,Thời Gian,Mã Quét Thô,Serial Chuẩn Hóa,Trạng Thái,Trạm Đo,Re (Ω),fs (Hz),SPL (dB)\n';
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
        csv += `${idx + 1},"${item.time}","${item.rawScan}","${item.cleanScan}","${item.status}","${rec ? rec.stationName : ''}","${reVal}","${fsVal}","${splVal}"\n`;
    });

    downloadBlobFile(csv, `QIT_Live_Scan_History_${toLocalDateStr(new Date())}.csv`, 'text/csv;charset=utf-8');
    showToast('✅ Đã xuất lịch sử quét thành công!', 'success');
}
