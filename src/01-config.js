/* ════════════ CẤU HÌNH HỆ THỐNG SCANNER V2 PRO (MỞ RỘNG) ════════════ */
var CFG = {
    // --- Matcher đối soát mã vạch ---
    MIN_SCAN_LEN: 3,           // Mã quét ngắn hơn ngưỡng này => từ chối
    MIN_TARGET_LEN: 4,         // ID trong danh sách ngắn hơn => cảnh báo
    ALLOW_REVERSE_MATCH: false,// Cho phép mã quét NGẮN HƠN ID
    REVERSE_MIN_RATIO: 0.8,    // Tỉ lệ tối thiểu nếu bật reverse match
    TRIM_SCAN_WHITESPACE: true,// Tự động cắt khoảng trắng đầu/cuối mã quét
    AUTO_TRIM_PREFIX: '',      // Tiền tố cần tự động lọc bỏ (nếu có)
    AUTO_TRIM_SUFFIX: '',      // Hậu tố cần tự động lọc bỏ (nếu có)
    SCAN_MATCH_MODE: 'flex',   // 'flex' (3 tầng thông minh) | 'exact' (Chính xác 100%)

    // --- Kiểm soát Đối Soát Đa Group (Multi-Group Audit Control) ---
    AUDIT_SCAN_SCOPE: 'GLOBAL',     // 'ACTIVE' (Khóa riêng trong Group đang chọn) | 'GLOBAL' (Tự động định tuyến toàn bộ Group)
    AUDIT_AUTO_SWITCH_GROUP: true,  // Tự động chuyển tiêu điểm sang Group chứa mã vừa quét
    AUDIT_WARN_KLIPPEL_FAIL: true,  // Cảnh báo nghiêm trọng nếu mã xuất kho bị FAIL trong Klippel Log
    AUDIT_DEFAULT_BATCH_SIZE: 10,   // Quy cách số lượng mặc định khi chia tách Thùng/Kiện tự động

    // --- Phân tích chu kỳ sản xuất & Gap thời gian ---
    GAP_THRESHOLD_MIN: 30,     // 30 phút (chuẩn tài liệu kỹ thuật) - ngưỡng tách chu kỳ sự kiện đo
    
    // --- Cấu hình Ca Sản Xuất (Shifts Configuration) ---
    SHIFT_MODE: '3_SHIFTS',    // '3_SHIFTS' (3 ca 8h) | '2_SHIFTS' (2 ca 12h) | 'CUSTOM'
    SHIFT_1_NAME: 'Ca 1 (06:00 - 14:00)',
    SHIFT_1_START: 6,
    SHIFT_1_END: 14,
    SHIFT_2_NAME: 'Ca 2 (14:00 - 22:00)',
    SHIFT_2_START: 14,
    SHIFT_2_END: 22,
    SHIFT_3_NAME: 'Ca 3 (22:00 - 06:00)',
    SHIFT_3_START: 22,
    SHIFT_3_END: 6,

    // --- Năng lực quy trình Cpk & Chuẩn SPC ---
    CPK_DATA_FILTER: 'PASS_ONLY', // 'PASS_ONLY' (Chuẩn SPC Klippel) | 'ALL' (Tất cả) | 'TRIMMED_3SIGMA' (Lọc dị biệt)
    CPK_EXCELLENT: 1.67,       // Cpk >= 1.67: Xuất sắc (6-Sigma)
    CPK_CAPABLE: 1.33,         // Cpk >= 1.33: Đạt năng lực
    CPK_MARGINAL: 1.00,        // 1.00 <= Cpk < 1.33: Cận biên / Cần kiểm soát
    NEAR_FAIL_MARGIN_PCT: 10,  // Ngưỡng cảnh báo cận biên sai số (% sát mép LSL/USL)
    HISTOGRAM_BINS_COUNT: 16,  // Số cột bin trong biểu đồ phân phối

    // --- Nạp tệp & Thư mục (Fast Multi-Million File Scanner) ---
    AUTO_FILTER_SUMMARY_ONLY: true, // Tự động tìm và lọc file có chữ 'Summary' trong thư mục con
    SCAN_MAX_DEPTH: 6,             // Giới hạn độ sâu thư mục quét (tránh quét vô tận)
    SCAN_SEARCH_PATTERN: 'summary',// Từ khóa nhận diện file tổng kết
    SCAN_EXCLUDE_FOLDERS: ['node_modules', '.git', '.svn', '$recycle.bin', 'system volume information', 'temp', 'tmp', 'cache', 'waveforms', 'backup', 'backups'],

    // --- Giọng nói & Âm thanh ---
    VOICE_ALERTS_ENABLED: false, // Đọc giọng nói (Web Speech API) "Đạt" / "Lỗi"
    VOICE_LANG: 'vi-VN',

    // --- Hiển thị & Thu phóng ---
    UI_ZOOM: 100,              // Tỷ lệ thu phóng giao diện (80% - 150%)
    TABLE_DENSITY: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
    HIGH_CONTRAST: false,

    // --- Lưu trữ & Tải tệp ---
    HISTORY_LIMIT: 300,
    SAVE_DEBOUNCE_MS: 800,

    // --- UI & Tương tác ---
    AUDIT_RENDER_DEBOUNCE_MS: 150,
    TOAST_MS: 3200,
    ENABLE_EASTER_EGGS: true
};

// Khóa localStorage cho v2
var LS = {
    CFG_CUSTOM: 'qit_v2_custom_cfg',
    ALIASES:    'qit_v2_aliases',
    HIDDEN:     'qit_v2_hidden_errors',
    HISTORY:    'qit_v2_history',
    COMBO:      'qit_v2_combo_mode',
    THEME:      'qit_v2_theme',
    MUTED:      'qit_v2_audio_muted',
    VOLUME:     'qit_v2_audio_volume',
    LANG:       'qit_v2_lang',
    FLAGS:      'qit_v2_flag_zones',
    AUDIT:      'qit_v2_audit_state'
};

// Tải cấu hình tùy chỉnh đã lưu nếu có
(function loadCustomConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(LS.CFG_CUSTOM));
        if (saved && typeof saved === 'object') {
            Object.assign(CFG, saved);
            // Fix legacy 20160 min bug if user never explicitly set a normal gap
            if (CFG.GAP_THRESHOLD_MIN === 20160) {
                CFG.GAP_THRESHOLD_MIN = 30;
            }
        }
    } catch(e) {}
})();
