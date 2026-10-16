/* ════════════ GIAO DIỆN QUẢN LÝ ĐA TỆP & TRẠM ĐO (FILES UI) V2 ════════════ */

function renderFilesManager() {
    const container = document.getElementById('files-manager-container');
    if (!container) return;

    if (loadedFilesMap.size === 0) {
        container.innerHTML = `
            <div class="card" style="padding:48px 24px; text-align:center; max-width:680px; margin:20px auto;">
                <div style="font-size:48px; margin-bottom:14px;">📁</div>
                <h3 style="font-size:17px; font-weight:900; margin:0 0 8px; color:var(--text-main);">CHƯA CÓ TỆP NHẬT KÝ KLIPPEL NÀO ĐƯỢC NẠP</h3>
                <p style="font-size:12.5px; color:var(--text-muted); line-height:1.6; margin:0 auto 24px;">
                    Bạn có thể quét siêu tốc toàn bộ thư mục lớn chứa các file Summary hoặc chọn các file log riêng lẻ để kích hoạt tính năng Quét Sản Xuất, Phân Tích Chất Lượng và Năng Lực Cpk.
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

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div>
                <h3 style="font-size:18px; font-weight:800; margin:0;">📁 DANH SÁCH TỆP NHẬT KÝ & TRẠM ĐO (${loadedFilesMap.size} TỆP)</h3>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                    Bật/tắt tệp để lọc dữ liệu phân tích cho từng trạm đo hoặc toàn bộ nhà máy
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="startFastDirectoryScan()">📁 Nạp Thêm Thư Mục</button>
                <button class="btn btn-secondary btn-sm" onclick="setAllFilesActive(true)">✓ Bật Tất Cả</button>
                <button class="btn btn-secondary btn-sm" onclick="setAllFilesActive(false)">✕ Tắt Tất Cả</button>
            </div>
        </div>

        <div class="files-grid">
    `;

    loadedFilesMap.forEach(fileInfo => {
        const passCount = fileInfo.records.filter(r => isRecordPass(r)).length;
        const failCount = fileInfo.records.length - passCount;
        const passRate = fileInfo.records.length > 0 ? (passCount / fileInfo.records.length) * 100 : 0;
        const rateColor = passRate >= 95 ? '#10b981' : (passRate >= 85 ? '#f59e0b' : '#ef4444');

        html += `
            <div class="file-card ${fileInfo.active ? 'active-file' : 'inactive-file'}">
                <div class="file-card-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" ${fileInfo.active ? 'checked' : ''} onchange="toggleFileActive('${fileInfo.fileId}')" style="width:18px; height:18px; cursor:pointer;">
                        <div>
                            <div class="file-card-title">${escapeHtml(fileInfo.fileName)}</div>
                            <div class="file-card-station">Trạm: <strong>${escapeHtml(fileInfo.stationName)}</strong></div>
                        </div>
                    </div>
                    <div class="file-card-yield" style="color:${rateColor}; font-weight:800; font-size:16px;">
                        ${passRate.toFixed(1)}%
                    </div>
                </div>

                <div class="file-card-body">
                    <div class="file-stat-row">
                        <span>Số bản ghi đo:</span>
                        <strong>${fileInfo.recordCount}</strong>
                    </div>
                    <div class="file-stat-row">
                        <span>Đạt (PASS) / Lỗi (FAIL):</span>
                        <span><strong style="color:#10b981;">${passCount}</strong> / <strong style="color:#ef4444;">${failCount}</strong></span>
                    </div>
                    <div class="file-stat-row">
                        <span>Số lượng Task phán định:</span>
                        <strong>${fileInfo.schema.verdictCols.length}</strong>
                    </div>
                    <div class="file-stat-row">
                        <span>Số lượng Thông số đo liên tục:</span>
                        <strong>${fileInfo.schema.metricCols.length}</strong>
                    </div>
                </div>

                <div class="file-card-footer">
                    <button class="btn btn-sm ${currentActiveFileFilter === fileInfo.fileId ? 'btn-primary' : 'btn-outline'}" onclick="filterSoloFile('${fileInfo.fileId}')">
                        ${currentActiveFileFilter === fileInfo.fileId ? '🔍 Đang Lọc File Này' : '🔍 Chỉ Xem File Này'}
                    </button>
                    ${currentActiveFileFilter === fileInfo.fileId ? `<button class="btn btn-sm btn-secondary" onclick="filterSoloFile('ALL')">Hủy Lọc</button>` : ''}
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
    applyFileFiltersAndRecalculate();
}

function filterSoloFile(fileId) {
    currentActiveFileFilter = fileId;
    applyFileFiltersAndRecalculate();
}
