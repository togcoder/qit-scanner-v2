/* ════════════ GIAO DIỆN PHÂN TÍCH THÔNG SỐ ĐO & NĂNG LỰC CPK (PARAMETRIC UI) V2 ════════════ */

function renderParametricDashboard() {
    renderMetricSelectorDropdown();
    const area = document.getElementById('parametric-content-area');
    if (loadedFilesMap.size === 0 || parametricAnalysisMap.size === 0) {
        if (area) {
            area.innerHTML = `
                <div class="card" style="padding:48px 24px; text-align:center; max-width:680px; margin:20px auto;">
                    <div style="font-size:48px; margin-bottom:14px;">📈</div>
                    <h3 style="font-size:17px; font-weight:900; margin:0 0 8px; color:var(--text-main);">CHƯA CÓ DỮ LIỆU THÔNG SỐ ĐO VẬT LÝ & CPK</h3>
                    <p style="font-size:12.5px; color:var(--text-muted); line-height:1.6; margin:0 auto 24px;">
                        Tính năng Phân Tích Thông Số &amp; Cpk cần các giá trị đo vật lý liên tục (Re, fs, SPL, THD...) từ tệp nhật ký Klippel để tính toán độ lệch chuẩn Gauss và giới hạn dung sai LSL/USL.
                    </p>
                    <div style="display:flex; justify-content:center; gap:14px; flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="startFastDirectoryScan()" style="padding:10px 22px; font-weight:800; font-size:13.5px; display:inline-flex; align-items:center; gap:8px;">
                            <span>📁</span> <span>Chọn Thư Mục (Quét Siêu Tốc File Summary)</span>
                        </button>
                        <button class="btn btn-outline" onclick="document.getElementById('file-input').click()" style="padding:10px 20px; font-size:13.5px; display:inline-flex; align-items:center; gap:8px;">
                            <span>📄</span> <span>Chọn Tệp Riêng Lẻ</span>
                        </button>
                        <button class="btn btn-secondary" onclick="switchTab('audit')" style="padding:10px 20px; font-size:13.5px; display:inline-flex; align-items:center; gap:8px;">
                            <span>🎯</span> <span>Sang Kiểm Tra Danh Sách (Không cần log)</span>
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
        selectEl.innerHTML = `<option value="">(Không có thông số đo liên tục)</option>`;
        return;
    }

    parametricAnalysisMap.forEach((m, key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${m.name} ${m.condition ? '(' + m.condition + ')' : ''} [${m.unit || 'unitless'}] — ${m.count} mẫu`;
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
    renderSelectedMetricCpk();
}

function setParametricFilterMode(mode) {
    CFG.CPK_DATA_FILTER = mode;
    try {
        localStorage.setItem(LS.CFG_CUSTOM, JSON.stringify(CFG));
    } catch(e) {}
    calculateParametricCpkStats();
    renderSelectedMetricCpk();
    showToast(`✓ Đã chuyển chế độ dữ liệu Cpk: ${mode === 'PASS_ONLY' ? 'Chỉ SP ĐẠT (Chuẩn SPC)' : (mode === 'TRIMMED_3SIGMA' ? 'Lọc dị biệt 3-Sigma' : 'Toàn bộ sản phẩm')}`, 'info');
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

    // Đánh giá năng lực Cpk
    let ratingBadge = '';
    let ratingColor = '#94a3b8';
    if (m.cpk !== null) {
        if (m.cpk >= CFG.CPK_EXCELLENT) {
            ratingBadge = '🌟 XUẤT SẮC (6-SIGMA CLASS)';
            ratingColor = '#10b981';
        } else if (m.cpk >= CFG.CPK_CAPABLE) {
            ratingBadge = '✓ ĐẠT NĂNG LỰC (CAPABLE)';
            ratingColor = '#38bdf8';
        } else if (m.cpk >= CFG.CPK_MARGINAL) {
            ratingBadge = '⚠️ CẬN BIÊN (MARGINAL)';
            ratingColor = '#f59e0b';
        } else {
            ratingBadge = '✕ KHÔNG ĐẠT (INCAPABLE)';
            ratingColor = '#ef4444';
        }
    } else {
        ratingBadge = 'KHÔNG CÓ DUNG SAI LSL/USL';
    }

    // Format số
    const fmt = num => (typeof num === 'number' && !isNaN(num)) ? (Math.abs(num) >= 100 ? num.toFixed(2) : (Math.abs(num) >= 0.01 ? num.toFixed(4) : num.toExponential(3))) : '—';
    const curFilter = m.filterMode || CFG.CPK_DATA_FILTER || 'PASS_ONLY';

    let html = `
        <!-- THANH CHỌN NGUỒN DỮ LIỆU TÍNH TOÁN CPK THEO CHUẨN SPC -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding:10px 14px; background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:10px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
                <span style="font-weight:800; color:var(--accent-blue);">🎯 NGUỒN DỮ LIỆU TÍNH CPK:</span>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm ${curFilter === 'PASS_ONLY' ? 'btn-primary' : 'btn-outline'}" onclick="setParametricFilterMode('PASS_ONLY')" title="Loại bỏ các mẫu rơi rớt / hở mạch ngoại lai để tính đúng độ biến thiên tự nhiên của máy">
                        ✓ Chỉ SP ĐẠT (Chuẩn SPC)
                    </button>
                    <button class="btn btn-sm ${curFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}" onclick="setParametricFilterMode('ALL')" title="Tính trên 100% sản phẩm gồm cả hàng hỏng">
                        Toàn Bộ Sản Phẩm
                    </button>
                    <button class="btn btn-sm ${curFilter === 'TRIMMED_3SIGMA' ? 'btn-primary' : 'btn-outline'}" onclick="setParametricFilterMode('TRIMMED_3SIGMA')" title="Tự động loại bỏ giá trị dị biệt vượt ngoài 3-Sigma">
                        Lọc Dị Biệt 3-Sigma
                    </button>
                </div>
            </div>
            <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">
                Mẫu phân tích: <strong>${m.count}</strong> / Tổng: <strong>${m.totalCount}</strong> (Đạt: ${m.passCount})
            </div>
        </div>

        <!-- DÒNG 1: CÁC THẺ KPI THỐNG KÊ & CPK -->
        <div class="cpk-kpi-grid">
            <div class="cpk-card highlight-card" style="border-top-color:${ratingColor};">
                <div class="cpk-label">CHỈ SỐ NĂNG LỰC CPK</div>
                <div class="cpk-val" style="color:${ratingColor};">${m.cpk !== null ? m.cpk.toFixed(2) : '—'}</div>
                <div class="cpk-sub" style="color:${ratingColor}; font-weight:700;">${ratingBadge}</div>
            </div>

            <div class="cpk-card">
                <div class="cpk-label">NĂNG LỰC TIỀM NĂNG (CP) / HIỆU SUẤT (PPK)</div>
                <div class="cpk-val">${m.cp !== null ? m.cp.toFixed(2) : '—'} <span style="font-size:13px; color:var(--text-muted); font-weight:600;">(Ppk: ${m.ppk !== null ? m.ppk.toFixed(2) : '—'})</span></div>
                <div class="cpk-sub">Cpl: ${m.cpl !== null ? m.cpl.toFixed(2) : '—'} | Cpu: ${m.cpu !== null ? m.cpu.toFixed(2) : '—'}</div>
            </div>

            <div class="cpk-card">
                <div class="cpk-label">GIÁ TRỊ TRUNG BÌNH (MEAN) & ĐỘ LỆCH TÂM (k)</div>
                <div class="cpk-val">${fmt(m.mean)} <span class="unit-mini">${escapeHtml(m.unit)}</span></div>
                <div class="cpk-sub">Độ lệch chuẩn s: ${fmt(m.stdDev)} ${m.kFactor !== null ? `| k: ${(m.kFactor * 100).toFixed(1)}%` : ''}</div>
            </div>

            <div class="cpk-card">
                <div class="cpk-label">GIỚI HẠN DUNG SAI (LSL / USL)</div>
                <div class="cpk-val">${m.lsl !== null ? fmt(m.lsl) : '—'} / ${m.usl !== null ? fmt(m.usl) : '—'}</div>
                <div class="cpk-sub">Min: ${fmt(m.min)} | Max: ${fmt(m.max)}</div>
            </div>
        </div>

        <!-- DÒNG 2: BIỂU ĐỒ PHÂN PHỐI HISTOGRAM & GAUSS -->
        <div class="card" style="margin-top:20px; padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <div style="font-weight:800; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">
                    📈 BIỂU ĐỒ PHÂN PHỐI THỰC TẾ & ĐƯỜNG CONG GAUSS (${escapeHtml(m.name)})
                </div>
                <div style="font-size:12px; color:var(--text-muted);">
                    Số mẫu: <strong>${m.count.toLocaleString()}</strong> | LSL: <strong>${m.lsl !== null ? m.lsl : '—'}</strong> | USL: <strong>${m.usl !== null ? m.usl : '—'}</strong>
                </div>
            </div>
            <div style="position:relative; height:320px; width:100%;">
                <canvas id="histogram-chart-canvas"></canvas>
            </div>
        </div>

        <!-- DÒNG 3: BẢNG CẢNH BÁO CẬN BIÊN LỖI (NEAR-FAIL WARNINGS) -->
        <div class="card" style="margin-top:20px; padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <div style="font-weight:800; font-size:14px; text-transform:uppercase; color:#f59e0b;">
                    ⚠️ DANH SÁCH SẢN PHẨM CẬN BIÊN DUNG SAI (NEAR-FAIL: ${m.nearFailList.length} SP)
                </div>
                <div style="font-size:12px; color:var(--text-muted);">
                    Các mẫu PASS nhưng giá trị lệch sát mép giới hạn (trong biên ${CFG.NEAR_FAIL_MARGIN_PCT}%)
                </div>
            </div>

            <div class="table-wrapper" style="max-height:260px; overflow-y:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px; text-align:center;">STT</th>
                            <th>Mã Serial Number</th>
                            <th>Giá Trị Đo Thực Tế</th>
                            <th>Cảnh Báo Giới Hạn</th>
                            <th>Trạm Đo</th>
                            <th>Thời Gian Đo</th>
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

    // Render Chart
    renderHistogramChart(m);
}

function renderNearFailTableRows(m) {
    if (!m.nearFailList || m.nearFailList.length === 0) {
        return `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:16px;">✓ ${_t('Toàn bộ sản phẩm nằm an toàn trong vùng dung sai tối ưu (không có mẫu cận biên).')}</td></tr>`;
    }

    let html = '';
    m.nearFailList.slice(0, 50).forEach((item, idx) => {
        const displaySN = item.displayID || (item.record && item.record.displayID) || item.serialNo;
        const station = item.stationName || (item.record && item.record.stationName) || '—';
        const ts = item.timestamp || (item.record && item.record.timestamp);

        html += `
            <tr>
                <td style="text-align:center; color:var(--text-muted);">${idx + 1}</td>
                <td style="font-weight:700; font-family:var(--font-mono);">${escapeHtml(displaySN)}</td>
                <td style="font-weight:700; font-family:var(--font-mono); color:#f59e0b;">${item.value.toFixed(4)} ${escapeHtml(m.unit)}</td>
                <td><span class="badge-pill" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);">${escapeHtml(item.nearLimit || 'Sát Mép')}</span></td>
                <td><span style="color:var(--accent-blue); font-weight:700;">${escapeHtml(station)}</span></td>
                <td style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">${ts ? ts.toLocaleString() : '—'}</td>
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

    // Tạo đường phân phối chuẩn Gauss tương ứng
    const gaussPoints = hist.bins.map(b => {
        if (m.stdDev <= 0) return 0;
        const pdf = normalPdf(b.mid, m.mean, m.stdDev);
        return pdf * m.count * hist.binWidth;
    });

    const isLight = document.body.classList.contains('light-theme');
    const textCol = isLight ? '#475569' : '#94a3b8';
    const gridCol = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

    histogramChartInstance = new Chart(ctx, {
        data: {
            labels: hist.labels,
            datasets: [
                {
                    type: 'bar',
                    order: 2, // CỘT Ở DƯỚI
                    label: _t('Tần suất mẫu thực tế'),
                    data: hist.counts,
                    backgroundColor: 'rgba(56, 189, 248, 0.65)',
                    borderColor: '#38bdf8',
                    borderWidth: 1,
                    borderRadius: 3
                },
                {
                    type: 'line',
                    order: 1, // ĐƯỜNG Ở TRÊN CÙNG
                    label: _t('Đường phân phối Gauss lý thuyết'),
                    data: gaussPoints,
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
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
                    title: { display: true, text: `Giá trị đo [${m.unit || 'unitless'}]`, color: textCol },
                    grid: { color: gridCol },
                    ticks: { color: textCol }
                },
                y: {
                    title: { display: true, text: 'Số lượng mẫu', color: textCol },
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
        showToast('⚠️ Không có thông số đo liên tục để xuất Cpk.', 'warning');
        return;
    }

    let csv = '\uFEFFThông Số Đo,Điều Kiện Đo,Đơn Vị,LSL (Dưới),USL (Trên),Số Mẫu (N),Trung Bình (Mean),Độ Lệch Chuẩn (StdDev),Min,Max,Cp,Cpk,Cpl,Cpu,Số Con Sát Giới Hạn (Near-Fail),Đánh Giá Năng Lực\n';

    parametricAnalysisMap.forEach(m => {
        let rating = 'N/A';
        if (m.cpk !== null) {
            if (m.cpk >= CFG.CPK_EXCELLENT) rating = 'Xuất sắc (>=1.67)';
            else if (m.cpk >= CFG.CPK_CAPABLE) rating = 'Đạt năng lực (>=1.33)';
            else if (m.cpk >= CFG.CPK_MARGINAL) rating = 'Cận biên (1.00 - 1.33)';
            else rating = 'Không đạt (<1.00)';
        }

        csv += `"${m.name}","${m.condition || 'Standard'}","${m.unit || ''}",${m.lsl !== null ? m.lsl : '—'},${m.usl !== null ? m.usl : '—'},${m.count},${m.mean.toFixed(4)},${m.stdDev.toFixed(4)},${m.min.toFixed(4)},${m.max.toFixed(4)},${m.cp !== null ? m.cp.toFixed(3) : '—'},${m.cpk !== null ? m.cpk.toFixed(3) : '—'},${m.cpl !== null ? m.cpl.toFixed(3) : '—'},${m.cpu !== null ? m.cpu.toFixed(3) : '—'},${m.nearFailList ? m.nearFailList.length : 0},"${rating}"\n`;
    });

    downloadBlobFile(csv, `QIT_Cpk_Statistical_Report_${toLocalDateStr(new Date())}.csv`, 'text/csv;charset=utf-8');
    showToast('✅ Đã xuất dữ liệu Cpk Excel (CSV) thành công!', 'success');
}

/**
 * Xuất Báo Cáo Phân Tích Cpk ra tệp HTML độc lập
 */
function exportCpkHTML() {
    if (parametricAnalysisMap.size === 0) {
        showToast('⚠️ Không có thông số đo liên tục để xuất Cpk.', 'warning');
        return;
    }

    let rowsHtml = '';
    let totalParams = 0;
    let excellentCount = 0;
    let capableCount = 0;
    let marginalCount = 0;
    let incapableCount = 0;

    parametricAnalysisMap.forEach(m => {
        totalParams++;
        let ratingBadge = '<span class="badge" style="background:rgba(148,163,184,0.15); color:var(--txt-sub); border:1px solid var(--border);">N/A</span>';
        if (m.cpk !== null) {
            if (m.cpk >= CFG.CPK_EXCELLENT) {
                ratingBadge = '<span class="badge badge-pass">🌟 Xuất Sắc (&ge;1.67)</span>';
                excellentCount++;
            } else if (m.cpk >= CFG.CPK_CAPABLE) {
                ratingBadge = '<span class="badge badge-capable">✓ Đạt Năng Lực (&ge;1.33)</span>';
                capableCount++;
            } else if (m.cpk >= CFG.CPK_MARGINAL) {
                ratingBadge = '<span class="badge badge-warn">⚠️ Cận Biên (1.00 - 1.33)</span>';
                marginalCount++;
            } else {
                ratingBadge = '<span class="badge badge-fail">✕ Không Đạt (&lt;1.00)</span>';
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
<title>QIT Scanner v2 - Báo Cáo Năng Lực Quy Trình Cpk</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #090d16;
    --bg-card: rgba(17, 24, 39, 0.88);
    --bg-elevated: #1e293b;
    --border: rgba(148, 163, 184, 0.16);
    --border-hover: rgba(0, 242, 254, 0.35);
    --txt: #f1f5f9;
    --txt-sub: #94a3b8;
    --cyan: #00f2fe;
    --blue: #38bdf8;
    --pass: #10b981;
    --pass-bg: rgba(16, 185, 129, 0.16);
    --capable-bg: rgba(56, 189, 248, 0.16);
    --fail: #ef4444;
    --fail-bg: rgba(239, 68, 68, 0.16);
    --warn: #f59e0b;
    --warn-bg: rgba(245, 158, 11, 0.16);
    --shadow: 0 16px 36px -10px rgba(0,0,0,0.6);
  }
  [data-theme="light"] {
    --bg: #f1f5f9;
    --bg-card: rgba(255, 255, 255, 0.94);
    --bg-elevated: #e2e8f0;
    --border: rgba(15, 23, 42, 0.1);
    --border-hover: rgba(2, 132, 199, 0.4);
    --txt: #0f172a;
    --txt-sub: #475569;
    --cyan: #0284c7;
    --blue: #0369a1;
    --pass: #059669;
    --pass-bg: rgba(5, 150, 105, 0.12);
    --capable-bg: rgba(2, 132, 199, 0.12);
    --fail: #dc2626;
    --fail-bg: rgba(220, 38, 38, 0.12);
    --warn: #d97706;
    --warn-bg: rgba(217, 119, 6, 0.12);
    --shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.12);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background: var(--bg); color: var(--txt); padding: 24px; min-height: 100vh; transition: background 0.25s ease, color 0.25s ease; }
  .container { max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  
  .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid var(--border); padding-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-text h1 { font-size: 19px; font-weight: 900; letter-spacing: 0.04em; background: linear-gradient(135deg, var(--cyan), var(--blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .brand-text p { font-size: 11px; color: var(--txt-sub); font-family: monospace; letter-spacing: 0.1em; margin-top: 2px; }
  
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .theme-toggle-btn { background: var(--bg-card); border: 1px solid var(--border); color: var(--txt); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: grid; place-items: center; font-size: 16px; transition: all 0.2s ease; box-shadow: var(--shadow); }
  .theme-toggle-btn:hover { border-color: var(--border-hover); transform: scale(1.05); }
  .meta { font-size: 11.5px; color: var(--txt-sub); text-align: right; font-family: monospace; line-height: 1.5; }
  
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .kpi-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; text-align: center; box-shadow: var(--shadow); backdrop-filter: blur(10px); }
  .kpi-label { font-size: 10.5px; font-weight: 800; color: var(--txt-sub); text-transform: uppercase; letter-spacing: 0.05em; }
  .kpi-val { font-size: 22px; font-weight: 900; margin-top: 4px; font-family: monospace; }
  
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; box-shadow: var(--shadow); }
  table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; white-space: nowrap; }
  th { background: var(--bg-elevated); color: var(--txt-sub); font-weight: 800; padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 11.5px; }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  tr:hover td { background: rgba(255, 255, 255, 0.03); }
  
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
  .badge-pass { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass); }
  .badge-capable { background: var(--capable-bg); color: var(--blue); border: 1px solid var(--blue); }
  .badge-warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn); }
  .badge-fail { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">
      <svg viewBox="50 50 200 200" width="38" height="38">
        <defs>
          <linearGradient id="qGradExp3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f2fe"/><stop offset="100%" stop-color="#4facfe"/></linearGradient>
          <linearGradient id="b13" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0f2b5c"/><stop offset="100%" stop-color="#0ea5e9"/></linearGradient>
          <linearGradient id="b23" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#2d1363"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient>
          <linearGradient id="b33" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#093d5c"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>
          <linearGradient id="b43" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#3b0764"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>
        </defs>
        <line x1="175" y1="175" x2="230" y2="230" stroke="url(#qGradExp3)" stroke-width="26" stroke-linecap="round"/>
        <circle cx="140" cy="140" r="65" fill="none" stroke="url(#qGradExp3)" stroke-width="18"/>
        <rect x="90" y="145" width="14" height="40" fill="url(#b13)"/>
        <rect x="118" y="160" width="14" height="25" fill="url(#b23)"/>
        <rect x="146" y="125" width="14" height="60" fill="url(#b33)"/>
        <rect x="174" y="135" width="14" height="50" fill="url(#b43)"/>
        <polyline points="97,125 125,140 153,105 181,115" fill="none" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="97" cy="125" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="125" cy="140" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="153" cy="105" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="181" cy="115" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
      </svg>
      <div class="brand-text">
        <h1>📈 BÁO CÁO NĂNG LỰC QUY TRÌNH & DUNG SAI 6-SIGMA (Cpk)</h1>
        <p>QIT SCANNER V2 · PARAMETRIC STATISTICAL PROCESS CONTROL (SPC)</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="theme-toggle-btn" onclick="toggleReportTheme()" title="Chuyển đổi giao diện Sáng / Tối">
        <span id="theme-icon">☀️</span>
      </button>
      <div class="meta">
        <div>Thời gian xuất: <strong>${new Date().toLocaleString()}</strong></div>
      </div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">TỔNG THÔNG SỐ SPC</div><div class="kpi-val" style="color:var(--cyan);">${totalParams}</div></div>
    <div class="kpi-card"><div class="kpi-label">XUẤT SẮC (&ge;1.67)</div><div class="kpi-val" style="color:var(--pass);">${excellentCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">ĐẠT NĂNG LỰC (&ge;1.33)</div><div class="kpi-val" style="color:var(--blue);">${capableCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">CẬN BIÊN (1.00-1.33)</div><div class="kpi-val" style="color:var(--warn);">${marginalCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">KHÔNG ĐẠT (&lt;1.00)</div><div class="kpi-val" style="color:var(--fail);">${incapableCount}</div></div>
  </div>

  <div class="card">
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th style="text-align:left; min-width:180px;">Thông Số Đo</th>
            <th>Đơn Vị</th>
            <th>LSL</th>
            <th>USL</th>
            <th>Số Mẫu (N)</th>
            <th>Mean (&mu;)</th>
            <th>StdDev (&sigma;)</th>
            <th>Cp</th>
            <th>Cpk</th>
            <th>Sát Giới Hạn</th>
            <th>Đánh Giá Năng Lực</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>
</div>

<script>
  function initReportTheme() {
    const saved = localStorage.getItem('qit_report_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-icon').innerText = saved === 'light' ? '🌙' : '☀️';
  }
  function toggleReportTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('qit_report_theme', next);
    document.getElementById('theme-icon').innerText = next === 'light' ? '🌙' : '☀️';
  }
  initReportTheme();
</script>
</body>
</html>`;

    downloadBlobFile(htmlContent, `QIT_Cpk_Statistical_Report_${toLocalDateStr(new Date())}.html`, 'text/html;charset=utf-8');
    showToast('✅ Đã xuất Báo Cáo Cpk HTML độc lập thành công!', 'success');
}
