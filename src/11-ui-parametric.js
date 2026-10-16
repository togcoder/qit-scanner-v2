/* ════════════ GIAO DIỆN PHÂN TÍCH THÔNG SỐ ĐO & NĂNG LỰC CPK (PARAMETRIC UI) V2 PRO ════════════ */

function renderParametricDashboard() {
    renderMetricSelectorDropdown();
    const area = document.getElementById('parametric-content-area');
    if (loadedFilesMap.size === 0 || parametricAnalysisMap.size === 0) {
        if (area) {
            area.innerHTML = `
                <div class="card" style="padding:48px 24px; text-align:center; max-width:720px; margin:20px auto;">
                    <div style="font-size:48px; margin-bottom:14px;">📈</div>
                    <h3 style="font-size:17px; font-weight:900; margin:0 0 8px; color:var(--text-main);">${_t('CHƯA CÓ DỮ LIỆU THÔNG SỐ ĐO VẬT LÝ & CPK')}</h3>
                    <p style="font-size:12.5px; color:var(--text-muted); line-height:1.6; margin:0 auto 24px;">
                        ${_t('Tính năng Phân Tích Thông Số & Cpk khai thác các giá trị đo vật lý liên tục ($R_e, f_s, Q_{ts}$, SPL, THD...) từ tệp nhật ký Klippel để tính toán độ lệch chuẩn Gauss, $C_p, C_{pk}, P_{pk}$ và phát hiện sản phẩm cận biên LSL/USL.')}
                    </p>
                    <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="loadBuiltInDemoKlippelLogs()" style="padding:10px 22px; font-weight:800; font-size:13px;">
                            ${_t('🧪 Nạp Bộ Dữ Liệu Mẫu Klippel (3 Trạm · Cpk 6-Sigma)')}
                        </button>
                        <button class="btn btn-outline" onclick="startFastDirectoryScan()" style="padding:10px 20px; font-size:13px;">
                            ${_t('📁 Quét Thư Mục Summary')}
                        </button>
                        <button class="btn btn-secondary" onclick="document.getElementById('file-input').click()" style="padding:10px 20px; font-size:13px;">
                            ${_t('📄 Chọn Tệp Log (.log, .txt, .csv)')}
                        </button>
                    </div>
                </div>
            `;
        }
        return;
    }
    renderSelectedMetricCpk();
}

/**
 * Tạo danh sách chọn thông số đo (Metric Selector Dropdown)
 */
function renderMetricSelectorDropdown() {
    const selectEl = document.getElementById('parametric-metric-select');
    if (!selectEl) return;

    const prevVal = selectEl.value;
    selectEl.innerHTML = '';

    if (parametricAnalysisMap.size === 0) {
        selectEl.innerHTML = `<option value="">(${_t('Không có thông số đo liên tục')})</option>`;
        return;
    }

    parametricAnalysisMap.forEach((m, key) => {
        const opt = document.createElement('option');
        opt.value = key;
        const cpkTxt = m.cpk !== null ? ` · Cpk=${m.cpk.toFixed(2)}` : '';
        opt.textContent = `${m.name} ${m.condition ? '(' + m.condition + ')' : ''} [${m.unit || '—'}] — ${m.count} ${_t('mẫu')}${cpkTxt}`;
        selectEl.appendChild(opt);
    });

    if (currentSelectedMetric && parametricAnalysisMap.has(currentSelectedMetric)) {
        selectEl.value = currentSelectedMetric;
    } else if (prevVal && parametricAnalysisMap.has(prevVal)) {
        selectEl.value = prevVal;
        currentSelectedMetric = prevVal;
    } else {
        currentSelectedMetric = selectEl.value;
    }
}

function onParametricMetricChange(val) {
    currentSelectedMetric = val;
    const selectEl = document.getElementById('parametric-metric-select');
    if (selectEl && selectEl.value !== val) selectEl.value = val;
    renderSelectedMetricCpk();
}

function setParametricFilterMode(mode) {
    CFG.CPK_DATA_FILTER = mode;
    try {
        localStorage.setItem(LS.CFG_CUSTOM, JSON.stringify(CFG));
    } catch(e) {}
    calculateParametricCpkStats();
    renderSelectedMetricCpk();
    showToast(_t('✓ Đã chuyển chế độ dữ liệu Cpk: {0}', mode === 'PASS_ONLY' ? _t('Chỉ SP ĐẠT (Chuẩn SPC)') : (mode === 'TRIMMED_3SIGMA' ? _t('Lọc dị biệt 3-Sigma') : _t('Toàn bộ sản phẩm'))), 'info');
}

/**
 * Render bảng tổng hợp toàn bộ các thông số đo liên tục (All-Parameters SPC Matrix)
 */
function renderAllMetricsSummaryMatrix() {
    let rowsHtml = '';
    parametricAnalysisMap.forEach((item, key) => {
        const isSelected = key === currentSelectedMetric;
        let badge = `<span class="badge-pill" style="background:rgba(148,163,184,0.12); color:var(--text-muted);">N/A</span>`;
        let cpkCol = 'var(--text-muted)';
        if (item.cpk !== null) {
            if (item.cpk >= CFG.CPK_EXCELLENT) {
                badge = `<span class="badge-pill badge-pass">🌟 6-Sigma (&ge;${CFG.CPK_EXCELLENT})</span>`;
                cpkCol = '#10b981';
            } else if (item.cpk >= CFG.CPK_CAPABLE) {
                badge = `<span class="badge-pill" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.35);">${_t('✓ Đạt')} (&ge;${CFG.CPK_CAPABLE})</span>`;
                cpkCol = '#38bdf8';
            } else if (item.cpk >= CFG.CPK_MARGINAL) {
                badge = `<span class="badge-pill badge-warn">${_t('⚠️ Cận biên')}</span>`;
                cpkCol = '#f59e0b';
            } else {
                badge = `<span class="badge-pill badge-fail">${_t('✕ Kém (<1.00)')}</span>`;
                cpkCol = '#ef4444';
            }
        }
        const nfLen = item.nearFailList ? item.nearFailList.length : 0;

        rowsHtml += `
            <tr style="cursor:pointer; ${isSelected ? 'background:rgba(0,242,254,0.10); border-left:3px solid var(--accent-cyan);' : ''}" onclick="onParametricMetricChange('${escapeHtml(key)}')" title="" data-i18n-title="Nhấp để xem biểu đồ phân phối Gauss & danh sách cận biên của thông số này">
                <td style="font-weight:800; color:${isSelected ? 'var(--accent-cyan)' : 'var(--text-main)'};">
                    ${isSelected ? '▶ ' : ''}${escapeHtml(item.name)}
                    ${item.condition ? `<span style="font-size:10.5px; color:var(--text-muted); font-family:var(--font-mono);"> (${escapeHtml(item.condition)})</span>` : ''}
                </td>
                <td style="text-align:center; font-family:var(--font-mono); color:var(--accent-blue); font-weight:700;">${escapeHtml(item.unit || '—')}</td>
                <td style="text-align:center; font-family:var(--font-mono);">${item.count}</td>
                <td style="text-align:right; font-family:var(--font-mono); color:var(--text-muted);">${item.lsl !== null ? item.lsl : '—'}</td>
                <td style="text-align:right; font-family:var(--font-mono); font-weight:700;">${item.mean.toFixed(3)}</td>
                <td style="text-align:right; font-family:var(--font-mono); color:var(--text-muted);">${item.usl !== null ? item.usl : '—'}</td>
                <td style="text-align:right; font-family:var(--font-mono);">${item.stdDev.toFixed(4)}</td>
                <td style="text-align:right; font-family:var(--font-mono);">${item.cp !== null ? item.cp.toFixed(2) : '—'}</td>
                <td style="text-align:right; font-family:var(--font-mono); font-weight:900; font-size:13px; color:${cpkCol};">${item.cpk !== null ? item.cpk.toFixed(2) : '—'}</td>
                <td style="text-align:right; font-family:var(--font-mono); color:var(--text-muted);">${item.kFactor !== null ? (item.kFactor * 100).toFixed(1) + '%' : '—'}</td>
                <td style="text-align:center; font-family:var(--font-mono); font-weight:800; color:${nfLen > 0 ? '#f59e0b' : 'var(--text-muted)'};">${nfLen}</td>
                <td style="text-align:center;">${badge}</td>
            </tr>
        `;
    });

    return `
        <div class="card" style="padding:16px 18px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <div>
                    <div style="font-size:12px; font-weight:800; text-transform:uppercase; color:var(--accent-cyan); letter-spacing:0.06em;">
                        ${_t('📋 BẢNG TỔNG HỢP NĂNG LỰC QUY TRÌNH TOÀN BỘ THÔNG SỐ (ALL-PARAMETER SPC MATRIX)')}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">${_t('Nhấp vào bất kỳ dòng thông số nào dưới đây để chuyển biểu đồ Histogram Gauss và danh sách Cận biên')}</div>
                </div>
                <span class="meta-chip">${_t('{0} thông số liên tục', parametricAnalysisMap.size)}</span>
            </div>
            <div class="table-wrapper" style="max-height:240px; overflow-y:auto;">
                <table class="data-table" style="font-size:11.5px;">
                    <thead>
                        <tr>
                            <th>${_t('Thông Số Đo (Điều Kiện)')}</th>
                            <th style="text-align:center;">${_t('Đơn Vị')}</th>
                            <th style="text-align:center;">${_t('Mẫu (n)')}</th>
                            <th style="text-align:right;">LSL (Min)</th>
                            <th style="text-align:right;">Mean (μ)</th>
                            <th style="text-align:right;">USL (Max)</th>
                            <th style="text-align:right;">StdDev (σ)</th>
                            <th style="text-align:right;">Cp</th>
                            <th style="text-align:right;">Cpk</th>
                            <th style="text-align:right;">${_t('Lệch Tâm (k)')}</th>
                            <th style="text-align:center;">${_t('Cận Biên')}</th>
                            <th style="text-align:center;">${_t('Phân Hạng SPC')}</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Hiển thị thẻ thống kê Cpk, biểu đồ Histogram và Cảnh báo cận biên của thông số được chọn
 */
function renderSelectedMetricCpk() {
    const container = document.getElementById('parametric-content-area');
    if (!container) return;

    if (!currentSelectedMetric || !parametricAnalysisMap.has(currentSelectedMetric)) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-muted);">
                <div style="font-size:36px; margin-bottom:12px;">📊</div>
                <div>${_t('Chưa có dữ liệu thông số đo liên tục để phân tích Cpk.')}</div>
            </div>
        `;
        return;
    }

    const m = parametricAnalysisMap.get(currentSelectedMetric);

    let ratingBadge = '';
    let ratingColor = '#94a3b8';
    if (m.cpk !== null) {
        if (m.cpk >= CFG.CPK_EXCELLENT) {
            ratingBadge = _t('🌟 XUẤT SẮC (6-SIGMA CLASS)');
            ratingColor = '#10b981';
        } else if (m.cpk >= CFG.CPK_CAPABLE) {
            ratingBadge = _t('✓ ĐẠT NĂNG LỰC (CAPABLE)');
            ratingColor = '#38bdf8';
        } else if (m.cpk >= CFG.CPK_MARGINAL) {
            ratingBadge = _t('⚠️ CẬN BIÊN (MARGINAL)');
            ratingColor = '#f59e0b';
        } else {
            ratingBadge = _t('✕ KHÔNG ĐẠT (INCAPABLE)');
            ratingColor = '#ef4444';
        }
    } else {
        ratingBadge = _t('KHÔNG CÓ DUNG SAI LSL/USL');
    }

    const fmt = num => (typeof num === 'number' && !isNaN(num)) ? (Math.abs(num) >= 100 ? num.toFixed(2) : (Math.abs(num) >= 0.01 ? num.toFixed(4) : num.toExponential(3))) : '—';
    const curFilter = m.filterMode || CFG.CPK_DATA_FILTER || 'PASS_ONLY';

    let html = `
        <!-- BẢNG MA TRẬN TỔNG HỢP TẤT CẢ THÔNG SỐ -->
        ${renderAllMetricsSummaryMatrix()}

        <!-- THANH CHỌN NGUỒN DỮ LIỆU TÍNH TOÁN CPK THEO CHUẨN SPC -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding:10px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:10px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:12px; flex-wrap:wrap;">
                <span style="font-weight:800; color:var(--accent-blue);">${_t('🎯 NGUỒN DỮ LIỆU TÍNH CPK:')}</span>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-sm ${curFilter === 'PASS_ONLY' ? 'btn-primary' : 'btn-outline'}" onclick="setParametricFilterMode('PASS_ONLY')" title="${_t('Loại bỏ các mẫu rơi rớt / hở mạch ngoại lai để tính đúng độ biến thiên tự nhiên của máy')}">
                        ${_t('✓ Chỉ SP ĐẠT (Chuẩn SPC)')}
                    </button>
                    <button class="btn btn-sm ${curFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}" onclick="setParametricFilterMode('ALL')" title="${_t('Tính trên 100% sản phẩm gồm cả hàng hỏng')}">
                        ${_t('Toàn Bộ Sản Phẩm')}
                    </button>
                    <button class="btn btn-sm ${curFilter === 'TRIMMED_3SIGMA' ? 'btn-primary' : 'btn-outline'}" onclick="setParametricFilterMode('TRIMMED_3SIGMA')" title="${_t('Tự động loại bỏ giá trị dị biệt vượt ngoài 3-Sigma')}">
                        ${_t('Lọc Dị Biệt 3-Sigma')}
                    </button>
                </div>
            </div>
            <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">
                ${_t('Đang phân tích:')} <strong style="color:var(--accent-cyan);">${escapeHtml(m.name)}</strong> · ${_t('Mẫu:')} <strong>${m.count}</strong> / ${_t('Tổng:')} <strong>${m.totalCount}</strong> (${_t('Đạt:')} ${m.passCount})
            </div>
        </div>

        <!-- DÒNG 1: CÁC THẺ KPI THỐNG KÊ & CPK -->
        <div class="cpk-kpi-grid">
            <div class="cpk-card highlight-card" style="border-top-color:${ratingColor};">
                <div class="cpk-label">${_t('CHỈ SỐ NĂNG LỰC CPK ({0})', escapeHtml(m.name))}</div>
                <div class="cpk-val" style="color:${ratingColor};">${m.cpk !== null ? m.cpk.toFixed(2) : '—'}</div>
                <div class="cpk-sub" style="color:${ratingColor}; font-weight:700;">${ratingBadge}</div>
            </div>

            <div class="cpk-card">
                <div class="cpk-label">${_t('NĂNG LỰC TIỀM NĂNG (CP) / HIỆU SUẤT (PPK)')}</div>
                <div class="cpk-val">${m.cp !== null ? m.cp.toFixed(2) : '—'} <span style="font-size:13px; color:var(--text-muted); font-weight:600;">(Ppk: ${m.ppk !== null ? m.ppk.toFixed(2) : '—'})</span></div>
                <div class="cpk-sub">Cpl: ${m.cpl !== null ? m.cpl.toFixed(2) : '—'} | Cpu: ${m.cpu !== null ? m.cpu.toFixed(2) : '—'}</div>
            </div>

            <div class="cpk-card">
                <div class="cpk-label">${_t('GIÁ TRỊ TRUNG BÌNH (MEAN) & ĐỘ LỆCH TÂM (k)')}</div>
                <div class="cpk-val">${fmt(m.mean)} <span class="unit-mini">${escapeHtml(m.unit)}</span></div>
                <div class="cpk-sub">${_t('Độ lệch chuẩn σ: {0}', fmt(m.stdDev))} ${m.kFactor !== null ? '| k: ' + (m.kFactor * 100).toFixed(1) + '%' : ''}</div>
            </div>

            <div class="cpk-card">
                <div class="cpk-label">${_t('GIỚI HẠN DUNG SAI (LSL / USL)')}</div>
                <div class="cpk-val">${m.lsl !== null ? fmt(m.lsl) : '—'} / ${m.usl !== null ? fmt(m.usl) : '—'}</div>
                <div class="cpk-sub">${_t('Thực tế Min:')} ${fmt(m.min)} | Max: ${fmt(m.max)}</div>
            </div>
        </div>

        <!-- DÒNG 2: BIỂU ĐỒ PHÂN PHỐI HISTOGRAM & GAUSS KÈM VẠCH LSL/USL -->
        <div class="card" style="margin-top:16px; padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <div style="font-weight:800; font-size:13.5px; text-transform:uppercase; letter-spacing:0.5px;">
                    ${_t('📈 BIỂU ĐỒ PHÂN PHỐI HISTOGRAM & ĐƯỜNG CONG GAUSS —')} <span style="color:var(--accent-cyan);">${escapeHtml(m.name)} ${m.condition ? '(' + escapeHtml(m.condition) + ')' : ''}</span>
                </div>
                <div style="display:flex; gap:14px; font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">
                    <span style="color:#38bdf8;">${_t('■ Tần suất mẫu (n={0})', m.count)}</span>
                    <span style="color:#f59e0b;">${_t('— Chuẩn Gauss N(μ,σ)')}</span>
                    <span style="color:#ef4444;">┆ LSL: ${m.lsl !== null ? m.lsl : '—'} / USL: ${m.usl !== null ? m.usl : '—'}</span>
                    <span style="color:#10b981;">┆ Mean μ: ${m.mean.toFixed(3)}</span>
                </div>
            </div>
            <div style="position:relative; height:320px; width:100%;">
                <canvas id="histogram-chart-canvas"></canvas>
            </div>
        </div>

        <!-- DÒNG 3: BẢNG CẢNH BÁO CẬN BIÊN LỖI (NEAR-FAIL WARNINGS) -->
        <div class="card" style="margin-top:16px; padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <div>
                    <div style="font-weight:800; font-size:13.5px; text-transform:uppercase; color:#f59e0b;">
                        ${_t('⚠️ DANH SÁCH SẢN PHẨM CẬN BIÊN DUNG SAI (NEAR-FAIL: {0} SP)', m.nearFailList.length)}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                        ${_t('Các mẫu PASS nhưng giá trị đo nằm sát mép giới hạn LSL/USL trong biên độ cảnh báo sớm {0}%', CFG.NEAR_FAIL_MARGIN_PCT)}
                    </div>
                </div>
                ${m.nearFailList && m.nearFailList.length > 0 ? `
                    <button class="btn btn-sm btn-outline" onclick="copyNearFailSerials()">${_t('📋 Copy {0} Mã Cận Biên', m.nearFailList.length)}</button>
                ` : ''}
            </div>

            <div class="table-wrapper" style="max-height:280px; overflow-y:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px; text-align:center;">STT</th>
                            <th>${_t('Mã Serial Number / DUT')}</th>
                            <th>${_t('Giá Trị Đo Thực Tế')}</th>
                            <th>${_t('Cảnh Báo Giới Hạn')}</th>
                            <th>${_t('Khoảng Cách An Toàn')}</th>
                            <th>${_t('Trạm Đo')}</th>
                            <th>${_t('Thời Gian Đo')}</th>
                            <th style="text-align:center;">${_t('Hồ Sơ')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderNearFailTableRows(m)}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
    renderHistogramChart(m);
}

function copyNearFailSerials() {
    if (!currentSelectedMetric || !parametricAnalysisMap.has(currentSelectedMetric)) return;
    const m = parametricAnalysisMap.get(currentSelectedMetric);
    if (!m.nearFailList || m.nearFailList.length === 0) return;
    const sns = m.nearFailList.map(it => it.displayID || it.serialNo);
    copyTextSafe(sns.join('\n'), _t('📋 Đã sao chép {0} mã cận biên của thông số {1}!', sns.length, m.name));
}

function renderNearFailTableRows(m) {
    if (!m.nearFailList || m.nearFailList.length === 0) {
        return `<tr><td colspan="8" style="text-align:center; color:#10b981; padding:18px; font-weight:600;">✓ ${_t('Toàn bộ sản phẩm nằm an toàn trong vùng dung sai tối ưu (không có mẫu cận biên).')}</td></tr>`;
    }

    const span = (m.usl !== null && m.lsl !== null && (m.usl - m.lsl) > 0) ? (m.usl - m.lsl) : 1;

    let html = '';
    m.nearFailList.slice(0, 60).forEach((item, idx) => {
        const displaySN = item.displayID || (item.record && item.record.displayID) || item.serialNo;
        const station = item.stationName || (item.record && item.record.stationName) || '—';
        const ts = item.timestamp || (item.record && item.record.timestamp);
        const recId = item.record ? item.record.id : '';

        let distPct = '';
        if (m.lsl !== null && item.nearLimit && item.nearLimit.startsWith('LSL')) {
            distPct = _t('{0}% cách LSL', (((item.value - m.lsl) / span) * 100).toFixed(2));
        } else if (m.usl !== null && item.nearLimit && item.nearLimit.startsWith('USL')) {
            distPct = _t('{0}% cách USL', (((m.usl - item.value) / span) * 100).toFixed(2));
        }

        html += `
            <tr>
                <td style="text-align:center; color:var(--text-muted); font-family:var(--font-mono);">${idx + 1}</td>
                <td style="font-weight:700; font-family:var(--font-mono);">${escapeHtml(displaySN)}</td>
                <td style="font-weight:700; font-family:var(--font-mono); color:#f59e0b;">${item.value.toFixed(4)} ${escapeHtml(m.unit)}</td>
                <td><span class="badge-pill badge-warn">${escapeHtml(item.nearLimit ? _t(item.nearLimit) : _t('Sát Mép'))}</span></td>
                <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${escapeHtml(distPct || _t('Trong biên {0}%', CFG.NEAR_FAIL_MARGIN_PCT))}</td>
                <td><span style="color:var(--accent-blue); font-weight:700;">${escapeHtml(station)}</span></td>
                <td style="font-size:11.5px; color:var(--text-muted); font-family:var(--font-mono);">${ts ? ts.toLocaleString('vi-VN', { hour12: false }) : '—'}</td>
                <td style="text-align:center;">
                    ${recId ? `<button class="btn btn-sm btn-outline" style="padding:2px 8px; font-size:10.5px;" onclick="inspectRecordInModal('${escapeHtml(recId)}')">🔍 Xem</button>` : '—'}
                </td>
            </tr>
        `;
    });
    return html;
}

function renderHistogramChart(m) {
    const canvas = document.getElementById('histogram-chart-canvas');
    if (!canvas || typeof Chart === 'undefined' || !m.histogram) return;

    if (histogramChartInstance) {
        histogramChartInstance.destroy();
        histogramChartInstance = null;
    }

    const hist = m.histogram;
    const ctx = canvas.getContext('2d');

    const gaussPoints = hist.bins.map(b => {
        if (m.stdDev <= 0) return 0;
        const pdf = normalPdf(b.mid, m.mean, m.stdDev);
        return pdf * m.count * hist.binWidth;
    });

    const isLight = document.body.classList.contains('light-theme');
    const textCol = isLight ? '#475569' : '#94a3b8';
    const gridCol = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

    // Plugin vẽ trực tiếp vạch giới hạn LSL, USL và Mean (μ) lên đồ thị Histogram
    const spcLimitLinesPlugin = {
        id: 'spcLimitLines',
        afterDraw(chart) {
            const { ctx, chartArea: { top, bottom, left, right }, scales: { x } } = chart;
            if (!x || hist.plotMin === undefined || hist.plotMax === undefined) return;
            const span = hist.plotMax - hist.plotMin;
            if (span <= 0) return;

            function drawVerticalLine(val, color, label, dashed = true) {
                if (val === null || val === undefined || isNaN(val)) return;
                const ratio = (val - hist.plotMin) / span;
                if (ratio < 0 || ratio > 1) return;
                const xPos = left + ratio * (right - left);

                ctx.save();
                ctx.beginPath();
                if (dashed) ctx.setLineDash([5, 4]);
                ctx.lineWidth = 2;
                ctx.strokeStyle = color;
                ctx.moveTo(xPos, top);
                ctx.lineTo(xPos, bottom);
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.font = 'bold 10px monospace';
                const textWidth = ctx.measureText(label).width;
                const labelX = Math.min(right - textWidth - 4, Math.max(left + 4, xPos - textWidth / 2));
                ctx.fillRect(labelX - 3, top + 4, textWidth + 6, 15);
                ctx.fillStyle = '#090d16';
                ctx.fillText(label, labelX, top + 15);
                ctx.restore();
            }

            drawVerticalLine(m.lsl, '#ef4444', `LSL ${m.lsl}`, true);
            drawVerticalLine(m.usl, '#ef4444', `USL ${m.usl}`, true);
            drawVerticalLine(m.mean, '#10b981', `μ ${m.mean.toFixed(2)}`, false);
        }
    };

    histogramChartInstance = new Chart(ctx, {
        plugins: [spcLimitLinesPlugin],
        data: {
            labels: hist.labels,
            datasets: [
                {
                    type: 'bar',
                    order: 2,
                    label: _t('Tần suất mẫu thực tế'),
                    data: hist.counts,
                    backgroundColor: 'rgba(56, 189, 248, 0.62)',
                    borderColor: '#38bdf8',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    type: 'line',
                    order: 1,
                    label: _t('Đường phân phối Gauss lý thuyết'),
                    data: gaussPoints,
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    pointRadius: 2,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    title: { display: true, text: `${_t('Giá trị đo')} [${m.unit || 'unitless'}]`, color: textCol },
                    grid: { color: gridCol },
                    ticks: { color: textCol }
                },
                y: {
                    title: { display: true, text: _t('Số lượng mẫu'), color: textCol },
                    grid: { color: gridCol },
                    ticks: { color: textCol, precision: 0 }
                }
            },
            plugins: {
                legend: {
                    labels: { color: textCol, font: { size: 11, weight: 'bold' } }
                }
            }
        }
    });
}

/**
 * Xuất Báo Cáo Phân Tích Cpk ra tệp CSV / Excel
 */
function exportCpkExcel() {
    if (parametricAnalysisMap.size === 0) {
        showToast(_t('⚠️ Không có thông số đo liên tục để xuất Cpk.'), 'warning');
        return;
    }

    let csv = '\uFEFF' + _t('Thông Số Đo') + ',' + _t('Điều Kiện Đo') + ',' + _t('Đơn Vị') + ',' + _t('LSL (Dưới)') + ',' + _t('USL (Trên)') + ',' + _t('Số Mẫu (N)') + ',' + _t('Trung Bình (Mean)') + ',' + _t('Độ Lệch Chuẩn (StdDev)') + ',Min,Max,Cp,Cpk,Cpl,Cpu,Ppk,' + _t('Số Con Sát Giới Hạn (Near-Fail)') + ',' + _t('Đánh Giá Năng Lực') + '\n';

    parametricAnalysisMap.forEach(m => {
        let rating = 'N/A';
        if (m.cpk !== null) {
            if (m.cpk >= CFG.CPK_EXCELLENT) rating = _t('Xuất sắc (>=1.67)');
            else if (m.cpk >= CFG.CPK_CAPABLE) rating = _t('Đạt năng lực (>=1.33)');
            else if (m.cpk >= CFG.CPK_MARGINAL) rating = _t('Cận biên (1.00 - 1.33)');
            else rating = _t('Không đạt (<1.00)');
        }

        csv += `"${m.name}","${m.condition || 'Standard'}","${m.unit || ''}",${m.lsl !== null ? m.lsl : '—'},${m.usl !== null ? m.usl : '—'},${m.count},${m.mean.toFixed(4)},${m.stdDev.toFixed(4)},${m.min.toFixed(4)},${m.max.toFixed(4)},${m.cp !== null ? m.cp.toFixed(3) : '—'},${m.cpk !== null ? m.cpk.toFixed(3) : '—'},${m.cpl !== null ? m.cpl.toFixed(3) : '—'},${m.cpu !== null ? m.cpu.toFixed(3) : '—'},${m.ppk !== null ? m.ppk.toFixed(3) : '—'},${m.nearFailList ? m.nearFailList.length : 0},"${rating}"\n`;
    });

    downloadBlobFile(csv, `QIT_Cpk_Statistical_Report_${toLocalDateStr(new Date())}.csv`, 'text/csv;charset=utf-8');
    showToast(_t('✅ Đã xuất dữ liệu Cpk Excel (CSV) thành công!'), 'success');
}

/**
 * Xuất Báo Cáo Phân Tích Cpk ra tệp HTML độc lập
 */
function exportCpkHTML() {
    if (parametricAnalysisMap.size === 0) {
        showToast(_t('⚠️ Không có thông số đo liên tục để xuất Cpk.'), 'warning');
        return;
    }

    let rowsHtml = '';
    let totalParams = 0, excellentCount = 0, capableCount = 0, marginalCount = 0, incapableCount = 0;

    parametricAnalysisMap.forEach(m => {
        totalParams++;
        let ratingBadge = '<span class="badge" style="background:rgba(148,163,184,0.15); color:var(--txt-sub);">N/A</span>';
        if (m.cpk !== null) {
            if (m.cpk >= CFG.CPK_EXCELLENT) {
                ratingBadge = '<span class="badge badge-pass">' + _t('🌟 Xuất Sắc (&ge;1.67)') + '</span>';
                excellentCount++;
            } else if (m.cpk >= CFG.CPK_CAPABLE) {
                ratingBadge = '<span class="badge badge-capable">' + _t('✓ Đạt Năng Lực (&ge;1.33)') + '</span>';
                capableCount++;
            } else if (m.cpk >= CFG.CPK_MARGINAL) {
                ratingBadge = '<span class="badge badge-warn">' + _t('⚠️ Cận Biên (1.00 - 1.33)') + '</span>';
                marginalCount++;
            } else {
                ratingBadge = '<span class="badge badge-fail">' + _t('✕ Không Đạt (&lt;1.00)') + '</span>';
                incapableCount++;
            }
        }

        const nearFailCount = m.nearFailList ? m.nearFailList.length : 0;
        const nearFailTag = nearFailCount > 0 ? `<span style="color:#f87171; font-weight:800;">${nearFailCount}</span>` : `<span style="color:var(--txt-sub);">0</span>`;

        rowsHtml += `<tr>
            <td style="font-weight:700; text-align:left;">
                ${escapeHtml(m.name)}
                <span style="font-size:10px; color:var(--txt-sub); font-family:monospace; display:block;">(${escapeHtml(m.condition || 'Standard')})</span>
            </td>
            <td><strong style="color:var(--cyan); font-family:monospace;">${escapeHtml(m.unit || '—')}</strong></td>
            <td style="font-family:monospace;">${m.lsl !== null ? m.lsl : '—'}</td>
            <td style="font-family:monospace;">${m.usl !== null ? m.usl : '—'}</td>
            <td style="font-family:monospace; font-weight:700;">${m.count}</td>
            <td style="font-family:monospace; font-weight:700;">${m.mean.toFixed(3)}</td>
            <td style="font-family:monospace;">${m.stdDev.toFixed(3)}</td>
            <td style="font-family:monospace;">${m.cp !== null ? m.cp.toFixed(2) : '—'}</td>
            <td style="font-family:monospace; font-weight:900; font-size:13px; color:${m.cpk !== null && m.cpk >= 1.33 ? 'var(--pass)' : (m.cpk !== null && m.cpk >= 1.0 ? 'var(--warn)' : 'var(--fail)')};">${m.cpk !== null ? m.cpk.toFixed(2) : '—'}</td>
            <td style="font-family:monospace;">${nearFailTag}</td>
            <td>${ratingBadge}</td>
        </tr>`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="vi" data-theme="dark">
<head>
<meta charset="utf-8">
<title>${_t('QIT Scanner v2 Pro - Báo Cáo Năng Lực Quy Trình Cpk')}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #090d16; --bg-card: rgba(17, 24, 39, 0.88); --bg-elevated: #1e293b;
    --border: rgba(148, 163, 184, 0.16); --txt: #f1f5f9; --txt-sub: #94a3b8;
    --cyan: #00f2fe; --blue: #38bdf8; --pass: #10b981; --pass-bg: rgba(16, 185, 129, 0.16);
    --capable-bg: rgba(56, 189, 248, 0.16); --fail: #ef4444; --fail-bg: rgba(239, 68, 68, 0.16);
    --warn: #f59e0b; --warn-bg: rgba(245, 158, 11, 0.16);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: var(--bg); color: var(--txt); padding: 24px; }
  .container { max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .kpi-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; text-align: center; }
  .kpi-label { font-size: 10.5px; font-weight: 800; color: var(--txt-sub); text-transform: uppercase; }
  .kpi-val { font-size: 22px; font-weight: 900; margin-top: 4px; font-family: monospace; }
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; white-space: nowrap; }
  th { background: var(--bg-elevated); color: var(--txt-sub); font-weight: 800; padding: 10px 14px; border-bottom: 1px solid var(--border); }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; }
  .badge-pass { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass); }
  .badge-capable { background: var(--capable-bg); color: var(--blue); border: 1px solid var(--blue); }
  .badge-warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn); }
  .badge-fail { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1 style="font-size:19px; font-weight:900; color:var(--cyan);">📈 ${_t('BÁO CÁO NĂNG LỰC QUY TRÌNH & DUNG SAI 6-SIGMA (Cpk)')}</h1>
      <p style="font-size:11px; color:var(--txt-sub); font-family:monospace; margin-top:3px;">QIT SCANNER V2 PRO · PARAMETRIC STATISTICAL PROCESS CONTROL (SPC)</p>
    </div>
    <div style="font-size:11.5px; color:var(--txt-sub); font-family:monospace;">${_t('Xuất lúc')}: <strong>${new Date().toLocaleString()}</strong></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">${_t('TỔNG THÔNG SỐ SPC')}</div><div class="kpi-val" style="color:var(--cyan);">${totalParams}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('XUẤT SẮC (&ge;1.67)')}</div><div class="kpi-val" style="color:var(--pass);">${excellentCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('ĐẠT NĂNG LỰC (&ge;1.33)')}</div><div class="kpi-val" style="color:var(--blue);">${capableCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('CẬN BIÊN (1.00-1.33)')}</div><div class="kpi-val" style="color:var(--warn);">${marginalCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('KHÔNG ĐẠT (&lt;1.00)')}</div><div class="kpi-val" style="color:var(--fail);">${incapableCount}</div></div>
  </div>
  <div class="card">
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th style="text-align:left;">${_t('Thông Số Đo')}</th>
            <th>${_t('Đơn Vị')}</th>
            <th>LSL</th>
            <th>USL</th>
            <th>${_t('Số Mẫu (N)')}</th>
            <th>Mean (&mu;)</th>
            <th>StdDev (&sigma;)</th>
            <th>Cp</th>
            <th>Cpk</th>
            <th>${_t('Sát Giới Hạn')}</th>
            <th>${_t('Đánh Giá Năng Lực')}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>
</div>
</body>
</html>`;

    downloadBlobFile(htmlContent, `QIT_Cpk_Statistical_Report_${toLocalDateStr(new Date())}.html`, 'text/html;charset=utf-8');
    showToast(_t('✅ Đã xuất Báo Cáo Cpk HTML độc lập thành công!'), 'success');
}
