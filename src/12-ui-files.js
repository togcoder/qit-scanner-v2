/* ════════════ GIAO DIỆN QUẢN LÝ ĐA TỆP & TRẠM ĐO (FILES UI) V2 PRO ════════════ */

function renderFilesManager() {
    const container = document.getElementById('files-manager-container');
    if (!container) return;

    if (loadedFilesMap.size === 0) {
        container.innerHTML = `
            <div class="card" style="padding:48px 24px; text-align:center; max-width:720px; margin:20px auto;">
                <div style="font-size:48px; margin-bottom:14px;">📁</div>
                <h3 style="font-size:17px; font-weight:900; margin:0 0 8px; color:var(--text-main);">CHƯA CÓ TỆP NHẬT KÝ KLIPPEL NÀO ĐƯỢC NẠP</h3>
                <p style="font-size:12.5px; color:var(--text-muted); line-height:1.6; margin:0 auto 24px;">
                    Bạn có thể nạp ngay Bộ dữ liệu mẫu đa trạm của Klippel để trải nghiệm hệ thống, hoặc chọn thư mục / tệp nhật ký (.log, .txt, .csv) từ máy tính.
                </p>
                <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                    <button class="btn btn-primary" onclick="loadBuiltInDemoKlippelLogs()" style="padding:10px 22px; font-weight:800; font-size:13px;">
                        🧪 Nạp Bộ Dữ Liệu Mẫu (3 Trạm · 3 Ca)
                    </button>
                    <button class="btn btn-outline" onclick="startFastDirectoryScan()" style="padding:10px 20px; font-size:13px;">
                        📁 Quét Thư Mục Summary
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('file-input').click()" style="padding:10px 20px; font-size:13px;">
                        📄 Chọn Tệp Riêng Lẻ
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const activeCount = Array.from(loadedFilesMap.values()).filter(f => f.active).length;

    let html = `
        <div class="card" style="padding:16px 20px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                    <h3 style="font-size:16px; font-weight:900; margin:0;">📁 QUẢN LÝ ĐA TỆP LOG &amp; TRẠM ĐO KLIPPEL (${activeCount}/${loadedFilesMap.size} TỆP ĐANG BẬT)</h3>
                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">
                        Tổng số bản ghi đang kích hoạt: <strong style="color:var(--accent-cyan); font-family:var(--font-mono);">${filteredTimelineData.length.toLocaleString()}</strong> mẫu · Bật/tắt checkbox từng trạm để lọc báo cáo toàn cục
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('file-input').click()">+ Nạp Thêm Tệp Log</button>
                    <button class="btn btn-outline btn-sm" onclick="startFastDirectoryScan()">📁 Quét Thư Mục</button>
                    <button class="btn btn-secondary btn-sm" onclick="setAllFilesActive(true)">✓ Bật Tất Cả</button>
                    <button class="btn btn-secondary btn-sm" onclick="setAllFilesActive(false)">✕ Tắt Tất Cả</button>
                </div>
            </div>
        </div>

        <div class="files-grid">
    `;

    loadedFilesMap.forEach(fileInfo => {
        const passCount = fileInfo.records.filter(r => isRecordPass(r)).length;
        const failCount = fileInfo.records.length - passCount;
        const passRate = fileInfo.records.length > 0 ? (passCount / fileInfo.records.length) * 100 : 0;
        const rateColor = passRate >= 92 ? '#10b981' : (passRate >= 85 ? '#f59e0b' : '#ef4444');
        const isSolo = currentActiveFileFilter === fileInfo.fileId;

        html += `
            <div class="file-card ${fileInfo.active ? 'active-file' : 'inactive-file'}">
                <div class="file-card-header">
                    <div style="display:flex; align-items:flex-start; gap:10px; min-width:0; flex:1;">
                        <input type="checkbox" ${fileInfo.active ? 'checked' : ''} onchange="toggleFileActive('${escapeHtml(fileInfo.fileId)}')" style="width:18px; height:18px; margin-top:2px; accent-color:var(--accent-cyan); cursor:pointer;">
                        <div style="min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-size:14px; font-weight:800; color:var(--accent-blue);">${escapeHtml(fileInfo.stationName)}</span>
                                <span class="meta-chip">${escapeHtml(fileInfo.stimulusInfo || 'Standard QC')}</span>
                            </div>
                            <div class="file-card-title" title="${escapeHtml(fileInfo.fileName)}" style="margin-top:3px; color:var(--text-muted); font-family:var(--font-mono); font-size:11px;">
                                ${escapeHtml(fileInfo.fileName)}
                            </div>
                        </div>
                    </div>
                    <div class="file-card-yield" style="color:${rateColor}; font-weight:900; font-size:18px; font-family:var(--font-mono);">
                        ${passRate.toFixed(1)}%
                    </div>
                </div>

                <!-- Thanh tiến độ Yield trực quan -->
                <div style="height:6px; border-radius:6px; background:rgba(255,255,255,0.06); overflow:hidden;">
                    <div style="height:100%; width:${passRate.toFixed(1)}%; background:${rateColor}; border-radius:6px;"></div>
                </div>

                <div class="file-card-body">
                    <div class="file-stat-row">
                        <span>Mã Model / Lô hàng:</span>
                        <strong style="color:var(--accent-cyan);">${escapeHtml(fileInfo.modelName || '—')}</strong>
                    </div>
                    <div class="file-stat-row">
                        <span>Số bản ghi đo:</span>
                        <strong>${fileInfo.recordCount.toLocaleString()} mẫu</strong>
                    </div>
                    <div class="file-stat-row">
                        <span>Đạt (PASS) / Lỗi (FAIL):</span>
                        <span><strong style="color:#10b981;">${passCount}</strong> / <strong style="color:#ef4444;">${failCount}</strong></span>
                    </div>
                    <div class="file-stat-row">
                        <span>Cấu trúc Schema:</span>
                        <strong>${fileInfo.schema.verdictCols.length} Tasks · ${fileInfo.schema.metricCols.length} Thông số</strong>
                    </div>
                </div>

                <div class="file-card-footer">
                    <button class="btn btn-sm ${isSolo ? 'btn-primary' : 'btn-outline'}" style="flex:1;" onclick="filterSoloFile('${escapeHtml(fileInfo.fileId)}')">
                        ${isSolo ? '🔍 Đang Lọc Riêng Trạm Này' : '🔍 Chỉ Xem Trạm Này'}
                    </button>
                    ${isSolo ? `<button class="btn btn-sm btn-secondary" onclick="filterSoloFile('ALL')">Bỏ Lọc</button>` : ''}
                    <button class="btn btn-sm btn-outline-danger" onclick="removeLoadedFile('${escapeHtml(fileInfo.fileId)}')" title="Gỡ tệp này khỏi phiên làm việc">🗑️ Gỡ</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function toggleFileActive(fileId) {
    const f = loadedFilesMap.get(fileId);
    if (f) {
        f.active = !f.active;
        applyFileFiltersAndRecalculate();
    }
}

function setAllFilesActive(isActive) {
    loadedFilesMap.forEach(f => f.active = isActive);
    currentActiveFileFilter = 'ALL';
    applyFileFiltersAndRecalculate();
}

function filterSoloFile(fileId) {
    currentActiveFileFilter = (currentActiveFileFilter === fileId) ? 'ALL' : fileId;
    applyFileFiltersAndRecalculate();
}

function removeLoadedFile(fileId) {
    const f = loadedFilesMap.get(fileId);
    if (!f) return;
    loadedFilesMap.delete(fileId);
    timelineData = timelineData.filter(r => r.fileId !== fileId);
    if (currentActiveFileFilter === fileId) currentActiveFileFilter = 'ALL';

    // Rebuild lookup maps
    dictLookupClean.clear();
    dictLookupSeri.clear();
    dictLookupModel.clear();
    timelineData.forEach(r => {
        if (r.cleanSN) dictLookupClean.set(r.cleanSN, r);
        if (r.cleanSeri && r.cleanSeri !== r.cleanSN) dictLookupSeri.set(r.cleanSeri, r);
        if (r.modelName) {
            if (!dictLookupModel.has(r.modelName)) dictLookupModel.set(r.modelName, []);
            dictLookupModel.get(r.modelName).push(r);
        }
    });

    applyFileFiltersAndRecalculate();
    showToast(`🗑️ Đã gỡ tệp [${f.fileName}]`, 'info');
}
