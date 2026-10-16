/* ════════════ MODAL CÀI ĐẶT HỆ THỐNG TOÀN DIỆN (SETTINGS MODAL V2 PRO) ════════════ */

let currentSettingsSubTab = 'display'; // 'display' | 'shifts' | 'matcher' | 'audio' | 'cpk' | 'aliases' | 'backup'
let aliasFilterKeyword = '';

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderSettingsModalContent();
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
    if (currentTab === 'scan' || currentTab === 'audit') {
        focusActiveScanInput();
    }
}

function switchSettingsSubTab(subTabId) {
    currentSettingsSubTab = subTabId;
    renderSettingsModalContent();
}

function renderSettingsModalContent() {
    const bodyContainer = document.getElementById('settings-modal-body');
    if (!bodyContainer) return;

    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-subtab') === currentSettingsSubTab);
    });

    let html = '';

    if (currentSettingsSubTab === 'display') {
        html = `
            <div class="settings-pane-content">
                <h4 class="settings-sec-title">${_t('🎨 TÙY CHỈNH GIAO DIỆN & THU PHÓNG (ZOOM)')}</h4>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Chủ Đề Giao Diện (Theme)')}</div>
                        <div class="setting-desc">${_t('Chuyển đổi giữa chế độ Tối (Dark Lab) và chế độ Sáng (Light Office).')}</div>
                    </div>
                    <div class="setting-ctrl" style="display:flex; gap:8px;">
                        <button class="btn btn-sm ${!document.body.classList.contains('light-theme') ? 'btn-primary' : 'btn-secondary'}" onclick="setTheme('dark'); renderSettingsModalContent();">
                            🌙 Dark Lab
                        </button>
                        <button class="btn btn-sm ${document.body.classList.contains('light-theme') ? 'btn-primary' : 'btn-secondary'}" onclick="setTheme('light'); renderSettingsModalContent();">
                            ☀️ Light Office
                        </button>
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Tỷ Lệ Thu Phóng Giao Diện (UI Zoom Scale)')}</div>
                        <div class="setting-desc">${_t('Điều chỉnh kích thước phông chữ và toàn bộ khung giao diện (80% – 150%).')}</div>
                    </div>
                    <div class="setting-ctrl" style="min-width:220px;">
                        <div style="display:flex; justify-content:space-between; font-weight:700; font-size:12px; margin-bottom:4px;">
                            <span>${_t('Thu Phóng:')}</span>
                            <span id="zoom-val-label" style="color:var(--accent-blue);">${CFG.UI_ZOOM || 100}%</span>
                        </div>
                        <input type="range" min="80" max="150" step="5" value="${CFG.UI_ZOOM || 100}" style="width:100%; cursor:pointer;" oninput="onZoomSliderChange(this.value)">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Mật Độ Bảng Dữ Liệu (Table Density)')}</div>
                        <div class="setting-desc">${_t('Khoảng cách giữa các dòng trong bảng số liệu đo, Đối soát và Pareto.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <select class="settings-select" onchange="applyTableDensity(this.value)">
                            <option value="compact" ${CFG.TABLE_DENSITY === 'compact' ? 'selected' : ''}>${_t('Thu gọn (Compact)')}</option>
                            <option value="comfortable" ${CFG.TABLE_DENSITY === 'comfortable' ? 'selected' : ''}>${_t('Vừa phải (Comfortable)')}</option>
                            <option value="spacious" ${CFG.TABLE_DENSITY === 'spacious' ? 'selected' : ''}>${_t('Rộng rãi (Spacious)')}</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    } else if (currentSettingsSubTab === 'shifts') {
        html = `
            <div class="settings-pane-content">
                <h4 class="settings-sec-title">${_t('⏱️ CẤU HÌNH CA SẢN XUẤT (PRODUCTION SHIFTS)')}</h4>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Chế Độ Phân Chia Ca')}</div>
                        <div class="setting-desc">${_t('Chọn chế độ 3 ca (8 tiếng/ca), 2 ca (12 tiếng/ca) hoặc tùy chỉnh khung giờ.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <select class="settings-select" onchange="onShiftModeChange(this.value)">
                            <option value="3_SHIFTS" ${CFG.SHIFT_MODE === '3_SHIFTS' ? 'selected' : ''}>${_t('3 Ca Sản Xuất (8h/ca)')}</option>
                            <option value="2_SHIFTS" ${CFG.SHIFT_MODE === '2_SHIFTS' ? 'selected' : ''}>${_t('2 Ca Ngày / Đêm (12h/ca)')}</option>
                            <option value="CUSTOM" ${CFG.SHIFT_MODE === 'CUSTOM' ? 'selected' : ''}>${_t('Tùy Chỉnh Giờ Từng Ca')}</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Ca 1 / Ca Ngày: Tên & Khung Giờ')}</div>
                        <div class="setting-desc">${_t('Giờ bắt đầu và kết thúc của ca 1.')}</div>
                    </div>
                    <div class="setting-ctrl" style="display:flex; gap:8px; align-items:center;">
                        <input type="text" class="settings-input" style="width:140px;" value="${escapeHtml(CFG.SHIFT_1_NAME || 'Ca 1 (06:00 - 14:00)')}" onchange="updateCfgStr('SHIFT_1_NAME', this.value)">
                        <input type="number" min="0" max="23" class="settings-input" style="width:55px;" value="${CFG.SHIFT_1_START ?? 6}" onchange="updateShiftHours('SHIFT_1_START', this.value)">h
                        <span>-</span>
                        <input type="number" min="0" max="23" class="settings-input" style="width:55px;" value="${CFG.SHIFT_1_END ?? 14}" onchange="updateShiftHours('SHIFT_1_END', this.value)">h
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Ca 2 / Ca Chiều / Ca Đêm: Tên & Khung Giờ')}</div>
                        <div class="setting-desc">${_t('Giờ bắt đầu và kết thúc của ca 2.')}</div>
                    </div>
                    <div class="setting-ctrl" style="display:flex; gap:8px; align-items:center;">
                        <input type="text" class="settings-input" style="width:140px;" value="${escapeHtml(CFG.SHIFT_2_NAME || 'Ca 2 (14:00 - 22:00)')}" onchange="updateCfgStr('SHIFT_2_NAME', this.value)">
                        <input type="number" min="0" max="23" class="settings-input" style="width:55px;" value="${CFG.SHIFT_2_START ?? 14}" onchange="updateShiftHours('SHIFT_2_START', this.value)">h
                        <span>-</span>
                        <input type="number" min="0" max="23" class="settings-input" style="width:55px;" value="${CFG.SHIFT_2_END ?? 22}" onchange="updateShiftHours('SHIFT_2_END', this.value)">h
                    </div>
                </div>

                ${CFG.SHIFT_MODE !== '2_SHIFTS' ? `
                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Ca 3 / Ca Đêm: Tên & Khung Giờ')}</div>
                        <div class="setting-desc">${_t('Giờ bắt đầu và kết thúc của ca 3 (vắt qua nửa đêm).')}</div>
                    </div>
                    <div class="setting-ctrl" style="display:flex; gap:8px; align-items:center;">
                        <input type="text" class="settings-input" style="width:140px;" value="${escapeHtml(CFG.SHIFT_3_NAME || 'Ca 3 (22:00 - 06:00)')}" onchange="updateCfgStr('SHIFT_3_NAME', this.value)">
                        <input type="number" min="0" max="23" class="settings-input" style="width:55px;" value="${CFG.SHIFT_3_START ?? 22}" onchange="updateShiftHours('SHIFT_3_START', this.value)">h
                        <span>-</span>
                        <input type="number" min="0" max="23" class="settings-input" style="width:55px;" value="${CFG.SHIFT_3_END ?? 6}" onchange="updateShiftHours('SHIFT_3_END', this.value)">h
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    } else if (currentSettingsSubTab === 'matcher') {
        html = `
            <div class="settings-pane-content">
                <h4 class="settings-sec-title">${_t('🔍 CẤU HÌNH QUÉT MÃ VẠCH & KIỂM SOÁT GROUP (MATCHER & AUDIT)')}</h4>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Độ Dài Mã Quét Tối Thiểu (Min Scan Length)')}</div>
                        <div class="setting-desc">${_t('Từ chối các chuỗi quét ngẫu nhiên ngắn hơn ngưỡng này để tránh lỗi quét nhầm.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="number" min="1" max="20" value="${CFG.MIN_SCAN_LEN}" class="settings-input" style="width:80px;" onchange="updateCfgNum('MIN_SCAN_LEN', this.value)">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Phạm Vi Quét Đối Soát Danh Sách (Audit Scan Scope)')}</div>
                        <div class="setting-desc">${_t('Chọn Khóa Theo Group khi đóng từng kiện để hệ thống cảnh báo nếu công nhân quét nhầm hàng của kiện khác.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <select class="settings-select" onchange="setAuditScanScope(this.value)">
                            <option value="GLOBAL" ${auditState.scanScope === 'GLOBAL' ? 'selected' : ''}>${_t('🌐 Tự động định tuyến mọi Group')}</option>
                            <option value="ACTIVE" ${auditState.scanScope === 'ACTIVE' ? 'selected' : ''}>${_t('🎯 Khóa riêng trong Group đang chọn')}</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Chốt Chặn Chất Lượng Xuất Kho (Outgoing Quality Gate)')}</div>
                        <div class="setting-desc">${_t('Cảnh báo còi đỏ nếu mã quét có trong danh sách xuất kho nhưng bị FAIL trong tệp Klippel QC Log.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="checkbox" ${auditState.warnOnKlippelFail ? 'checked' : ''} onchange="auditState.warnOnKlippelFail = this.checked; updateCfgBool('AUDIT_WARN_KLIPPEL_FAIL', this.checked)" class="settings-checkbox">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Tự Động Cắt Khoảng Trắng (Auto Trim)')}</div>
                        <div class="setting-desc">${_t('Loại bỏ khoảng trắng thừa đầu/cuối chuỗi do máy quét mã vạch gửi kèm.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="checkbox" ${CFG.TRIM_SCAN_WHITESPACE ? 'checked' : ''} onchange="updateCfgBool('TRIM_SCAN_WHITESPACE', this.checked)" class="settings-checkbox">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Cho Phép Khớp Ngược (Reverse Match)')}</div>
                        <div class="setting-desc">${_t('Cho phép mã quét ngắn hơn ID trong danh sách đối soát (chỉ dùng khi mã quét là tiền tố rút gọn).')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="checkbox" ${CFG.ALLOW_REVERSE_MATCH ? 'checked' : ''} onchange="updateCfgBool('ALLOW_REVERSE_MATCH', this.checked)" class="settings-checkbox">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Tự Động Lọc Tiền Tố / Hậu Tố Cố Định')}</div>
                        <div class="setting-desc">${_t("Ví dụ bỏ tiền tố 'DUT_' hoặc hậu tố '.kdbx' nếu mã quét có kèm ký tự thừa.")}</div>
                    </div>
                    <div class="setting-ctrl" style="display:flex; gap:8px;">
                        <input type="text" placeholder="${_t('Tiền tố...')}" value="${escapeHtml(CFG.AUTO_TRIM_PREFIX || '')}" class="settings-input" style="width:90px;" onchange="updateCfgStr('AUTO_TRIM_PREFIX', this.value)">
                        <input type="text" placeholder="${_t('Hậu tố...')}" value="${escapeHtml(CFG.AUTO_TRIM_SUFFIX || '')}" class="settings-input" style="width:90px;" onchange="updateCfgStr('AUTO_TRIM_SUFFIX', this.value)">
                    </div>
                </div>
            </div>
        `;
    } else if (currentSettingsSubTab === 'audio') {
        html = `
            <div class="settings-pane-content">
                <h4 class="settings-sec-title">${_t('🔊 ÂM THANH CẢNH BÁO & GIỌNG NÓI (AUDIO & SPEECH TTS)')}</h4>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Âm Lượng Thông Báo:')} <span id="modal-volume-val" style="color:var(--accent-blue);">${Math.round(audioVolume * 100)}%</span></div>
                        <div class="setting-desc">${_t('Điều chỉnh âm lượng còi báo hiệu khi quét mã trong xưởng ồn.')}</div>
                    </div>
                    <div class="setting-ctrl" style="min-width:200px;">
                        <input type="range" min="0" max="200" value="${Math.round(audioVolume * 100)}" style="width:100%; cursor:pointer;" oninput="onVolumeSliderInput(this.value)">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Đọc Giọng Nói Tiếng Việt (Voice TTS Alerts)')}</div>
                        <div class="setting-desc">${_t('Tự động phát âm thanh giọng nói: Đạt, Lỗi, Không tìm thấy khi quét xong.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="checkbox" ${CFG.VOICE_ALERTS_ENABLED ? 'checked' : ''} onchange="updateCfgBool('VOICE_ALERTS_ENABLED', this.checked)" class="settings-checkbox">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Nghe Thử Các Âm Thanh Hệ Thống')}</div>
                        <div class="setting-desc">${_t('Kiểm tra bộ tổng hợp âm thanh Web Audio API.')}</div>
                    </div>
                    <div class="setting-ctrl" style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-success" onclick="playScanSound('PASS')">✓ PASS</button>
                        <button class="btn btn-sm btn-danger" onclick="playScanSound('FAIL')">✕ FAIL</button>
                        <button class="btn btn-sm btn-secondary" onclick="playScanSound('NOT_FOUND')">? NOT FOUND</button>
                        <button class="btn btn-sm btn-secondary" onclick="playScanSound('DUPLICATE')">ℹ️ DUPLICATE</button>
                    </div>
                </div>
            </div>
        `;
    } else if (currentSettingsSubTab === 'cpk') {
        html = `
            <div class="settings-pane-content">
                <h4 class="settings-sec-title">${_t('📈 NĂNG LỰC QUY TRÌNH (CPK) & CHUẨN SPC')}</h4>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Nguồn Dữ Liệu Tính Cpk (SPC Standard Data Filter)')}</div>
                        <div class="setting-desc">${_t('Khuyến nghị chọn Chỉ SP Đạt để loại bỏ các lỗi ngoại lai (hở mạch, rời loa) làm sai lệch độ biến thiên chuẩn tự nhiên của quy trình.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <select class="settings-select" onchange="setParametricFilterMode(this.value)">
                            <option value="PASS_ONLY" ${CFG.CPK_DATA_FILTER === 'PASS_ONLY' ? 'selected' : ''}>${_t('Chỉ SP ĐẠT (Chuẩn SPC Klippel)')}</option>
                            <option value="ALL" ${CFG.CPK_DATA_FILTER === 'ALL' ? 'selected' : ''}>${_t('Toàn Bộ Sản Phẩm (Tất cả)')}</option>
                            <option value="TRIMMED_3SIGMA" ${CFG.CPK_DATA_FILTER === 'TRIMMED_3SIGMA' ? 'selected' : ''}>${_t('Lọc Dị Biệt 3-Sigma Trimming')}</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Ngưỡng Tách Chu Kỳ Sản Xuất (Time Gap Threshold)')}</div>
                        <div class="setting-desc">${_t('Khoảng cách thời gian giữa 2 lần đo của cùng 1 serial để phân tách thành sự kiện mới (phút).')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="number" min="0" value="${currentGapThreshold}" class="settings-input" style="width:110px;" onchange="updateGapThreshold(this.value)">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Tiêu Chuẩn Đánh Giá Cpk (Cpk Benchmarks)')}</div>
                        <div class="setting-desc">${_t('Ngưỡng quy chuẩn Cpk Đạt năng lực và Cpk Xuất sắc (6-Sigma).')}</div>
                    </div>
                    <div class="setting-ctrl" style="display:flex; gap:8px; align-items:center;">
                        <span style="font-size:11px; color:var(--text-muted);">${_t('Đạt:')}</span>
                        <input type="number" step="0.01" value="${CFG.CPK_CAPABLE}" class="settings-input" style="width:70px;" onchange="updateCfgNum('CPK_CAPABLE', this.value)">
                        <span style="font-size:11px; color:var(--text-muted);">${_t('Xuất sắc:')}</span>
                        <input type="number" step="0.01" value="${CFG.CPK_EXCELLENT}" class="settings-input" style="width:70px;" onchange="updateCfgNum('CPK_EXCELLENT', this.value)">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Biên Độ Cảnh Báo Cận Biên (Near-Fail Margin %)')}</div>
                        <div class="setting-desc">${_t('% khoảng dung sai tính từ mép LSL/USL để đưa ra cảnh báo sớm cho kỹ sư.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="number" min="1" max="30" value="${CFG.NEAR_FAIL_MARGIN_PCT}" class="settings-input" style="width:80px;" onchange="updateCfgNum('NEAR_FAIL_MARGIN_PCT', this.value)">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Chế Độ Gộp Combo Lỗi Pareto (A + B)')}</div>
                        <div class="setting-desc">${_t('Gộp các sản phẩm dính đồng thời nhiều lỗi thành một danh mục lỗi tổng hợp riêng biệt.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="checkbox" ${comboErrorMode ? 'checked' : ''} onchange="toggleComboMode(this.checked)" class="settings-checkbox">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Tự Động Tìm File Summary Khi Nạp Thư Mục')}</div>
                        <div class="setting-desc">${_t('Tự động quét các thư mục con và chỉ nạp các file nhật ký chứa chữ Summary.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <input type="checkbox" ${CFG.AUTO_FILTER_SUMMARY_ONLY !== false ? 'checked' : ''} onchange="updateCfgBool('AUTO_FILTER_SUMMARY_ONLY', this.checked)" class="settings-checkbox">
                    </div>
                </div>
            </div>
        `;
    } else if (currentSettingsSubTab === 'aliases') {
        html = `
            <div class="settings-pane-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h4 class="settings-sec-title" style="margin:0;">${_t('🏷️ QUẢN LÝ TÊN GỌI LỖI (ERROR ALIASES & HIDING)')}</h4>
                        <div style="font-size:11px; color:var(--text-muted);">${_t('Đổi mã kỹ thuật của máy thành tên tiếng Việt dễ hiểu. Hỗ trợ ký tự đặc biệt (/ & () Ω °C).')}</div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-outline" onclick="exportAliasesJSON()">${_t('📥 Xuất Alias JSON')}</button>
                        <button class="btn btn-sm btn-secondary" onclick="document.getElementById('import-alias-file').click()">${_t('📤 Nạp Alias JSON')}</button>
                        <input type="file" id="import-alias-file" accept=".json" style="display:none;" onchange="importAliasesJSON(event)">
                        <button class="btn btn-sm btn-outline-danger" onclick="resetAllAliases()">${_t('🔄 Mặc Định')}</button>
                    </div>
                </div>

                <div style="margin-bottom:10px;">
                    <input type="text" placeholder="${_t('🔍 Tìm kiếm thông số lỗi...')}" value="${escapeHtml(aliasFilterKeyword)}" class="settings-input" style="width:100%;" oninput="onAliasSearchInput(this.value)">
                </div>

                <div class="table-wrapper" style="max-height:300px; overflow-y:auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>${_t('Mã Lỗi Kỹ Thuật (Log Header)')}</th>
                                <th>${_t('Tên Hiển Thị Tùy Chỉnh (Alias)')}</th>
                                <th style="width:80px; text-align:center;">${_t('Ẩn Lỗi')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderFilteredAliasRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (currentSettingsSubTab === 'backup') {
        html = `
            <div class="settings-pane-content">
                <h4 class="settings-sec-title">${_t('💾 SAO LƯU, KHÔI PHỤC & QUẢN TRỊ DỮ LIỆU')}</h4>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Xuất Cấu Hình Toàn Bộ (Backup Configuration)')}</div>
                        <div class="setting-desc">${_t('Lưu toàn bộ tên Alias lỗi, ngưỡng Cpk, âm thanh và cài đặt ra tệp .json để mang sang máy tính khác.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <button class="btn btn-sm btn-primary" onclick="exportFullConfigJSON()">${_t('📥 Tải Tệp Cấu Hình .JSON')}</button>
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Khôi Phục Cấu Hình (Restore Configuration)')}</div>
                        <div class="setting-desc">${_t('Nạp lại tệp cấu hình .json đã sao lưu trước đó.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <button class="btn btn-sm btn-secondary" onclick="document.getElementById('import-config-file').click()">${_t('📤 Chọn Tệp .JSON')}</button>
                        <input type="file" id="import-config-file" accept=".json" style="display:none;" onchange="importFullConfigJSON(event)">
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Xóa Lịch Sử Quét Phiên (Clear Scan History)')}</div>
                        <div class="setting-desc">${_t('Làm trống danh sách các lần quét gần nhất ở màn hình chính.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <button class="btn btn-sm btn-outline-danger" onclick="clearScanHistoryData()">${_t('🗑️ Xóa Lịch Sử Quét')}</button>
                    </div>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">${_t('Khôi Phục Cài Đặt Gốc (Factory Reset)')}</div>
                        <div class="setting-desc">${_t('Xóa toàn bộ cấu hình đã tùy chỉnh và đưa hệ thống về trạng thái ban đầu của nhà sản xuất.')}</div>
                    </div>
                    <div class="setting-ctrl">
                        <button class="btn btn-sm btn-danger" onclick="factoryResetApp()">${_t('⚠️ Khôi Phục Gốc')}</button>
                    </div>
                </div>
            </div>
        `;
    }

    bodyContainer.innerHTML = html;
}

function onZoomSliderChange(val) {
    const num = parseInt(val, 10);
    const label = document.getElementById('zoom-val-label');
    if (label) label.textContent = num + '%';
    applyUiZoom(num);
}

function updateCfgNum(key, val) {
    const n = parseFloat(val);
    if (!isNaN(n)) {
        CFG[key] = n;
        saveCustomConfig();
        applyFileFiltersAndRecalculate();
        showToast(_t('✓ Đã cập nhật {0}: {1}', key, n), 'success');
    }
}

function updateCfgBool(key, val) {
    CFG[key] = !!val;
    saveCustomConfig();
    applyFileFiltersAndRecalculate();
    showToast(_t('✓ Đã {0} {1}', val ? _t('bật') : _t('tắt'), key), 'info');
}

function updateCfgStr(key, val) {
    CFG[key] = String(val || '').trim();
    saveCustomConfig();
    showToast(_t('✓ Đã lưu {0}', key), 'info');
}

function onAliasSearchInput(val) {
    aliasFilterKeyword = String(val || '').toLowerCase().trim();
    const tbody = document.querySelector('.settings-pane-content table tbody');
    if (tbody) tbody.innerHTML = renderFilteredAliasRows();
}

function renderFilteredAliasRows() {
    if (allKnownErrors.size === 0) {
        return `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:16px;">${_t('Chưa phát hiện danh mục lỗi nào trong các tệp đã nạp')}</td></tr>`;
    }

    let html = '';
    allKnownErrors.forEach(errName => {
        if (aliasFilterKeyword && !errName.toLowerCase().includes(aliasFilterKeyword) && !(errorAliases[errName] || '').toLowerCase().includes(aliasFilterKeyword)) {
            return;
        }

        const alias = errorAliases[errName] || '';
        const isHidden = !!hiddenErrors[errName];

        html += `
            <tr>
                <td style="font-weight:700; font-family:var(--font-mono); font-size:12px;">${escapeHtml(errName)}</td>
                <td>
                    <input type="text" value="${escapeHtml(alias)}" placeholder="${escapeHtml(errName)}" onchange="saveErrorAlias('${escapeHtml(errName)}', this.value)" class="settings-input" style="width:100%;">
                </td>
                <td style="text-align:center;">
                    <input type="checkbox" ${isHidden ? 'checked' : ''} onchange="toggleHideError('${escapeHtml(errName)}', this.checked)" class="settings-checkbox" title="${_t('Ẩn lỗi này khỏi đánh giá FPY')}">
                </td>
            </tr>
        `;
    });

    return html || `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:16px;">${_t('Không tìm thấy lỗi khớp với từ khóa tìm kiếm')}</td></tr>`;
}

function saveErrorAlias(rawErr, aliasVal) {
    if (!rawErr) return;
    const cleanAlias = String(aliasVal || '').trim();
    if (cleanAlias) {
        errorAliases[rawErr] = cleanAlias;
    } else {
        delete errorAliases[rawErr];
    }
    try {
        localStorage.setItem(LS.ALIASES, JSON.stringify(errorAliases));
    } catch(e) {}
    applyFileFiltersAndRecalculate();
    showToast(_t('✓ Đã lưu tên gọi: {0}', getMappedName(rawErr)), 'success');
}

function toggleHideError(rawErr, isHidden) {
    if (!rawErr) return;
    if (isHidden) {
        hiddenErrors[rawErr] = true;
    } else {
        delete hiddenErrors[rawErr];
    }
    try {
        localStorage.setItem(LS.HIDDEN, JSON.stringify(hiddenErrors));
    } catch(e) {}
    applyFileFiltersAndRecalculate();
    showToast(_t('✓ Đã {0} lỗi: {1}', isHidden ? _t('ẩn') : _t('hiện'), rawErr), 'info');
}

function resetAllAliases() {
    openAppDialog({
        title: _t('🔄 Khôi Phục Alias Mặc Định'),
        message: _t('Bạn có chắc muốn xóa toàn bộ tên gọi tùy chỉnh (Aliases) và danh sách ẩn lỗi về mặc định?'),
        confirmText: _t('Khôi Phục Mặc Định'),
        danger: true,
        onConfirm: () => {
            errorAliases = {};
            hiddenErrors = {};
            try {
                localStorage.removeItem(LS.ALIASES);
                localStorage.removeItem(LS.HIDDEN);
            } catch(e) {}
            applyFileFiltersAndRecalculate();
            renderSettingsModalContent();
            showToast(_t('✓ Đã khôi phục Alias mặc định'), 'info');
        }
    });
}

function updateGapThreshold(val) {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
        currentGapThreshold = num;
        CFG.GAP_THRESHOLD_MIN = num;
        saveCustomConfig();
        applyFileFiltersAndRecalculate();
        showToast(_t('✓ Đã cập nhật chu kỳ: {0} phút', num), 'success');
    }
}

function toggleComboMode(enabled) {
    comboErrorMode = !!enabled;
    try {
        localStorage.setItem(LS.COMBO, JSON.stringify(comboErrorMode));
    } catch(e) {}
    applyFileFiltersAndRecalculate();
    showToast(_t('✓ Đã {0} chế độ gộp Combo lỗi', enabled ? _t('bật') : _t('tắt')), 'info');
}

function exportAliasesJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(errorAliases, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `QIT_Error_Aliases_${toLocalDateStr(new Date())}.json`;
    a.click();
    showToast(_t('✓ Đã xuất tệp Alias JSON'), 'success');
}

function importAliasesJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            if (typeof imported === 'object') {
                Object.assign(errorAliases, imported);
                localStorage.setItem(LS.ALIASES, JSON.stringify(errorAliases));
                applyFileFiltersAndRecalculate();
                renderSettingsModalContent();
                showToast(_t('✅ Đã nạp danh sách Alias thành công!'), 'success');
            }
        } catch(err) {
            showToast(_t('❌ Tệp JSON không hợp lệ'), 'error');
        }
    };
    reader.readAsText(file);
}

function exportFullConfigJSON() {
    const fullConfig = {
        config: CFG,
        aliases: errorAliases,
        hiddenErrors: hiddenErrors,
        volume: audioVolume,
        theme: localStorage.getItem(LS.THEME) || 'dark',
        lang: localStorage.getItem(LS.LANG) || 'vi'
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullConfig, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `QIT_Full_Settings_Backup_${toLocalDateStr(new Date())}.json`;
    a.click();
    showToast(_t('✓ Đã tải tệp sao lưu cấu hình toàn diện'), 'success');
}

function importFullConfigJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const obj = JSON.parse(evt.target.result);
            if (obj.config) Object.assign(CFG, obj.config);
            if (obj.aliases) Object.assign(errorAliases, obj.aliases);
            if (obj.hiddenErrors) Object.assign(hiddenErrors, obj.hiddenErrors);
            if (typeof obj.volume === 'number') audioVolume = obj.volume;

            saveCustomConfig();
            localStorage.setItem(LS.ALIASES, JSON.stringify(errorAliases));
            localStorage.setItem(LS.HIDDEN, JSON.stringify(hiddenErrors));
            localStorage.setItem(LS.VOLUME, audioVolume);

            applyUiZoom(CFG.UI_ZOOM);
            applyTableDensity(CFG.TABLE_DENSITY);
            applyFileFiltersAndRecalculate();
            renderSettingsModalContent();
            showToast(_t('✅ Đã khôi phục toàn bộ cấu hình thành công!'), 'success');
        } catch(err) {
            showToast(_t('❌ Tệp sao lưu không hợp lệ'), 'error');
        }
    };
    reader.readAsText(file);
}

function clearScanHistoryData() {
    openAppDialog({
        title: _t('🗑️ Xóa Lịch Sử Quét Phiên'),
        message: _t('Bạn có chắc muốn làm trống danh sách lịch sử các lượt quét trực tiếp trong phiên hiện tại?'),
        confirmText: _t('Xóa Lịch Sử'),
        danger: true,
        onConfirm: () => {
            scanHistory = [];
            resetLiveScanSessionStats();
            try { localStorage.removeItem(LS.HISTORY); } catch(e) {}
            renderScanHistoryTable();
            showToast(_t('✓ Đã làm trống lịch sử quét'), 'info');
        }
    });
}

function factoryResetApp() {
    openAppDialog({
        title: _t('⚠️ Khôi Phục Cài Đặt Gốc (Factory Reset)'),
        message: _t('Tất cả cấu hình tùy chỉnh, tên gọi lỗi (Aliases) và lịch sử lưu trữ sẽ được đưa về mặc định ban đầu. Tiếp tục?'),
        confirmText: _t('Khôi Phục Gốc'),
        danger: true,
        onConfirm: () => {
            try { localStorage.clear(); } catch(e) {}
            location.reload();
        }
    });
}

function updateShiftHours(key, val) {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 23) {
        CFG[key] = num;
        saveCustomConfig();
        calculateShiftData();
        if (currentTab === 'analysis' && currentAnalysisWorkspace === 'timeline') {
            renderAnalysisDashboard();
        }
    }
}

function onShiftModeChange(mode) {
    CFG.SHIFT_MODE = mode;
    if (mode === '2_SHIFTS') {
        CFG.SHIFT_1_NAME = _t('Ca Ngày (08:00 - 20:00)');
        CFG.SHIFT_1_START = 8;
        CFG.SHIFT_1_END = 20;
        CFG.SHIFT_2_NAME = _t('Ca Đêm (20:00 - 08:00)');
        CFG.SHIFT_2_START = 20;
        CFG.SHIFT_2_END = 8;
    } else {
        CFG.SHIFT_1_NAME = 'Ca 1 (06:00 - 14:00)';
        CFG.SHIFT_1_START = 6;
        CFG.SHIFT_1_END = 14;
        CFG.SHIFT_2_NAME = 'Ca 2 (14:00 - 22:00)';
        CFG.SHIFT_2_START = 14;
        CFG.SHIFT_2_END = 22;
        CFG.SHIFT_3_NAME = 'Ca 3 (22:00 - 06:00)';
        CFG.SHIFT_3_START = 22;
        CFG.SHIFT_3_END = 6;
    }
    saveCustomConfig();
    calculateShiftData();
    renderSettingsModalContent();
    if (currentTab === 'analysis' && currentAnalysisWorkspace === 'timeline') {
        renderAnalysisDashboard();
    }
}
