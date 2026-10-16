/* ════════════ PHÂN TÍCH CHẤT LƯỢNG CHUYÊN SÂU (3 UNIFIED WORKSPACES) V2 ════════════ */

let currentAnalysisWorkspace = 'pareto'; // 'pareto' | 'matrix' | 'timeline'
let currentDrilldownError = null;
let currentDrilldownList = [];
let matrixFilterStatus = 'ALL'; // 'ALL' | 'FAIL' | 'CHANGED' | 'RETEST'
let matrixSearchKeyword = '';

function switchAnalysisWorkspace(workspaceId) {
    currentAnalysisWorkspace = workspaceId;
    renderAnalysisDashboard();
}

function renderAnalysisDashboard() {
    const pane = document.getElementById('pane-analysis');
    if (!pane) return;

    // 1. Render Thanh Sub-Navigation (3 Unified Workspaces)
    let subnav = document.getElementById('analysis-subnav-container');
    if (!subnav) {
        subnav = document.createElement('div');
        subnav.id = 'analysis-subnav-container';
        subnav.className = 'analysis-subnav-wrapper';
        pane.insertBefore(subnav, pane.firstChild);
    }

    subnav.innerHTML = `
        <div class="analysis-subnav-bar">
            <button class="analysis-subnav-btn ${currentAnalysisWorkspace === 'pareto' ? 'active' : ''}" onclick="switchAnalysisWorkspace('pareto')">
                <span>📊</span> ${_t('1. TỔNG QUAN & PARETO')}
            </button>
            <button class="analysis-subnav-btn ${currentAnalysisWorkspace === 'matrix' ? 'active' : ''}" onclick="switchAnalysisWorkspace('matrix')">
                <span>🧩</span> ${_t('2. MA TRẬN ĐA LƯỢT')}
            </button>
            <button class="analysis-subnav-btn ${currentAnalysisWorkspace === 'timeline' ? 'active' : ''}" onclick="switchAnalysisWorkspace('timeline')">
                <span>🕒</span> ${_t('3. THỜI GIAN & CA KÍP')}
            </button>
        </div>
    `;

    let contentContainer = document.getElementById('analysis-workspace-content');
    if (!contentContainer) {
        contentContainer = document.createElement('div');
        contentContainer.id = 'analysis-workspace-content';
        pane.appendChild(contentContainer);
    }

    if (loadedFilesMap.size === 0) {
        subnav.style.display = 'none';
        contentContainer.innerHTML = `
            <div class="card" style="padding:48px 24px; text-align:center; max-width:680px; margin:20px auto;">
                <div style="font-size:48px; margin-bottom:14px;">📊</div>
                <h3 style="font-size:17px; font-weight:900; margin:0 0 8px; color:var(--text-main);">CHƯA CÓ DỮ LIỆU PHÂN TÍCH CHẤT LƯỢNG</h3>
                <p style="font-size:12.5px; color:var(--text-muted); line-height:1.6; margin:0 auto 24px;">
                    Tính năng Phân Tích Chất Lượng (Pareto 80/20, Ma Trận Đa Lượt Đo, Diễn Biến Sản Xuất) cần dữ liệu từ các tệp nhật ký đo Klippel (Summary .txt / .log).
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
        return;
    }

    subnav.style.display = 'block';

    if (currentAnalysisWorkspace === 'pareto') {
        renderWorkspace1_Pareto(contentContainer);
    } else if (currentAnalysisWorkspace === 'matrix') {
        renderWorkspace2_Matrix(contentContainer);
    } else if (currentAnalysisWorkspace === 'timeline') {
        renderWorkspace3_Timeline(contentContainer);
    }
}

/* ════════════ KHÔNG GIAN 1: TỔNG QUAN & PARETO 80/20 ════════════ */
function renderWorkspace1_Pareto(container) {
    const topDefects = analysisData.errorPareto.slice(0, 5);
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#38bdf8', '#a855f7'];

    let topBarsHtml = '';
    if (topDefects.length > 0) {
        topBarsHtml = `
            <div class="card" style="padding:16px 18px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted);">
                        🔥 ${_t('TOP 5 NGUYÊN NHÂN LỖI LỚN NHẤT (PARETO SUMMARY)')}
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-outline-danger" onclick="copyAllDefectSNs()">📋 ${_t('Copy Tất Cả Mã Lỗi')}</button>
                        <button class="btn btn-sm btn-outline" onclick="exportKPIStandaloneHTML()">📤 ${_t('Xuất Báo Cáo HTML')}</button>
                        <button class="btn btn-sm btn-secondary" onclick="exportParetoExcel()">📥 ${_t('Xuất Excel Pareto')}</button>
                    </div>
                </div>
                <div class="pareto-bars-stack">
        `;
        topDefects.forEach((item, idx) => {
            const color = colors[idx % colors.length];
            topBarsHtml += `
                <div class="pareto-bar-row" onclick="openDrilldownModal('${escapeHtml(item.rawName)}')" title="${_t('Xem danh sách PCS dính lỗi:')} ${escapeHtml(item.mappedName)}">
                    <span class="pareto-bar-label" style="color:${color};">#${idx + 1} ${escapeHtml(item.mappedName)}</span>
                    <div class="pareto-bar-track">
                        <div class="pareto-bar-fill" style="width:${Math.min(item.pctOfDefects, 100)}%; background:${color};"></div>
                    </div>
                    <span class="pareto-bar-val">${item.count} ${_t('Lượt')} (${item.pctOfDefects.toFixed(1)}%)</span>
                </div>
            `;
        });
        topBarsHtml += `</div></div>`;
    }

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
            ${analysisData.noTimestamp ? `<div class="card" style="background:rgba(245,158,11,0.15); border-color:rgba(245,158,11,0.4); color:#fbbf24; padding:10px 14px; font-size:12.5px; font-weight:700;">⚠️ ${_t('Tệp không có cột thời gian — FPY và Biểu đồ theo giờ không khả dụng')}</div>` : ''}

            <!-- 6 Thẻ KPI Vàng -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                <div class="kpi-card">
                    <div class="kpi-label">FIRST PASS YIELD</div>
                    <div class="kpi-val" style="color:#10b981;">${analysisData.noTimestamp ? '—' : analysisData.fpy.toFixed(1) + '%'}</div>
                    <div style="font-size:10px; color:var(--text-muted);">Tỷ lệ đạt lần đo đầu</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">FINAL PASS YIELD</div>
                    <div class="kpi-val" style="color:#38bdf8;">${analysisData.finalPassRate.toFixed(1)}%</div>
                    <div style="font-size:10px; color:var(--text-muted);">Tỷ lệ đạt cuối cùng</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">SẢN PHẨM (DUT)</div>
                    <div class="kpi-val">${analysisData.uniqueUnitsCount.toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--text-muted);">Số đơn vị độc lập</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">ĐO LẠI (RETEST)</div>
                    <div class="kpi-val" style="color:#f59e0b;">${analysisData.noTimestamp ? '—' : analysisData.retestCount.toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--text-muted);">Sản phẩm đo > 1 lần</div>
                </div>
                <div class="kpi-card" style="cursor:pointer;" onclick="openDrilldownModal('ALL_FAIL')" title="Nhấp để xem toàn bộ danh sách PCS lỗi">
                    <div class="kpi-label">SẢN PHẨM LỖI (NG) 🔍</div>
                    <div class="kpi-val" style="color:#ef4444;">${analysisData.failCount.toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--text-muted);">Click xem danh sách</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">TỔNG BẢN GHI ĐO</div>
                    <div class="kpi-val">${analysisData.rawRecordsCount.toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--text-muted);">Tổng các lượt đo thô</div>
                </div>
            </div>

            <!-- Top 5 Lỗi Bars -->
            ${topBarsHtml}

            <!-- Dual-Column: Pareto Chart + Pareto Table -->
            <div style="display:grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 16px;">
                <div class="card" style="padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                        <h4 style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin:0;">
                            📈 BIỂU ĐỒ PARETO LỖI 80/20 · DUAL AXIS
                        </h4>
                        <div style="display:flex; gap:12px; font-size:10px; color:var(--text-sub); font-family:var(--font-mono);">
                            <span>■ SỐ LỖI</span><span style="color:#38bdf8;">— % LUỸ KẾ</span><span style="color:#ef4444;">-- 80%</span>
                        </div>
                    </div>
                    <div style="position:relative; height:300px; width:100%;">
                        <canvas id="pareto-chart-canvas"></canvas>
                    </div>
                </div>

                <div class="card" style="padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin:0;">
                            📋 BẢNG LỖI · DRILLDOWN CHI TIẾT
                        </h4>
                        <span style="font-size:11px; color:var(--text-muted);">${analysisData.errorPareto.length} danh mục</span>
                    </div>
                    <div class="table-wrapper" style="max-height:300px; overflow-y:auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width:36px; text-align:center;">#</th>
                                    <th>Thông Số Lỗi</th>
                                    <th style="text-align:center;">Số Lượng</th>
                                    <th style="text-align:center;">%</th>
                                    <th>% Tích Lũy</th>
                                </tr>
                            </thead>
                            <tbody id="pareto-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    renderParetoTableAndChart();
}

function renderFlagZoneChips() {
    if (!flagZones || flagZones.length === 0) {
        return `<div style="font-size:11.5px; color:var(--text-muted); font-style:italic;">Chưa có mốc sự kiện nào được ghi nhận trong ca. Bấm "+ Thêm Mốc Sự Kiện" để đánh dấu.</div>`;
    }

    let html = '';
    flagZones.forEach((fz, idx) => {
        html += `
            <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.3); border-radius:8px; padding:6px 12px; font-size:12px; display:flex; align-items:center; gap:8px;">
                <span style="font-family:var(--font-mono); font-weight:700; color:var(--accent-blue);">⏰ ${escapeHtml(fz.time)}</span>
                <span style="font-weight:600; color:var(--text-main);">${escapeHtml(fz.label)}</span>
                <button onclick="removeFlagZone(${idx})" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:13px;" title="Xóa mốc">✕</button>
            </div>
        `;
    });
    return html;
}

function promptAddNewFlagZone() {
    const label = prompt('Nhập nội dung sự kiện kỹ thuật (VD: Đổi cuộn dây, Thay Jig, Hiệu chuẩn Mic):');
    if (!label || !label.trim()) return;

    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    flagZones.push({ time: timeStr, label: label.trim() });
    try { localStorage.setItem(LS.FLAGS, JSON.stringify(flagZones)); } catch(e) {}
    renderAnalysisDashboard();
    showToast('✓ Đã ghi nhận mốc sự kiện mới: ' + label.trim(), 'success');
}

function removeFlagZone(idx) {
    flagZones.splice(idx, 1);
    try { localStorage.setItem(LS.FLAGS, JSON.stringify(flagZones)); } catch(e) {}
    renderAnalysisDashboard();
}

/* ════════════ KHÔNG GIAN 2: MA TRẬN ĐA LƯỢT & TƯƠNG QUAN LỖI CHÉO ════════════ */
function renderWorkspace2_Matrix(container) {
    const { runs, rows } = matrixData;
    const totalUnits = rows.length;
    const totalRuns = runs.length;
    const failUnits = rows.filter(r => r.hasFail).length;
    const changedUnits = rows.filter(r => r.hasChanged).length;
    const retestUnits = rows.filter(r => r.totalScans > totalRuns).length;

    const filteredRows = rows.filter(row => {
        if (matrixSearchKeyword && !getAlphaNum(row.sn).includes(matrixSearchKeyword) && !getAlphaNum(row.rawSN).includes(matrixSearchKeyword)) {
            return false;
        }
        if (matrixFilterStatus === 'FAIL' && !row.hasFail) return false;
        if (matrixFilterStatus === 'CHANGED' && !row.hasChanged) return false;
        if (matrixFilterStatus === 'RETEST' && row.totalScans <= totalRuns) return false;
        return true;
    });

    let matrixTableHtml = '';
    if (runs.length === 0 || rows.length === 0) {
        matrixTableHtml = `<div style="text-align:center; padding:30px; color:var(--text-muted);">${_t('Nạp từ 2 tệp log/trạm đo trở lên để xem ma trận so sánh từng PCS')}</div>`;
    } else {
        matrixTableHtml = `
            <div class="table-wrapper" style="max-height:640px; min-height:420px; overflow-y:auto;">
                <table class="data-table" style="white-space:nowrap;">
                    <thead>
                        <tr>
                            <th style="width:40px; text-align:center;">STT</th>
                            <th style="min-width:180px; text-align:left;">Serial Number / DUT</th>
        `;
        runs.forEach(r => {
            matrixTableHtml += `
                <th style="text-align:center; min-width:140px;" title="${escapeHtml(r.fileName)} (Trạm: ${escapeHtml(r.stationName)})">
                    <div style="font-weight:800; color:var(--accent-blue); font-size:12.5px;">${escapeHtml(r.shortLabel)}</div>
                    <div style="font-size:10px; color:var(--text-muted); font-weight:normal; margin-top:2px;">
                        Trạm ${escapeHtml(r.stationName)} · <strong style="color:var(--text-main); font-family:var(--font-mono);">${r.recordCount}</strong> mẫu
                    </div>
                </th>
            `;
        });
        matrixTableHtml += `
                            <th style="width:120px; text-align:center;">Phán Định (${matrixEvalMode === 'FIRST' ? 'Đầu' : 'Cuối'})</th>
                            <th style="width:90px; text-align:center;">Tổng Lần Đo</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        if (filteredRows.length === 0) {
            matrixTableHtml += `<tr><td colspan="${runs.length + 4}" style="text-align:center; color:var(--text-muted); padding:30px;">Không tìm thấy sản phẩm nào phù hợp bộ lọc.</td></tr>`;
        } else {
            filteredRows.forEach((row, idx) => {
                const finalBadge = row.finalVerdict ? `<span class="badge-pill badge-pass">PASS</span>` : `<span class="badge-pill badge-fail">FAIL</span>`;
                matrixTableHtml += `
                    <tr>
                        <td style="text-align:center; color:var(--text-muted);">${idx + 1}</td>
                        <td style="font-family:var(--font-mono); font-weight:700; color:var(--text-main);">${escapeHtml(row.rawSN || row.sn)}</td>
                `;
                runs.forEach(r => {
                    const result = row.runResults[r.id];
                    if (!result) {
                        matrixTableHtml += `<td style="text-align:center; color:var(--text-muted); font-size:12px;">—</td>`;
                    } else if (result.pass) {
                        const countTag = result.count > 1 ? `<span style="font-size:10px; opacity:0.8;"> (${result.count}x)</span>` : '';
                        matrixTableHtml += `
                            <td style="text-align:center; cursor:pointer;" onclick="openMatrixDetailModal('${escapeHtml(row.sn)}', '${escapeHtml(r.id)}')" title="${_t('Nhấp xem chi tiết')} (${result.count} lần đo trong lượt này) | Giờ: ${result.timestamp}">
                                <span class="badge-pill badge-pass">PASS${countTag} 🔍</span>
                            </td>
                        `;
                    } else {
                        const errName = result.errors.length > 0 ? result.errors.join(', ') : 'FAIL';
                        const countTag = result.count > 1 ? `<span style="font-size:10px; opacity:0.8;"> (${result.count}x)</span>` : '';
                        matrixTableHtml += `
                            <td style="text-align:center; cursor:pointer;" onclick="openMatrixDetailModal('${escapeHtml(row.sn)}', '${escapeHtml(r.id)}')" title="${_t('Nhấp xem chi tiết')} (${result.count} lần đo trong lượt này) | Lỗi: ${escapeHtml(errName)}">
                                <span class="badge-pill badge-fail" style="max-width:140px; overflow:hidden; text-overflow:ellipsis; display:inline-block; vertical-align:middle;">❌ ${escapeHtml(errName)}${countTag} 🔍</span>
                            </td>
                        `;
                    }
                });
                matrixTableHtml += `
                        <td style="text-align:center;">${finalBadge}</td>
                        <td style="text-align:center; font-family:var(--font-mono);">${row.totalScans} lần</td>
                    </tr>
                `;
            });
        }
        matrixTableHtml += `</tbody></table></div>`;
    }

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <!-- PHẦN A: MA TRẬN ĐA LƯỢT ĐO -->
            <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
                    <div>
                        <h3 style="font-size:15px; font-weight:900; margin:0; display:flex; align-items:center; gap:8px;">
                            <span>🧩</span> MA TRẬN ĐA LƯỢT ĐO & BIẾN ĐỔI CHẤT LƯỢNG (MULTI-RUN MATRIX)
                        </h3>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            Theo dõi sự thay đổi phán định của từng PCS qua các trạm/lượt đo. Click vào ô bất kỳ để xem chi tiết riêng lượt đó.
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <select class="settings-select" style="font-weight:700; font-size:12px;" onchange="onMatrixEvalModeChange(this.value)" title="Chọn quy tắc lấy kết quả phán định">
                            <option value="LAST" ${matrixEvalMode === 'LAST' ? 'selected' : ''}>🏁 Lấy KQ Lần Cuối (Final)</option>
                            <option value="FIRST" ${matrixEvalMode === 'FIRST' ? 'selected' : ''}>⚡ Lấy KQ Lần Đầu (FPY)</option>
                        </select>
                        <select class="settings-select" style="font-weight:700; font-size:12px;" onchange="onMatrixFilterChange(this.value)">
                            <option value="ALL" ${matrixFilterStatus === 'ALL' ? 'selected' : ''}>Tất cả trạng thái</option>
                            <option value="FAIL" ${matrixFilterStatus === 'FAIL' ? 'selected' : ''}>Chỉ PCS dính lỗi (FAIL)</option>
                            <option value="CHANGED" ${matrixFilterStatus === 'CHANGED' ? 'selected' : ''}>PCS bị đổi kết quả (PASS ↔ FAIL)</option>
                            <option value="RETEST" ${matrixFilterStatus === 'RETEST' ? 'selected' : ''}>PCS đo lại nhiều lần (Retest)</option>
                        </select>
                        <input type="text" placeholder="🔍 Tìm Serial Number..." value="${escapeHtml(matrixSearchKeyword)}" class="settings-input" style="width:180px; font-size:12px;" oninput="onMatrixSearchInput(this.value)">
                        <button class="btn btn-sm btn-outline" onclick="exportMatrixStandaloneHTML()">📤 Xuất Ma Trận HTML</button>
                        <button class="btn btn-sm btn-secondary" onclick="exportMatrixExcel()">📥 Xuất Excel Ma Trận</button>
                    </div>
                </div>

                <!-- 5 Thẻ Tóm Tắt Ma Trận -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:14px;">
                    <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:8px; padding:8px 10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:var(--text-muted);">TỔNG SỐ LƯỢT ĐO</div>
                        <div style="font-size:17px; font-weight:900; color:#38bdf8; font-family:var(--font-mono); margin-top:2px;">${totalRuns} Lượt</div>
                    </div>
                    <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:8px; padding:8px 10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:var(--text-muted);">TỔNG SỐ PCS</div>
                        <div style="font-size:17px; font-weight:900; color:#34d399; font-family:var(--font-mono); margin-top:2px;">${totalUnits} PCS</div>
                    </div>
                    <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; padding:8px 10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:var(--text-muted);">SẢN PHẨM LỖI</div>
                        <div style="font-size:17px; font-weight:900; color:#f87171; font-family:var(--font-mono); margin-top:2px;">${failUnits} (${totalUnits > 0 ? ((failUnits/totalUnits)*100).toFixed(1) : 0}%)</div>
                    </div>
                    <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:8px; padding:8px 10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:var(--text-muted);">ĐỔI KẾT QUẢ</div>
                        <div style="font-size:17px; font-weight:900; color:#f59e0b; font-family:var(--font-mono); margin-top:2px;">${changedUnits} PCS</div>
                    </div>
                    <div style="background:rgba(168,85,247,0.08); border:1px solid rgba(168,85,247,0.25); border-radius:8px; padding:8px 10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:var(--text-muted);">ĐO LẠI (RETEST)</div>
                        <div style="font-size:17px; font-weight:900; color:#c084fc; font-family:var(--font-mono); margin-top:2px;">${retestUnits} PCS</div>
                    </div>
                </div>

                ${matrixTableHtml}
            </div>

            <!-- PHẦN B: MA TRẬN TƯƠNG QUAN LỖI CHÉO (DEFECT CO-OCCURRENCE) -->
            <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="font-size:15px; font-weight:900; margin:0; display:flex; align-items:center; gap:8px;">
                            <span>🔗</span> MA TRẬN TƯƠNG QUAN LỖI CHÉO (DEFECT CO-OCCURRENCE MATRIX)
                        </h3>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            Phân tích xác suất các lỗi xảy ra đồng thời trên cùng 1 con hàng (Giúp phân biệt nguyên nhân Cơ khí vs Điện tử).
                        </div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; align-items:start;">
                    <!-- Bảng Nhiệt Ma Trận N x N -->
                    <div class="table-wrapper" style="max-height:340px; overflow-x:auto;">
                        ${renderCorrelationMatrixTable()}
                    </div>

                    <!-- Danh Sách Top Combo Lỗi -->
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:14px;">
                        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">
                            ⚡ TOP TỔ HỢP LỖI KÉP PHỔ BIẾN NHẤT
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${renderTopCombosList()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCorrelationMatrixTable() {
    const { tasks, matrix } = correlationData;
    if (!tasks || tasks.length === 0) {
        return `<div style="text-align:center; padding:30px; color:var(--text-muted);">Chưa ghi nhận đủ dữ liệu lỗi để lập ma trận tương quan</div>`;
    }

    let html = `<table class="data-table" style="font-size:11px; text-align:center; white-space:nowrap;"><thead><tr><th></th>`;
    tasks.forEach(t => {
        html += `<th style="max-width:90px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(getMappedName(t))}">${escapeHtml(getMappedName(t))}</th>`;
    });
    html += `</tr></thead><tbody>`;

    for (let i = 0; i < tasks.length; i++) {
        html += `<tr><td style="font-weight:700; text-align:left; background:var(--bg-surface-elevated); max-width:110px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(getMappedName(tasks[i]))}">${escapeHtml(getMappedName(tasks[i]))}</td>`;
        for (let j = 0; j < tasks.length; j++) {
            const count = matrix[i][j];
            let bg = 'transparent';
            let color = 'var(--text-muted)';
            if (count > 0) {
                if (i === j) {
                    bg = 'rgba(56,189,248,0.15)'; color = '#38bdf8';
                } else if (count >= 20) {
                    bg = 'rgba(239,68,68,0.35)'; color = '#fca5a5';
                } else if (count >= 5) {
                    bg = 'rgba(245,158,11,0.25)'; color = '#fbbf24';
                } else {
                    bg = 'rgba(56,189,248,0.08)'; color = 'var(--text-main)';
                }
            }
            html += `<td style="background:${bg}; color:${color}; font-weight:${count > 0 ? '700' : 'normal'}; font-family:var(--font-mono);">${count > 0 ? count : '—'}</td>`;
        }
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

function renderTopCombosList() {
    const { combos } = correlationData;
    if (!combos || combos.length === 0) {
        return `<div style="font-size:11.5px; color:var(--text-muted); font-style:italic;">Không có sản phẩm nào dính đồng thời nhiều lỗi.</div>`;
    }

    let html = '';
    combos.forEach((c, idx) => {
        html += `
            <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span style="font-size:11.5px; font-weight:700; color:#f87171; flex:1;">#${idx + 1} ${escapeHtml(c.comboKey)}</span>
                <span style="font-size:12px; font-family:var(--font-mono); font-weight:800; color:var(--text-main);">${c.count} PCS (${c.pct.toFixed(1)}%)</span>
            </div>
        `;
    });
    return html;
}

/* ════════════ KHÔNG GIAN 3: DIỄN BIẾN SẢN XUẤT, CHẤT LƯỢNG & CA KÍP ════════════ */
function openShiftSettingsModal() {
    openSettingsModal();
    switchSettingsSubTab('shifts');
}

function setProductionTimelineInterval(interval) {
    currentProductionInterval = interval;
    calculateProductionTimelineData();
    const contentContainer = document.getElementById('analysis-workspace-content');
    if (contentContainer) renderWorkspace3_Timeline(contentContainer);
}

function setProductionTimelineDefectFilter(defectKey) {
    currentProductionDefectFilter = defectKey;
    calculateProductionTimelineData();
    const contentContainer = document.getElementById('analysis-workspace-content');
    if (contentContainer) renderWorkspace3_Timeline(contentContainer);
}

function filterTimelineBySpecificError(rawName) {
    setProductionTimelineDefectFilter(rawName);
    showToast(`🔍 Đang lọc diễn biến theo lỗi: ${getMappedName(rawName)}`, 'info');
}

function renderWorkspace3_Timeline(container) {
    const sum = productionTimelineData.summary || { total: 0, pass: 0, fail: 0, yieldRate: 0, filteredDefectCount: 0, filteredDefectRate: 0 };
    const isFilteringDefect = currentProductionDefectFilter !== 'ALL';
    const activeDefectName = isFilteringDefect ? getMappedName(currentProductionDefectFilter) : '';

    // Tạo danh sách tùy chọn lỗi từ Pareto
    let defectOptionsHtml = `<option value="ALL" ${!isFilteringDefect ? 'selected' : ''}>🔍 Tất Cả Các Lỗi (Tổng Hợp NG Toàn Diện)</option>`;
    (analysisData.errorPareto || []).forEach(err => {
        const isSel = currentProductionDefectFilter === err.rawName ? 'selected' : '';
        defectOptionsHtml += `<option value="${escapeHtml(err.rawName)}" ${isSel}>⚠️ [${err.count} Lỗi] ${escapeHtml(err.mappedName)} (${escapeHtml(err.rawName)})</option>`;
    });

    // 8 Mốc Khung Thời Gian
    const intervals = [
        { id: '15_MIN', label: '15 Phút' },
        { id: '30_MIN', label: '30 Phút' },
        { id: '45_MIN', label: '45 Phút' },
        { id: '60_MIN', label: '60 Phút (1h)' },
        { id: '2_HOUR', label: '2 Giờ' },
        { id: '5_HOUR', label: '5 Giờ' },
        { id: '1_DAY',  label: '1 Ngày (24h)' },
        { id: 'SHIFT',  label: 'Theo Ca Kíp' }
    ];

    let intervalButtonsHtml = '';
    intervals.forEach(it => {
        const isActive = (currentProductionInterval || '60_MIN') === it.id;
        intervalButtonsHtml += `
            <button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}" 
                    onclick="setProductionTimelineInterval('${it.id}')"
                    style="font-size:11.5px; padding:4px 10px; font-weight:${isActive ? '800' : '600'};">
                ${it.label}
            </button>
        `;
    });

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <!-- THANH ĐIỀU KHIỂN & BỘ LỌC ĐA KHUNG THỜI GIAN / LỖI CỤ THỂ -->
            <div class="card" style="padding:16px 18px; border-color:var(--accent-blue); box-shadow:0 8px 24px rgba(0,242,254,0.06);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h3 style="font-size:15px; font-weight:900; margin:0; display:flex; align-items:center; gap:8px;">
                            <span>🕒</span> DIỄN BIẾN CHẤT LƯỢNG SẢN XUẤT THEO KHUNG THỜI GIAN CHUẨN
                        </h3>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            Phân tích chi tiết năng suất &amp; chất lượng trong từng <strong>15p, 30p, 45p, 60p, 2h, 5h, 1 ngày</strong> theo timestamp tệp Klippel.
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-secondary" onclick="exportProductionTimelineExcel()">📥 Xuất Excel Diễn Biến</button>
                        <button class="btn btn-sm btn-outline" onclick="openShiftSettingsModal()">⚙️ Cài Đặt Giờ Ca</button>
                    </div>
                </div>

                <!-- Dải nút chọn Khung thời gian & Dropdown lọc lỗi -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:12px; border-top:1px solid var(--border-color); flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-right:4px;">⏱️ Khung Chia:</span>
                        ${intervalButtonsHtml}
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">🎯 Lọc Lỗi:</span>
                        <select id="timeline-defect-select" class="form-select" onchange="setProductionTimelineDefectFilter(this.value)" style="min-width:280px; font-size:12px; font-weight:700; background:var(--bg-surface); border-color:var(--border-color); color:var(--text-main); padding:5px 10px; border-radius:8px;">
                            ${defectOptionsHtml}
                        </select>
                        ${isFilteringDefect ? `<button class="btn btn-sm btn-outline-danger" onclick="setProductionTimelineDefectFilter('ALL')" style="font-size:11px;">✕ Hủy Lọc</button>` : ''}
                    </div>
                </div>
            </div>

            <!-- 4 THẺ TỔNG QUAN DIỄN BIẾN SẢN XUẤT -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                <div class="kpi-card">
                    <div class="kpi-label">TỔNG SẢN LƯỢNG ĐO</div>
                    <div class="kpi-val">${sum.total.toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--text-muted);">Tổng các lượt đo trong giai đoạn</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${isFilteringDefect ? 'SỐ LƯỢNG LỖI ĐANG LỌC' : 'TỔNG LỖI PHÁT SINH'}</div>
                    <div class="kpi-val" style="color:#ef4444;">${(isFilteringDefect ? sum.filteredDefectCount : sum.fail).toLocaleString()}</div>
                    <div style="font-size:10px; color:var(--text-muted);">${isFilteringDefect ? `Chiếm ${sum.filteredDefectRate.toFixed(1)}% sản lượng` : `Tỷ lệ NG: ${sum.ngRate.toFixed(1)}%`}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${isFilteringDefect ? 'TỶ LỆ LỖI TRUNG BÌNH' : 'TỶ LỆ ĐẠT TRUNG BÌNH'}</div>
                    <div class="kpi-val" style="color:${isFilteringDefect ? '#f59e0b' : '#10b981'};">${(isFilteringDefect ? sum.filteredDefectRate : sum.yieldRate).toFixed(1)}%</div>
                    <div style="font-size:10px; color:var(--text-muted);">${isFilteringDefect ? activeDefectName : 'First/Final Pass Yield'}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">KHUNG GIỜ ĐẠT CAO NHẤT</div>
                    <div class="kpi-val" style="color:#38bdf8; font-size:16px; margin-top:2px;">
                        ${sum.peakBucket ? `${sum.peakBucket.label} (${sum.peakBucket.yieldRate.toFixed(1)}%)` : '—'}
                    </div>
                    <div style="font-size:10px; color:var(--text-muted);">${sum.worstBucket ? `Thấp nhất: ${sum.worstBucket.label} (${sum.worstBucket.yieldRate.toFixed(1)}%)` : '—'}</div>
                </div>
            </div>

            <!-- PHẦN 2: BIỂU ĐỒ DIỄN BIẾN SẢN LƯỢNG & TỶ LỆ ĐẠT / LỖI (ĐƯỜNG TRÊN CỘT) -->
            <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h4 style="font-size:13.5px; font-weight:900; margin:0; display:flex; align-items:center; gap:8px;">
                            <span>📊</span> BIỂU ĐỒ DIỄN BIẾN ${isFilteringDefect ? `LỖI: "${escapeHtml(activeDefectName)}"` : 'SẢN LƯỢNG &amp; TỶ LỆ ĐẠT'}
                        </h4>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            ${isFilteringDefect ? `Theo dõi số lần xuất hiện và tỷ lệ phát sinh của lỗi <strong>${escapeHtml(activeDefectName)}</strong> qua từng khung thời gian.` : 'Biểu đồ kết hợp Sản lượng Đạt (PASS), Lỗi (FAIL/NG) và Đường Tỷ lệ Đạt (Yield %) hiển thị lớp trên cùng.'}
                        </div>
                    </div>
                    <div style="display:flex; gap:14px; font-size:11px; color:var(--text-sub); font-family:var(--font-mono); align-items:center;">
                        ${!isFilteringDefect ? `
                            <span style="color:#10b981;">■ ĐẠT (PASS)</span>
                            <span style="color:#ef4444;">■ LỖI (FAIL)</span>
                            <span style="color:#00f2fe; font-weight:800;">— TỶ LỆ ĐẠT (%)</span>
                        ` : `
                            <span style="color:#0ea5e9;">■ KHÔNG BỊ LỖI NÀY</span>
                            <span style="color:#ef4444; font-weight:700;">■ SỐ LẦN DÍNH LỖI NÀY</span>
                            <span style="color:#f59e0b; font-weight:800;">— TỶ LỆ LỖI (%)</span>
                        `}
                    </div>
                </div>
                <div style="position:relative; height:320px; width:100%;">
                    <canvas id="production-chart-canvas"></canvas>
                </div>
            </div>

            <!-- PHẦN 3: BẢNG PHÂN TÍCH DIỄN BIẾN CHI TIẾT & BÓC TÁCH LỖI CỤ THỂ TỪNG KHUNG GIỜ -->
            <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h4 style="font-size:13.5px; font-weight:900; margin:0; display:flex; align-items:center; gap:8px;">
                            <span>📋</span> BẢNG CHI TIẾT SẢN XUẤT &amp; BÓC TÁCH LỖI NG CỤ THỂ TỪNG KHUNG GIỜ
                        </h4>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            Hiển thị chi tiết từng lỗi phát sinh (Defect Breakdown Tag Cloud). Nhấp vào bất kỳ mã lỗi nào để lọc biểu đồ hoặc bấm "Xem PCS" để truy vết mã vạch.
                        </div>
                    </div>
                </div>
                ${renderProductionTimelineBreakdownTable()}
            </div>

            <!-- PHẦN 4: CỘT MỐC SỰ KIỆN CA SẢN XUẤT (EVENT MILESTONES) -->
            <div class="card" style="padding:16px 18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h4 style="font-size:12.5px; font-weight:800; text-transform:uppercase; color:var(--text-main); margin:0; display:flex; align-items:center; gap:6px;">
                            <span>🚩</span> CỘT MỐC SỰ KIỆN CA SẢN XUẤT (EVENT MILESTONES)
                        </h4>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            Đánh dấu các mốc can thiệp kỹ thuật (Đổi cuộn dây, Thay Jig, Giao ca, Hiệu chuẩn) để đối chiếu trực tiếp với diễn biến lỗi theo thời gian.
                        </div>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="promptAddNewFlagZone()">+ Thêm Mốc Sự Kiện</button>
                </div>
                <div id="flag-zones-container" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                    ${renderFlagZoneChips()}
                </div>
            </div>

            <!-- PHẦN 5: HIỆU SUẤT THEO CA SẢN XUẤT -->
            <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="font-size:15px; font-weight:900; margin:0; display:flex; align-items:center; gap:8px;">
                            <span>⏱️</span> HIỆU SUẤT THEO CA SẢN XUẤT
                        </h3>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            Thống kê sản lượng, tỷ lệ Đạt (FPY) và Top 3 lỗi trọng điểm của từng ca làm việc.
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="openShiftSettingsModal()">⚙️ Cài Đặt Giờ Ca</button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
                    ${renderShiftCards()}
                </div>
            </div>

            <!-- PHẦN 6: SO SÁNH TRẠM & MODEL -->
            <div class="card" style="padding:18px;">
                <h3 style="font-size:15px; font-weight:900; margin:0 0 14px; display:flex; align-items:center; gap:8px;">
                    <span>⚖️</span> SO SÁNH NĂNG LỰC TRẠM ĐO &amp; MODEL
                </h3>
                <div style="display:grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px;">
                    <!-- Trạm đo -->
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:14px;">
                        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">
                            🏭 SO SÁNH GIỮA CÁC TRẠM / MÁY ĐO KLIPPEL
                        </div>
                        <div class="table-wrapper">
                            ${renderStationBenchmarkTable()}
                        </div>
                    </div>

                    <!-- Model -->
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:14px;">
                        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">
                            📦 PHÂN BỔ TỶ LỆ LỖI THEO MODEL SẢN PHẨM
                        </div>
                        <div class="table-wrapper">
                            ${renderModelBenchmarkTable()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    renderProductionTimelineChart();
}

/**
 * Biểu đồ diễn biến sản xuất & chất lượng đa khung thời gian
 * BẢO ĐẢM 100%: Đường biểu diễn (Line) luôn vẽ ĐÈ LÊN TRÊN (order: 1) so với Cột (order: 2)
 */
function renderProductionTimelineChart() {
    const canvas = document.getElementById('production-chart-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (productionTimelineChartInstance) {
        productionTimelineChartInstance.destroy();
        productionTimelineChartInstance = null;
    }

    const buckets = productionTimelineData.buckets || [];
    if (buckets.length === 0) return;

    const labels = buckets.map(b => b.label);
    const isFilteringDefect = currentProductionDefectFilter !== 'ALL';
    const isLight = document.body.classList.contains('light-theme');
    const textCol = isLight ? '#475569' : '#94a3b8';
    const gridCol = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

    let datasets = [];

    if (!isFilteringDefect) {
        const passData = buckets.map(b => b.pass);
        const failData = buckets.map(b => b.fail);
        const yieldData = buckets.map(b => Number(b.yieldRate.toFixed(1)));

        datasets = [
            {
                label: _t('Sản Lượng ĐẠT (PASS)'),
                data: passData,
                type: 'bar',
                order: 2, // CỘT Ở DƯỚI
                backgroundColor: 'rgba(16, 185, 129, 0.75)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 4,
                stack: 'output',
                yAxisID: 'y'
            },
            {
                label: _t('Sản Lượng LỖI (FAIL/NG)'),
                data: failData,
                type: 'bar',
                order: 2, // CỘT Ở DƯỚI
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: '#ef4444',
                borderWidth: 1,
                borderRadius: 4,
                stack: 'output',
                yAxisID: 'y'
            },
            {
                label: _t('Tỷ Lệ Đạt (Yield %)'),
                data: yieldData,
                type: 'line',
                order: 1, // ĐƯỜNG Ở TRÊN CÙNG
                borderColor: '#00f2fe',
                backgroundColor: 'rgba(0, 242, 254, 0.15)',
                borderWidth: 3,
                pointBackgroundColor: '#00f2fe',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4.5,
                pointHoverRadius: 7,
                tension: 0.25,
                yAxisID: 'y1'
            }
        ];
    } else {
        const otherData = buckets.map(b => b.total - b.selectedDefectCount);
        const defectCounts = buckets.map(b => b.selectedDefectCount);
        const defectRates = buckets.map(b => Number(b.selectedDefectRate.toFixed(1)));

        datasets = [
            {
                label: _t('Sản Phẩm Không Dính Lỗi Này'),
                data: otherData,
                type: 'bar',
                order: 2, // CỘT Ở DƯỚI
                backgroundColor: 'rgba(14, 165, 233, 0.5)',
                borderColor: '#0ea5e9',
                borderWidth: 1,
                borderRadius: 4,
                stack: 'output',
                yAxisID: 'y'
            },
            {
                label: `${_t('Số Lần Dính Lỗi:')} ${getMappedName(currentProductionDefectFilter)}`,
                data: defectCounts,
                type: 'bar',
                order: 2, // CỘT Ở DƯỚI
                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                borderColor: '#ef4444',
                borderWidth: 1.5,
                borderRadius: 4,
                stack: 'output',
                yAxisID: 'y'
            },
            {
                label: _t('Tỷ Lệ Lỗi Này (%)'),
                data: defectRates,
                type: 'line',
                order: 1, // ĐƯỜNG Ở TRÊN CÙNG
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: '#fbbf24',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4.5,
                pointHoverRadius: 7,
                tension: 0.25,
                yAxisID: 'y1'
            }
        ];
    }

    productionTimelineChartInstance = new Chart(canvas.getContext('2d'), {
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: textCol, font: { weight: 'bold', size: 11 } } },
                tooltip: {
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        afterBody: (tooltipItems) => {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const bucket = buckets[dataIndex];
                            if (!bucket || !bucket.errorBreakdown || bucket.errorBreakdown.length === 0) {
                                return '\n✓ 100% Đạt Chuẩn (Không có lỗi)';
                            }
                            let text = '\n🔍 Chi tiết lỗi trong khung giờ:';
                            bucket.errorBreakdown.slice(0, 4).forEach(err => {
                                text += `\n • ${err.mappedName}: ${err.count} PCS (${err.pctOfTotal.toFixed(1)}%)`;
                            });
                            if (bucket.errorBreakdown.length > 4) {
                                text += `\n • ...và ${bucket.errorBreakdown.length - 4} lỗi khác`;
                            }
                            return text;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: textCol, font: { size: 11 } }, grid: { color: gridCol }, stacked: true },
                y: { type: 'linear', position: 'left', stacked: true, ticks: { color: textCol }, grid: { color: gridCol }, title: { display: true, text: _t('Sản Lượng (PCS)'), color: textCol } },
                y1: { 
                    type: 'linear', 
                    position: 'right', 
                    min: 0, 
                    max: 100, 
                    ticks: { color: isFilteringDefect ? '#f59e0b' : '#00f2fe', callback: val => `${val}%` }, 
                    grid: { drawOnChartArea: false }, 
                    title: { display: true, text: isFilteringDefect ? _t('Tỷ Lệ Lỗi Này (%)') : _t('Tỷ Lệ Đạt (%)'), color: isFilteringDefect ? '#f59e0b' : '#00f2fe' } 
                }
            }
        }
    });
}

/**
 * Render Bảng Chi Tiết Diễn Biến Sản Xuất & Bóc Tách Lỗi NG Cụ Thể Từng Khung Giờ
 */
function renderProductionTimelineBreakdownTable() {
    const buckets = productionTimelineData.buckets || [];
    if (buckets.length === 0) {
        return `<div style="text-align:center; color:var(--text-muted); padding:20px;">Không có dữ liệu thời gian để lập bảng chi tiết</div>`;
    }

    let html = `
        <div class="table-wrapper" style="max-height:420px; overflow-y:auto;">
            <table class="data-table" style="font-size:12px;">
                <thead style="position:sticky; top:0; z-index:2; background:var(--bg-surface-elevated);">
                    <tr>
                        <th style="width:45px; text-align:center;">STT</th>
                        <th>Khung Thời Gian</th>
                        <th style="text-align:center;">Sản Lượng</th>
                        <th style="text-align:center;">Đạt (PASS)</th>
                        <th style="text-align:center;">Lỗi (FAIL/NG)</th>
                        <th style="text-align:center;">Tỷ Lệ Đạt</th>
                        <th>Bóc Tách Các Lỗi NG Cụ Thể (Số lượng PCS dính lỗi)</th>
                        <th style="text-align:center; width:90px;">Thao Tác</th>
                    </tr>
                </thead>
                <tbody>
    `;

    buckets.forEach((b, idx) => {
        const rateColor = b.yieldRate >= 90 ? '#10b981' : (b.yieldRate >= 80 ? '#f59e0b' : '#ef4444');
        
        let errorChipsHtml = '';
        if (!b.errorBreakdown || b.errorBreakdown.length === 0) {
            errorChipsHtml = `<span style="color:#10b981; font-size:11.5px; font-weight:600;">✓ 100% Đạt Chuẩn (0 lỗi)</span>`;
        } else {
            errorChipsHtml = `<div style="display:flex; flex-wrap:wrap; gap:5px;">`;
            b.errorBreakdown.forEach(err => {
                const isSelected = currentProductionDefectFilter === err.rawName;
                const chipBg = isSelected ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.12)';
                const chipBorder = isSelected ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.3)';
                errorChipsHtml += `
                    <span class="badge-pill badge-fail" 
                          style="background:${chipBg}; border:1px solid ${chipBorder}; font-size:11px; cursor:pointer;"
                          onclick="filterTimelineBySpecificError('${escapeHtml(err.rawName)}')"
                          title="Bấm để lọc biểu đồ theo lỗi này: ${escapeHtml(err.mappedName)}">
                        ${escapeHtml(err.mappedName)}: <strong>${err.count}</strong>
                    </span>
                `;
            });
            errorChipsHtml += `</div>`;
        }

        html += `
            <tr>
                <td style="text-align:center; color:var(--text-muted); font-weight:700;">${idx + 1}</td>
                <td>
                    <strong style="color:var(--accent-blue); font-family:var(--font-mono);">${escapeHtml(b.label)}</strong>
                    <div style="font-size:10.5px; color:var(--text-muted);">${escapeHtml(b.dateStr)}</div>
                </td>
                <td style="text-align:center; font-weight:800; font-family:var(--font-mono);">${b.total.toLocaleString()}</td>
                <td style="text-align:center; font-family:var(--font-mono); color:#10b981; font-weight:700;">${b.pass.toLocaleString()}</td>
                <td style="text-align:center; font-family:var(--font-mono); color:#ef4444; font-weight:800;">${b.fail.toLocaleString()}</td>
                <td style="text-align:center; font-weight:900; font-family:var(--font-mono); color:${rateColor}; font-size:13px;">
                    ${b.yieldRate.toFixed(1)}%
                </td>
                <td>${errorChipsHtml}</td>
                <td style="text-align:center;">
                    <button class="btn btn-sm btn-outline" onclick="openBucketDrilldown('${escapeHtml(b.key)}')" style="font-size:11px; padding:3px 8px;" title="Xem danh sách mã vạch đo trong khung giờ này">
                        🔍 Xem PCS
                    </button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    return html;
}

/**
 * Mở modal xem danh sách các bản ghi trong khung thời gian cụ thể
 */
function openBucketDrilldown(bucketKey) {
    const bucket = (productionTimelineData.buckets || []).find(b => b.key === bucketKey);
    if (!bucket || !bucket.records || bucket.records.length === 0) {
        showToast('Không có dữ liệu trong khung giờ này', 'warning');
        return;
    }
    openCustomRecordsModal(`${_t('Chi Tiết Bản Ghi')} · ${bucket.label} (${bucket.dateStr})`, bucket.records);
}

/**
 * Xuất Excel chuyên biệt cho Bảng Diễn Biến Sản Xuất & Bóc Tách Lỗi Theo Khung Giờ
 */
async function exportProductionTimelineExcel() {
    if (typeof ExcelJS === 'undefined') {
        showToast('⚠️ Thư viện ExcelJS chưa tải xong.', 'warning');
        return;
    }

    const buckets = productionTimelineData.buckets || [];
    if (buckets.length === 0) {
        showToast('⚠️ Không có dữ liệu diễn biến để xuất.', 'warning');
        return;
    }

    showToast('⏳ Đang xuất báo cáo Excel Diễn Biến Sản Xuất...', 'info');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QIT Scanner v2';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Production Timeline');
    ws.addRow(['QIT SCANNER V2 — BÁO CÁO DIỄN BIẾN SẢN XUẤT & BÓC TÁCH LỖI THEO THỜI GIAN']);
    ws.addRow(['Khung chia thời gian:', currentProductionInterval || '60_MIN']);
    ws.addRow(['Bộ lọc lỗi hiện tại:', currentProductionDefectFilter === 'ALL' ? 'Tất cả lỗi' : getMappedName(currentProductionDefectFilter)]);
    ws.addRow(['Thời gian xuất:', new Date().toLocaleString()]);
    ws.addRow([]);

    ws.addRow(['STT', 'Ngày', 'Khung Giờ', 'Tổng Sản Lượng', 'Đạt (PASS)', 'Lỗi (FAIL)', 'Tỷ Lệ Đạt (Yield %)', 'Chi Tiết Phân Tách Các Lỗi NG']);

    buckets.forEach((b, idx) => {
        const errDetail = (b.errorBreakdown || []).map(e => `${e.mappedName}: ${e.count}`).join(' | ');
        ws.addRow([
            idx + 1,
            b.dateStr,
            b.label,
            b.total,
            b.pass,
            b.fail,
            b.yieldRate.toFixed(2) + '%',
            errDetail || '100% Đạt Chuẩn (0 lỗi)'
        ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QIT_Production_Timeline_${currentProductionInterval}_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Đã xuất báo cáo Excel Diễn Biến Sản Xuất thành công!', 'success');
}

function renderShiftCards() {
    const shifts = shiftData.shifts || [];
    if (shifts.length === 0) {
        return `<div style="text-align:center; padding:20px; color:var(--text-muted);">Chưa có dữ liệu ca</div>`;
    }

    let html = '';
    shifts.forEach(s => {
        const yieldColor = s.fpy >= 90 ? '#10b981' : (s.fpy >= 80 ? '#f59e0b' : '#ef4444');
        let topErrHtml = s.topErrors && s.topErrors.length > 0
            ? s.topErrors.map(e => `<span class="badge-pill badge-fail" style="font-size:10px;">${escapeHtml(e.name)}: ${e.count}</span>`).join(' ')
            : `<span style="font-size:11px; color:var(--text-muted);">Không ghi nhận lỗi</span>`;

        html += `
            <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:12px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:13px; color:var(--text-main);">${escapeHtml(s.name)}</strong>
                    <span style="font-size:17px; font-weight:900; font-family:var(--font-mono); color:${yieldColor};">${s.fpy.toFixed(1)}%</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:8px;">
                    <span>Tổng sản lượng: <strong style="color:var(--text-main); font-family:var(--font-mono);">${s.total}</strong></span>
                    <span>Đạt / Lỗi: <strong style="color:#10b981;">${s.pass}</strong> / <strong style="color:#ef4444;">${s.fail}</strong></span>
                </div>
                <div style="font-size:11px; color:var(--text-sub);">
                    Top lỗi: ${topErrHtml}
                </div>
            </div>
        `;
    });

    return html;
}

function renderStationBenchmarkTable() {
    const { stations } = benchmarkData;
    if (!stations || stations.length === 0) {
        return `<div style="text-align:center; padding:20px; color:var(--text-muted);">Chưa có dữ liệu trạm đo</div>`;
    }

    let html = `
        <table class="data-table" style="font-size:11.5px;">
            <thead>
                <tr>
                    <th>Tên Trạm</th>
                    <th style="text-align:center;">Sản Lượng</th>
                    <th style="text-align:center;">Đạt (PASS)</th>
                    <th style="text-align:center;">Lỗi (FAIL)</th>
                    <th style="text-align:center;">Tỷ Lệ Đạt</th>
                </tr>
            </thead>
            <tbody>
    `;

    stations.forEach(st => {
        const rateCol = st.passRate >= 90 ? '#10b981' : (st.passRate >= 80 ? '#f59e0b' : '#ef4444');
        html += `
            <tr>
                <td style="font-weight:700; color:var(--accent-blue);">${escapeHtml(st.stationName)}</td>
                <td style="text-align:center; font-family:var(--font-mono);">${st.total}</td>
                <td style="text-align:center; font-family:var(--font-mono); color:#10b981;">${st.pass}</td>
                <td style="text-align:center; font-family:var(--font-mono); color:#ef4444;">${st.fail}</td>
                <td style="text-align:center; font-weight:800; font-family:var(--font-mono); color:${rateCol};">${st.passRate.toFixed(1)}%</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    return html;
}

function renderModelBenchmarkTable() {
    const { models } = benchmarkData;
    if (!models || models.length === 0) {
        return `<div style="text-align:center; padding:20px; color:var(--text-muted);">Chưa có dữ liệu Model</div>`;
    }

    let html = `
        <table class="data-table" style="font-size:11.5px;">
            <thead>
                <tr>
                    <th>Mã Model</th>
                    <th style="text-align:center;">Sản Lượng</th>
                    <th style="text-align:center;">Lỗi (FAIL)</th>
                    <th style="text-align:center;">Tỷ Lệ Đạt</th>
                </tr>
            </thead>
            <tbody>
    `;

    models.forEach(md => {
        const rateCol = md.passRate >= 90 ? '#10b981' : (md.passRate >= 80 ? '#f59e0b' : '#ef4444');
        html += `
            <tr>
                <td style="font-weight:700; font-family:var(--font-mono);">${escapeHtml(md.modelName)}</td>
                <td style="text-align:center; font-family:var(--font-mono);">${md.total}</td>
                <td style="text-align:center; font-family:var(--font-mono); color:#ef4444;">${md.fail}</td>
                <td style="text-align:center; font-weight:800; font-family:var(--font-mono); color:${rateCol};">${md.passRate.toFixed(1)}%</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    return html;
}

/* ════════════ PARETO CHART & TABLE HELPER (ĐƯỜNG TRÊN CỘT) ════════════ */
function renderParetoTableAndChart() {
    const tbody = document.getElementById('pareto-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if (analysisData.errorPareto.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">${_t('Không ghi nhận lỗi nào')}</td></tr>`;
        } else {
            analysisData.errorPareto.forEach((item, idx) => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.onclick = () => openDrilldownModal(item.rawName);

                const is80Cutoff = item.cumPercent <= 80 || (idx > 0 && analysisData.errorPareto[idx - 1].cumPercent < 80);
                const cumColor = is80Cutoff ? '#ef4444' : '#38bdf8';

                tr.innerHTML = `
                    <td style="text-align:center; font-weight:700; color:var(--text-muted);">${idx + 1}</td>
                    <td>
                        <strong>${escapeHtml(item.mappedName)}</strong>
                        <div style="font-size:10px; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(item.rawName)}</div>
                    </td>
                    <td style="color:#f87171; font-weight:800; text-align:center; font-family:var(--font-mono);">${item.count}</td>
                    <td style="text-align:center;"><span class="badge-pill" style="background:rgba(239,68,68,0.12); color:#fca5a5; border:1px solid rgba(239,68,68,0.3);">${item.pctOfDefects.toFixed(1)}%</span></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="flex:1; background:rgba(255,255,255,0.06); height:8px; border-radius:4px; overflow:hidden;">
                                <div style="width:${Math.min(item.cumPercent, 100)}%; background:${cumColor}; height:100%; border-radius:4px;"></div>
                            </div>
                            <span style="font-size:11px; font-weight:700; font-family:var(--font-mono); color:${cumColor}; width:42px; text-align:right;">${item.cumPercent.toFixed(1)}%</span>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    const canvas = document.getElementById('pareto-chart-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (paretoChartInstance) {
        paretoChartInstance.destroy();
        paretoChartInstance = null;
    }

    if (analysisData.errorPareto.length === 0) return;

    const labels = analysisData.errorPareto.map(item => item.mappedName);
    const counts = analysisData.errorPareto.map(item => item.count);
    const cumPcts = analysisData.errorPareto.map(item => item.cumPercent);

    const isLight = document.body.classList.contains('light-theme');
    const textCol = isLight ? '#475569' : '#94a3b8';
    const gridCol = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

    paretoChartInstance = new Chart(canvas.getContext('2d'), {
        data: {
            labels: labels,
            datasets: [
                {
                    label: _t('Số Lượng Lỗi'),
                    data: counts,
                    type: 'bar',
                    order: 2, // CỘT Ở DƯỚI
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: _t('% Tích Lũy'),
                    data: cumPcts,
                    type: 'line',
                    order: 1, // ĐƯỜNG Ở TRÊN CÙNG
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#00f2fe',
                    pointRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: textCol, font: { weight: 'bold', size: 11 } } },
                tooltip: { padding: 10, cornerRadius: 8 }
            },
            scales: {
                x: { ticks: { color: textCol, maxRotation: 45, minRotation: 0, font: { size: 10 } }, grid: { color: gridCol } },
                y: { type: 'linear', position: 'left', ticks: { color: textCol }, grid: { color: gridCol }, title: { display: true, text: _t('Số Lỗi'), color: textCol } },
                y1: { type: 'linear', position: 'right', min: 0, max: 100, ticks: { color: '#38bdf8', callback: val => `${val}%` }, grid: { drawOnChartArea: false }, title: { display: true, text: '% Tích Lũy', color: '#38bdf8' } }
            }
        }
    });
}

/* ════════════ BẢN ĐỒ NHIỆT THEO CA / KHUNG GIỜ ════════════ */
function renderHourlyYieldHeatmap() {
    const container = document.getElementById('hourly-yield-container');
    if (!container) return;

    if (analysisData.noTimestamp || filteredTimelineData.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">${_t('Không có dữ liệu thời gian để lập bản đồ nhiệt')}</div>`;
        return;
    }

    const hourlyStats = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, pass: 0, fail: 0 }));

    filteredTimelineData.forEach(r => {
        if (r.timestamp) {
            const h = r.timestamp.getHours();
            hourlyStats[h].total++;
            if (isRecordPass(r)) hourlyStats[h].pass++;
            else hourlyStats[h].fail++;
        }
    });

    const activeHours = hourlyStats.filter(s => s.total > 0);
    if (activeHours.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">${_t('Chưa có lượt đo nào trong các khung giờ')}</div>`;
        return;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:11px; color:var(--text-muted); flex-wrap:wrap; gap:8px;">
            <div>${_t('Mức độ tỷ lệ lỗi')}: <span style="color:#10b981;">0% (Xanh)</span> $\\rightarrow$ <span style="color:#ef4444;">Cao (Đỏ đậm)</span></div>
            <div>${_t('Tổng số khung giờ ghi nhận')}: <strong>${activeHours.length} ${_t('giờ')}</strong></div>
        </div>
        <div class="hourly-grid">
    `;

    hourlyStats.forEach(s => {
        if (s.total === 0) return;
        const yieldRate = (s.pass / s.total) * 100;
        const failRate = (s.fail / s.total) * 100;

        let bg = 'rgba(16, 185, 129, 0.1)';
        let border = 'rgba(16, 185, 129, 0.3)';
        let textCol = '#34d399';

        if (failRate > 30) {
            bg = 'rgba(239, 68, 68, 0.25)'; border = 'rgba(239, 68, 68, 0.6)'; textCol = '#f87171';
        } else if (failRate > 15) {
            bg = 'rgba(245, 158, 11, 0.2)'; border = 'rgba(245, 158, 11, 0.5)'; textCol = '#fbbf24';
        } else if (failRate > 5) {
            bg = 'rgba(56, 189, 248, 0.15)'; border = 'rgba(56, 189, 248, 0.4)'; textCol = '#38bdf8';
        }

        const hStr = `${String(s.hour).padStart(2, '0')}:00`;

        html += `
            <div class="hourly-card" style="background:${bg}; border-color:${border};">
                <div class="hourly-time">${hStr}</div>
                <div class="hourly-yield" style="color:${textCol};">${yieldRate.toFixed(1)}%</div>
                <div class="hourly-counts">${s.pass}P / ${s.fail}F (${s.total})</div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function onMatrixFilterChange(val) {
    matrixFilterStatus = val;
    renderAnalysisDashboard();
}

function onMatrixSearchInput(val) {
    matrixSearchKeyword = getAlphaNum(val);
    renderAnalysisDashboard();
}

function onMatrixEvalModeChange(val) {
    matrixEvalMode = val;
    calculateMatrixData();
    renderAnalysisDashboard();
    showToast(`✓ Đã chuyển sang chế độ: ${val === 'FIRST' ? 'Lấy kết quả LẦN ĐẦU (FPY)' : 'Lấy kết quả LẦN CUỐI (Final)'}`, 'info');
}

function openMatrixDetailModal(sn, runId, showAllRuns = false) {
    const ev = analysisData.events.find(e => e.sn === sn);
    if (!ev) return;

    const modal = document.getElementById('drilldown-modal');
    if (!modal) return;

    const titleEl = document.getElementById('drilldown-modal-title');
    const tbody = document.getElementById('drilldown-modal-tbody');
    const thead = modal.querySelector('.modal-body thead');

    const runInfo = runId ? matrixData.runs.find(r => r.id === runId) : null;
    const targetRecords = (!showAllRuns && runId) ? ev.records.filter(r => r.fileId === runId) : ev.records;

    if (titleEl) {
        if (runInfo && !showAllRuns) {
            titleEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <span style="color:var(--accent-blue);">🔍 ${escapeHtml(runInfo.shortLabel)}</span> 
                        <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">(Trạm: ${escapeHtml(runInfo.stationName)})</span>
                        <div style="font-size:13px; color:var(--text-main); font-weight:700; margin-top:2px;">
                            PCS: <strong style="font-family:var(--font-mono); color:#38bdf8;">${escapeHtml(ev.rawSN || sn)}</strong>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="openMatrixDetailModal('${escapeHtml(sn)}', '${escapeHtml(runId)}', true)" style="font-size:11px;">
                        📋 Xem toàn bộ ${ev.records.length} lần đo của PCS này
                    </button>
                </div>
            `;
        } else {
            titleEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <span style="color:#38bdf8;">🔍 TOÀN BỘ LỊCH SỬ ĐO (${ev.records.length} LẦN)</span>
                        <div style="font-size:13px; color:var(--text-main); font-weight:700; margin-top:2px;">
                            PCS: <strong style="font-family:var(--font-mono); color:var(--accent-blue);">${escapeHtml(ev.rawSN || sn)}</strong>
                        </div>
                    </div>
                    ${runId ? `<button class="btn btn-sm btn-outline" onclick="openMatrixDetailModal('${escapeHtml(sn)}', '${escapeHtml(runId)}', false)" style="font-size:11px;">📌 Chỉ xem lượt ${escapeHtml(runInfo ? runInfo.shortLabel : '')}</button>` : ''}
                </div>
            `;
        }
    }

    if (thead) {
        thead.innerHTML = `
            <tr>
                <th style="width:40px; text-align:center;">#</th>
                <th>Model &amp; Trạm Đo</th>
                <th>Thời Gian</th>
                <th style="text-align:center;">Phán Định</th>
                <th>Chi Tiết Lỗi &amp; Thông Số Vật Lý</th>
            </tr>
        `;
    }

    if (tbody) {
        tbody.innerHTML = '';
        if (targetRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Không tìm thấy bản ghi đo nào trong lượt này.</td></tr>`;
        } else {
            targetRecords.forEach((rec, idx) => {
                const tr = document.createElement('tr');
                const pass = isRecordPass(rec);
                const errs = activeErrors(rec.errors);

                let detailsHtml = '';
                if (!pass && errs.length > 0) {
                    detailsHtml = errs.map(e => `<span class="badge-pill badge-fail" style="margin-right:4px; font-size:11px;">❌ ${escapeHtml(getMappedName(e))}</span>`).join('');
                } else if (pass) {
                    detailsHtml = `<span class="badge-pill badge-pass" style="font-size:11px;">✓ Đạt tất cả tiêu chuẩn kiểm tra</span>`;
                }

                // Nếu có thông số đo vật lý
                const metricsList = Object.entries(rec.metrics || {});
                if (metricsList.length > 0) {
                    detailsHtml += `<div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:6px;">`;
                    metricsList.forEach(([mKey, mVal]) => {
                        const valStr = (typeof mVal.value === 'number') ? mVal.value.toFixed(2) : mVal.value;
                        detailsHtml += `<span style="font-size:10px; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; font-family:var(--font-mono);">${escapeHtml(mKey)}: <strong>${valStr} ${escapeHtml(mVal.unit || '')}</strong></span>`;
                    });
                    detailsHtml += `</div>`;
                }

                tr.innerHTML = `
                    <td style="text-align:center; font-weight:700; color:var(--text-muted);">#${idx + 1}</td>
                    <td>
                        <strong style="color:var(--accent-blue);">${escapeHtml(rec.modelName ? ('Model ' + rec.modelName) : rec.fileName)}</strong>
                        <div style="font-size:11px; color:var(--text-muted);">Trạm: ${escapeHtml(rec.stationName)} · Tệp: ${escapeHtml(rec.fileName)}</div>
                    </td>
                    <td style="font-family:var(--font-mono); font-size:12px;">${rec.timestamp ? rec.timestamp.toLocaleString() : '—'}</td>
                    <td style="text-align:center;">${pass ? '<span class="badge-pill badge-pass">PASS</span>' : '<span class="badge-pill badge-fail">FAIL</span>'}</td>
                    <td>${detailsHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    modal.classList.remove('hidden');
}

/* ════════════ DRILLDOWN MODAL & CLIPBOARD TOOLS ════════════ */
function openDrilldownModal(errorName) {
    currentDrilldownError = errorName;
    const modal = document.getElementById('drilldown-modal');
    if (!modal) return;

    const titleEl = document.getElementById('drilldown-modal-title');
    const tbody = document.getElementById('drilldown-modal-tbody');
    const thead = modal.querySelector('.modal-body thead');

    const affected = [];
    analysisData.events.forEach(ev => {
        const lastErrs = activeErrors(ev.lastRun.errors);
        const mapped = lastErrs.map(e => getMappedName(e));

        if (errorName === 'ALL_FAIL') {
            if (!isRecordPass(ev.lastRun) || lastErrs.length > 0) affected.push(ev);
        } else if (lastErrs.includes(errorName) || mapped.includes(errorName) || mapped.join(' + ') === errorName) {
            affected.push(ev);
        }
    });

    currentDrilldownList = affected;

    if (titleEl) {
        const mappedTitle = errorName === 'ALL_FAIL' ? _t('TẤT CẢ SẢN PHẨM LỖI (NG)') : getMappedName(errorName);
        titleEl.innerHTML = `🔍 ${_t('CHI TIẾT PCS BỊ LỖI:')} <strong style="color:#f87171;">${escapeHtml(mappedTitle)}</strong> (${affected.length} ${_t('mẫu')})`;
    }

    if (thead) {
        thead.innerHTML = `
            <tr>
                <th style="width:40px; text-align:center;">#</th>
                <th>Serial Number</th>
                <th>Thời Gian Đo</th>
                <th>Trạm Đo</th>
                <th>Tệp Nguồn / Phán Định</th>
            </tr>
        `;
    }

    if (tbody) {
        tbody.innerHTML = '';
        if (affected.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">${_t('Không tìm thấy PCS nào')}</td></tr>`;
        } else {
            affected.forEach((ev, idx) => {
                const tr = document.createElement('tr');
                const rec = ev.lastRun;
                tr.innerHTML = `
                    <td style="text-align:center; font-weight:700; color:var(--text-muted);">${idx + 1}</td>
                    <td style="font-family:var(--font-mono); font-weight:700; color:var(--text-main);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span>${escapeHtml(ev.rawSN || ev.sn)}</span>
                            <button class="btn btn-sm btn-secondary" onclick="copySingleSN('${escapeHtml(ev.rawSN || ev.sn)}')">📋</button>
                        </div>
                    </td>
                    <td style="font-family:var(--font-mono); font-size:12px;">${rec.timestamp ? rec.timestamp.toLocaleString() : '—'}</td>
                    <td><span style="font-weight:700; color:var(--accent-blue);">${escapeHtml(rec.stationName)}</span></td>
                    <td style="font-size:11px; color:var(--text-muted);">${escapeHtml(rec.fileName)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    modal.classList.remove('hidden');
}

function closeDrilldownModal() {
    const modal = document.getElementById('drilldown-modal');
    if (modal) modal.classList.add('hidden');
}

function copySingleSN(sn) {
    if (!sn) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(sn).then(() => {
            showToast(`✅ ${_t('Đã sao chép:')} ${sn}`, 'success');
        });
    }
}

function copyAllDefectSNs() {
    const failed = [];
    analysisData.events.forEach(ev => {
        if (!isRecordPass(ev.lastRun) || activeErrors(ev.lastRun.errors).length > 0) {
            failed.push(ev.rawSN || ev.sn);
        }
    });

    if (failed.length === 0) {
        showToast('🎉 ' + _t('Không ghi nhận lỗi nào'), 'info');
        return;
    }

    if (navigator.clipboard) {
        navigator.clipboard.writeText(failed.join('\n')).then(() => {
            showToast(`✅ ${_t('Đã sao chép tất cả')} ${failed.length} ${_t('mã lỗi vào Clipboard!')}`, 'success');
        });
    }
}

/* ════════════ CÁC BỘ XUẤT BÁO CÁO ĐỘC LẬP TỪNG PHẦN (SPECIALIZED EXPORTS) ════════════ */

/**
 * Xuất Ma Trận Đa Lượt Đo ra tệp HTML độc lập tương tác cao (Standalone Interactive HTML)
 */
function exportMatrixStandaloneHTML() {
    const { runs, rows } = matrixData;
    if (!rows || rows.length === 0) {
        showToast('⚠️ Không có dữ liệu ma trận để xuất.', 'warning');
        return;
    }

    const totalUnits = rows.length;
    const totalRuns = runs.length;
    const failUnits = rows.filter(r => r.hasFail).length;
    const changedUnits = rows.filter(r => r.hasChanged).length;
    const retestUnits = rows.filter(r => r.totalScans > totalRuns).length;

    let headersHtml = `<th style="width:45px; text-align:center;">STT</th><th style="text-align:left; min-width:180px;">Serial Number / DUT</th>`;
    runs.forEach(r => {
        headersHtml += `<th style="text-align:center; min-width:140px;">${escapeHtml(r.shortLabel || r.stationName)}<br><span style="font-size:10px; font-weight:normal; opacity:0.75;">(${r.recordCount} mẫu)</span></th>`;
    });
    headersHtml += `<th style="width:120px; text-align:center;">Phán Định (${matrixEvalMode === 'FIRST' ? 'Đầu' : 'Cuối'})</th><th style="width:90px; text-align:center;">Tổng Lần Đo</th>`;

    let rowsJson = JSON.stringify(rows.map((row, idx) => {
        const runResults = {};
        runs.forEach(r => {
            const res = row.runResults[r.id];
            runResults[r.id] = res ? { pass: res.pass, count: res.count, errors: res.errors, timestamp: res.timestamp } : null;
        });
        return {
            idx: idx + 1,
            sn: row.sn,
            rawSN: row.rawSN || row.sn,
            hasFail: row.hasFail,
            hasChanged: row.hasChanged,
            isRetest: row.totalScans > totalRuns,
            finalVerdict: row.finalVerdict,
            totalScans: row.totalScans,
            runResults
        };
    }));

    const runsJson = JSON.stringify(runs.map(r => ({ id: r.id, label: r.label, shortLabel: r.shortLabel || r.stationName })));

    const htmlContent = `<!DOCTYPE html>
<html lang="vi" data-theme="dark">
<head>
<meta charset="utf-8">
<title>QIT Scanner v2 - Báo Cáo Ma Trận Đa Lượt Đo</title>
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
    --fail: #ef4444;
    --fail-bg: rgba(239, 68, 68, 0.16);
    --warn: #f59e0b;
    --warn-bg: rgba(245, 158, 11, 0.16);
    --purple: #a855f7;
    --purple-bg: rgba(168, 85, 247, 0.16);
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
    --fail: #dc2626;
    --fail-bg: rgba(220, 38, 38, 0.12);
    --warn: #d97706;
    --warn-bg: rgba(217, 119, 6, 0.12);
    --purple: #9333ea;
    --purple-bg: rgba(147, 51, 234, 0.12);
    --shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.12);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background: var(--bg); color: var(--txt); padding: 24px; min-height: 100vh; transition: background 0.25s ease, color 0.25s ease; }
  .container { max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  
  .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid var(--border); padding-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-text h1 { font-size: 19px; font-weight: 900; letter-spacing: 0.04em; background: linear-gradient(135deg, var(--cyan), var(--blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .brand-text p { font-size: 11px; color: var(--txt-sub); font-family: monospace; letter-spacing: 0.1em; margin-top: 2px; }
  
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .theme-toggle-btn { background: var(--bg-card); border: 1px solid var(--border); color: var(--txt); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: grid; place-items: center; font-size: 16px; transition: all 0.2s ease; box-shadow: var(--shadow); }
  .theme-toggle-btn:hover { border-color: var(--border-hover); transform: scale(1.05); }
  .meta { font-size: 11.5px; color: var(--txt-sub); text-align: right; font-family: monospace; line-height: 1.5; }
  
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .kpi-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; text-align: center; box-shadow: var(--shadow); backdrop-filter: blur(10px); }
  .kpi-label { font-size: 10.5px; font-weight: 800; color: var(--txt-sub); text-transform: uppercase; letter-spacing: 0.05em; }
  .kpi-val { font-size: 21px; font-weight: 900; margin-top: 4px; font-family: monospace; }
  
  .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: var(--bg-card); padding: 12px 18px; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); }
  .search-input, .filter-select { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--txt); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; outline: none; transition: border-color 0.2s; }
  .search-input:focus, .filter-select:focus { border-color: var(--cyan); }
  .search-input { min-width: 260px; font-family: monospace; }
  
  .table-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; overflow: auto; max-height: 70vh; box-shadow: var(--shadow); }
  table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
  th { position: sticky; top: 0; background: var(--bg-elevated); color: var(--txt-sub); font-weight: 800; padding: 10px 14px; border-bottom: 1px solid var(--border); z-index: 10; font-size: 11.5px; }
  td { padding: 9px 14px; border-bottom: 1px solid var(--border); text-align: center; }
  tr:hover td { background: rgba(255, 255, 255, 0.03); }
  
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
  .badge-pass { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass); }
  .badge-fail { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">
      <svg viewBox="50 50 200 200" width="38" height="38">
        <defs>
          <linearGradient id="qGradExp" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f2fe"/><stop offset="100%" stop-color="#4facfe"/></linearGradient>
          <linearGradient id="b1" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0f2b5c"/><stop offset="100%" stop-color="#0ea5e9"/></linearGradient>
          <linearGradient id="b2" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#2d1363"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient>
          <linearGradient id="b3" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#093d5c"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>
          <linearGradient id="b4" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#3b0764"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>
        </defs>
        <line x1="175" y1="175" x2="230" y2="230" stroke="url(#qGradExp)" stroke-width="26" stroke-linecap="round"/>
        <circle cx="140" cy="140" r="65" fill="none" stroke="url(#qGradExp)" stroke-width="18"/>
        <rect x="90" y="145" width="14" height="40" fill="url(#b1)"/>
        <rect x="118" y="160" width="14" height="25" fill="url(#b2)"/>
        <rect x="146" y="125" width="14" height="60" fill="url(#b3)"/>
        <rect x="174" y="135" width="14" height="50" fill="url(#b4)"/>
        <polyline points="97,125 125,140 153,105 181,115" fill="none" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="97" cy="125" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="125" cy="140" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="153" cy="105" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="181" cy="115" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
      </svg>
      <div class="brand-text">
        <h1>🧩 BÁO CÁO MA TRẬN ĐA LƯỢT ĐO & BIẾN ĐỔI CHẤT LƯỢNG</h1>
        <p>QIT SCANNER V2 · KLIPPEL ACOUSTIC MULTI-RUN QUALITY MATRIX</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="theme-toggle-btn" id="theme-btn" onclick="toggleReportTheme()" title="Chuyển đổi giao diện Sáng / Tối">
        <span id="theme-icon">☀️</span>
      </button>
      <div class="meta">
        <div>Thời gian xuất: <strong>${new Date().toLocaleString()}</strong></div>
        <div>Đánh giá: <strong>${matrixEvalMode === 'FIRST' ? 'Lần đầu (FPY)' : 'Lần cuối (Final)'}</strong></div>
      </div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">TỔNG LƯỢT ĐO</div><div class="kpi-val" style="color:var(--cyan);">${totalRuns} Lượt</div></div>
    <div class="kpi-card"><div class="kpi-label">TỔNG SỐ PCS</div><div class="kpi-val" style="color:var(--pass);">${totalUnits} PCS</div></div>
    <div class="kpi-card"><div class="kpi-label">SẢN PHẨM LỖI (FAIL)</div><div class="kpi-val" style="color:var(--fail);">${failUnits} (${totalUnits > 0 ? ((failUnits/totalUnits)*100).toFixed(1) : 0}%)</div></div>
    <div class="kpi-card"><div class="kpi-label">ĐỔI KẾT QUẢ</div><div class="kpi-val" style="color:var(--warn);">${changedUnits} PCS</div></div>
    <div class="kpi-card"><div class="kpi-label">ĐO LẠI (RETEST)</div><div class="kpi-val" style="color:var(--purple);">${retestUnits} PCS</div></div>
  </div>

  <div class="controls">
    <select id="filterSelect" class="filter-select" onchange="applyFilters()">
      <option value="ALL">Tất cả trạng thái (${totalUnits})</option>
      <option value="FAIL">Chỉ PCS dính lỗi (${failUnits})</option>
      <option value="CHANGED">PCS đổi kết quả (${changedUnits})</option>
      <option value="RETEST">PCS đo lại nhiều lần (${retestUnits})</option>
    </select>
    <input type="text" id="searchInput" class="search-input" placeholder="🔍 Tìm kiếm Serial Number..." oninput="applyFilters()">
    <span id="matchCount" style="font-size:12px; color:var(--txt-sub); margin-left:auto; font-weight:700;">Hiển thị: <strong style="color:var(--cyan);">${totalUnits}</strong> PCS</span>
  </div>

  <div class="table-box">
    <table>
      <thead><tr>${headersHtml}</tr></thead>
      <tbody id="matrixTbody"></tbody>
    </table>
  </div>
</div>

<script>
  const rawData = ${rowsJson};
  const runsData = ${runsJson};

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

  function applyFilters() {
    const filter = document.getElementById('filterSelect').value;
    const q = document.getElementById('searchInput').value.trim().toUpperCase();
    const tbody = document.getElementById('matrixTbody');
    
    let matches = 0;
    let html = '';

    rawData.forEach((row, i) => {
      if (filter === 'FAIL' && !row.hasFail) return;
      if (filter === 'CHANGED' && !row.hasChanged) return;
      if (filter === 'RETEST' && !row.isRetest) return;
      if (q && !row.rawSN.toUpperCase().includes(q) && !row.sn.toUpperCase().includes(q)) return;

      matches++;
      const finalBadge = row.finalVerdict ? '<span class=\"badge badge-pass\">PASS</span>' : '<span class=\"badge badge-fail\">FAIL</span>';
      
      html += '<tr>';
      html += '<td style=\"color:var(--txt-sub);\">' + matches + '</td>';
      html += '<td style=\"text-align:left; font-family:monospace; font-weight:700;\">' + row.rawSN + '</td>';
      
      runsData.forEach(r => {
        const res = row.runResults[r.id];
        if (!res) {
          html += '<td style=\"color:var(--txt-sub);\">—</td>';
        } else if (res.pass) {
          const cTag = res.count > 1 ? ' (' + res.count + 'x)' : '';
          html += '<td><span class=\"badge badge-pass\">PASS' + cTag + '</span></td>';
        } else {
          const errs = res.errors.length > 0 ? res.errors.join(', ') : 'FAIL';
          const cTag = res.count > 1 ? ' (' + res.count + 'x)' : '';
          html += '<td><span class=\"badge badge-fail\">' + errs + cTag + '</span></td>';
        }
      });

      html += '<td>' + finalBadge + '</td>';
      html += '<td style=\"font-family:monospace;\">' + row.totalScans + ' lần</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html || '<tr><td colspan=\"' + (runsData.length + 4) + '\" style=\"text-align:center; padding:30px; color:var(--txt-sub);\">Không tìm thấy bản ghi nào phù hợp.</td></tr>';
    document.getElementById('matchCount').innerHTML = 'Hiển thị: <strong style="color:var(--cyan);">' + matches + '</strong> PCS';
  }

  initReportTheme();
  applyFilters();
</script>
</body>
</html>`;

    downloadBlobFile(htmlContent, `QIT_MultiRun_Matrix_Report_${toLocalDateStr(new Date())}.html`, 'text/html;charset=utf-8');
    showToast('✅ Đã xuất Ma Trận HTML độc lập thành công!', 'success');
}

/**
 * Xuất Ma Trận Đa Lượt Đo ra tệp CSV / Excel
 */
function exportMatrixExcel() {
    const { runs, rows } = matrixData;
    if (!rows || rows.length === 0) {
        showToast('⚠️ Không có dữ liệu ma trận để xuất.', 'warning');
        return;
    }

    let csv = '\uFEFFSTT,Serial Number,Mã Thô,';
    runs.forEach(r => {
        csv += `"${r.shortLabel} - Trạm ${r.stationName} (${r.fileName})",`;
    });
    csv += `Phán Định (${matrixEvalMode === 'FIRST' ? 'Đầu' : 'Cuối'}),Tổng Lần Đo,Có Đổi Kết Quả\n`;

    rows.forEach((row, idx) => {
        let line = `${idx + 1},"${row.sn}","${row.rawSN || row.sn}",`;
        runs.forEach(r => {
            const res = row.runResults[r.id];
            if (!res) line += '"—",';
            else if (res.pass) line += `"${res.count > 1 ? 'PASS (' + res.count + 'x)' : 'PASS'}",`;
            else line += `"FAIL: ${res.errors.join('; ')}",`;
        });
        line += `"${row.finalVerdict ? 'PASS' : 'FAIL'}",${row.totalScans},"${row.hasChanged ? 'YES' : 'NO'}"\n`;
        csv += line;
    });

    downloadBlobFile(csv, `QIT_Matrix_Data_${toLocalDateStr(new Date())}.csv`, 'text/csv;charset=utf-8');
    showToast('✅ Đã xuất dữ liệu Ma Trận Excel (CSV) thành công!', 'success');
}

/**
 * Xuất Bảng Pareto 80/20 ra tệp CSV / Excel
 */
function exportParetoExcel() {
    if (!analysisData.errorPareto || analysisData.errorPareto.length === 0) {
        showToast('⚠️ Không có dữ liệu lỗi Pareto để xuất.', 'warning');
        return;
    }

    let csv = '\uFEFFHạng,Mã Lỗi Kỹ Thuật (Raw),Tên Hiển Thị (Alias),Số Lượng Lỗi,% Đóng Góp Lỗi,% SP Bị Ảnh Hưởng,% Tích Lũy Pareto,Phân Loại 80/20\n';
    analysisData.errorPareto.forEach((item, idx) => {
        const isVital = (item.cumPercent || 0) <= 80 || idx === 0;
        csv += `${idx + 1},"${item.rawName}","${getMappedName(item.rawName)}",${item.count},${(item.pctOfDefects || 0).toFixed(2)}%,${(item.pctOfUnits || 0).toFixed(2)}%,${(item.cumPercent || 0).toFixed(2)}%,"${isVital ? 'Top 80% Lỗi Trọng Tâm' : 'Vùng Dài 20%'}"\n`;
    });

    downloadBlobFile(csv, `QIT_Pareto_80_20_${toLocalDateStr(new Date())}.csv`, 'text/csv;charset=utf-8');
    showToast('✅ Đã xuất dữ liệu Pareto Excel (CSV) thành công!', 'success');
}

/**
 * Xuất Báo Cáo Tổng Quan KPI & Pareto ra tệp HTML độc lập
 */
function exportKPIStandaloneHTML() {
    const topDefects = analysisData.errorPareto;
    let paretoRowsHtml = '';
    topDefects.forEach((item, idx) => {
        const isVital = (item.cumPercent || 0) <= 80 || idx === 0;
        paretoRowsHtml += `<tr>
            <td style="color:var(--txt-sub); font-weight:700;">#${idx + 1}</td>
            <td style="font-weight:700; text-align:left;">
                ${escapeHtml(getMappedName(item.rawName))}
                <div style="font-size:10px; color:var(--txt-sub); font-family:monospace;">${escapeHtml(item.rawName)}</div>
            </td>
            <td style="font-family:monospace; font-weight:800; color:#f87171;">${item.count}</td>
            <td style="font-family:monospace;">${item.pctOfDefects.toFixed(2)}%</td>
            <td style="font-family:monospace; font-weight:700; color:${isVital ? '#ef4444' : '#38bdf8'};">${item.cumPercent.toFixed(2)}%</td>
            <td><span class="badge ${isVital ? 'badge-fail' : 'badge-pass'}">${isVital ? 'Top 80% Trọng Tâm' : 'Vùng Dài 20%'}</span></td>
        </tr>`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="vi" data-theme="dark">
<head>
<meta charset="utf-8">
<title>QIT Scanner v2 - Báo Cáo Tổng Quan KPI & Pareto</title>
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
    --fail: #dc2626;
    --fail-bg: rgba(220, 38, 38, 0.12);
    --warn: #d97706;
    --warn-bg: rgba(217, 119, 6, 0.12);
    --shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.12);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background: var(--bg); color: var(--txt); padding: 24px; min-height: 100vh; transition: background 0.25s ease, color 0.25s ease; }
  .container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  
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
  .badge-fail { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">
      <svg viewBox="50 50 200 200" width="38" height="38">
        <defs>
          <linearGradient id="qGradExp2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f2fe"/><stop offset="100%" stop-color="#4facfe"/></linearGradient>
          <linearGradient id="b12" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0f2b5c"/><stop offset="100%" stop-color="#0ea5e9"/></linearGradient>
          <linearGradient id="b22" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#2d1363"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient>
          <linearGradient id="b32" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#093d5c"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>
          <linearGradient id="b42" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#3b0764"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>
        </defs>
        <line x1="175" y1="175" x2="230" y2="230" stroke="url(#qGradExp2)" stroke-width="26" stroke-linecap="round"/>
        <circle cx="140" cy="140" r="65" fill="none" stroke="url(#qGradExp2)" stroke-width="18"/>
        <rect x="90" y="145" width="14" height="40" fill="url(#b12)"/>
        <rect x="118" y="160" width="14" height="25" fill="url(#b22)"/>
        <rect x="146" y="125" width="14" height="60" fill="url(#b32)"/>
        <rect x="174" y="135" width="14" height="50" fill="url(#b42)"/>
        <polyline points="97,125 125,140 153,105 181,115" fill="none" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="97" cy="125" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="125" cy="140" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="153" cy="105" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="181" cy="115" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
      </svg>
      <div class="brand-text">
        <h1>📊 BÁO CÁO TỔNG QUAN CHẤT LƯỢNG & PARETO 80/20</h1>
        <p>QIT SCANNER V2 · KLIPPEL ACOUSTIC QUALITY AUDIT</p>
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
    <div class="kpi-card"><div class="kpi-label">FIRST PASS YIELD</div><div class="kpi-val" style="color:var(--pass);">${(analysisData.fpy || 0).toFixed(1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">FINAL PASS YIELD</div><div class="kpi-val" style="color:var(--blue);">${(analysisData.finalPassRate || 0).toFixed(1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">TỔNG PCS (DUT)</div><div class="kpi-val">${analysisData.uniqueUnitsCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">SẢN PHẨM ĐẠT</div><div class="kpi-val" style="color:var(--pass);">${analysisData.passCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">SẢN PHẨM LỖI</div><div class="kpi-val" style="color:var(--fail);">${analysisData.failCount}</div></div>
    <div class="kpi-card"><div class="kpi-label">ĐO LẠI (RETEST)</div><div class="kpi-val" style="color:var(--warn);">${analysisData.retestCount}</div></div>
  </div>

  <div class="card">
    <h3 style="margin-bottom:14px; font-size:14px; font-weight:800; color:var(--cyan); display:flex; align-items:center; gap:8px;">
      <span>🔥</span> BẢNG PHÂN TÍCH LỖI PARETO 80/20
    </h3>
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th style="width:50px;">Hạng</th>
            <th style="text-align:left;">Thông Số Lỗi</th>
            <th>Số Lượng Lỗi</th>
            <th>Tỷ Lệ %</th>
            <th>% Tích Lũy</th>
            <th>Phân Loại 80/20</th>
          </tr>
        </thead>
        <tbody>${paretoRowsHtml || '<tr><td colspan="6" style="padding:24px; color:var(--txt-sub);">Không ghi nhận lỗi nào.</td></tr>'}</tbody>
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

    downloadBlobFile(htmlContent, `QIT_KPI_Pareto_Report_${toLocalDateStr(new Date())}.html`, 'text/html;charset=utf-8');
    showToast('✅ Đã xuất Báo Cáo KPI HTML độc lập thành công!', 'success');
}
