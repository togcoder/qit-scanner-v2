/* ════════════ KHỞI ĐỘNG HỆ THỐNG & ĐĂNG KÝ SỰ KIỆN (BOOTSTRAP) V2 ════════════ */

let isFastScanRunning = false;
let isFastScanAborted = false;
let currentFastScanFoundFiles = [];

/**
 * Bộ bảo vệ vùng nhập liệu (Focus Guard)
 * Ngăn chặn việc cướp con trỏ khi người dùng đang thao tác trên các form/bảng/tìm kiếm
 */
function isUserInteractingWithUI() {
    const el = document.activeElement;
    if (el) {
        if (el.id === 'scanner-input' || el.id === 'audit-scanner-input') return false;
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
            return true; // Đang gõ ở ô Tên Group, Ghi chú, Tìm kiếm, Batch Size... -> CẤM cướp focus!
        }
    }
    // Nếu người dùng đang bôi đen văn bản trong bảng để copy -> CẤM cướp focus!
    const sel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection().toString() : '';
    if (sel && sel.length > 0) return true;
    // Nếu đang mở Modal cấu hình hoặc Dialog -> CẤM cướp focus!
    if (typeof document !== 'undefined') {
        const openModal = document.querySelector('.modal:not(.hidden), .modal-backdrop:not(.hidden)');
        if (openModal) return true;
    }
    return false;
}

/**
 * Bộ đo vận tốc phím & Phân loại: Súng Quét (Scanner Burst / Paste) vs Gõ Tay (Manual Typing)
 */
const scanInputState = {
    lastKeyTime: 0,
    fastStreakCount: 0,
    autoSubmitTimer: null
};

function onScanInputEvent(e, inputEl, submitCallback) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const delta = now - scanInputState.lastKeyTime;
    scanInputState.lastKeyTime = now;

    if (delta < 45) {
        scanInputState.fastStreakCount++;
    } else if (delta > 150) {
        // Khoảng nghỉ dài -> reset chuỗi gõ nhanh
        scanInputState.fastStreakCount = 0;
    }

    clearTimeout(scanInputState.autoSubmitTimer);
    const val = inputEl.value.trim();
    const minLen = (window.CFG && CFG.MIN_SCAN_LEN) ? CFG.MIN_SCAN_LEN : 4;

    // CHỈ TỰ ĐỘNG SUBMIT KHÔNG CẦN ENTER KHI PHÁT HIỆN LUỒNG QUÉT TỐC ĐỘ CAO
    // (Súng barcode không cấu hình Enter, hoặc dán Paste, hoặc chuỗi >= 4 ký tự bắn vào < 45ms/ký tự)
    const isPasteOrScannerBurst = (e && e.inputType === 'insertFromPaste') || (scanInputState.fastStreakCount >= 3);

    if (isPasteOrScannerBurst && val.length >= minLen) {
        scanInputState.autoSubmitTimer = setTimeout(() => {
            const finalVal = inputEl.value.trim();
            if (finalVal.length >= minLen) {
                if (typeof submitCallback === 'function') {
                    submitCallback(finalVal);
                }
                inputEl.value = '';
                scanInputState.fastStreakCount = 0;
            }
        }, 110); // Chốt mã ngay sau 110ms kể từ ký tự cuối cùng của súng quét
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    QIT.i18n.applyTranslations();

    // 1. Đăng ký sự kiện Kéo & Thả tệp và Thư mục tại Drop Zone
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');

    if (dropZone && fileInput) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drop-zone-active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drop-zone-active');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drop-zone-active');
            
            showToast(_t('🔄 Đang kiểm tra và trích xuất tệp...'), 'info');
            const extractedFiles = await extractFilesFromDataTransfer(e.dataTransfer);
            if (extractedFiles.length > 0) {
                handleSelectedFiles(extractedFiles, true);
            } else {
                showToast(_t('⚠️ Không tìm thấy tệp nhật ký hợp lệ (.log, .txt, .csv)'), 'warning');
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                e.target.value = '';
                const setupScr = document.getElementById('setup-screen');
                const isSetupVisible = setupScr && !setupScr.classList.contains('hidden');
                handleSelectedFiles(files, false, !isSetupVisible);
            }
        });
    }

    if (folderInput) {
        folderInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                e.target.value = '';
                handleSelectedFiles(files, true, true);
            }
        });
    }

    // 2. Đăng ký sự kiện Quét mã vạch tại ô Scanner Input (Hỗ trợ phân loại Súng quét vs Gõ tay)
    const scanInput = document.getElementById('scanner-input');
    if (scanInput) {
        scanInput.addEventListener('keydown', onScanInputKeydown);
        scanInput.addEventListener('input', (e) => onScanInputEvent(e, scanInput, (val) => {
            handleScanBarcode(val);
        }));
    }

    const auditScanInput = document.getElementById('audit-scanner-input');
    if (auditScanInput) {
        auditScanInput.addEventListener('keydown', onAuditScanKeydown);
        auditScanInput.addEventListener('input', (e) => onScanInputEvent(e, auditScanInput, (val) => {
            handleAuditScan(val);
        }));
    }

    // 3. Global Keystroke Router & Focus Guard (Chống cướp focus và bắt phím thông minh)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettingsModal();
            closeDrilldownModal();
            closeRobotLifetimeModal();
            closeFastScanModal();
            closeNetworkShareGuideModal();
            return;
        }

        // Phím tắt Alt + E: Bật/tắt Ngăn Kéo Kỹ Sư (Engineering Drawer) trên Tab Đối Soát
        if (e.altKey && (e.key === 'e' || e.key === 'E')) {
            e.preventDefault();
            if (typeof toggleAuditEngineeringDrawer === 'function') {
                toggleAuditEngineeringDrawer();
            }
            return;
        }

        if (isUserInteractingWithUI()) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        // Tự động chuyển ký tự in được (length === 1) vào ô quét của Tab đang kích hoạt
        if (e.key.length === 1) {
            const activeInput = (currentTab === 'audit')
                ? document.getElementById('audit-scanner-input')
                : document.getElementById('scanner-input');
            if (activeInput && document.activeElement !== activeInput) {
                activeInput.focus();
            }
        }
    });

    // 5. Logo trigger mở bảng thống kê robot
    const logoMini = document.getElementById('mini-logo-trigger');
    if (logoMini) {
        logoMini.addEventListener('click', showRobotLifetimeStats);
    }

    if (typeof loadAuditStateFromStorage === 'function') loadAuditStateFromStorage();
    if (typeof updateStatusBar === 'function') updateStatusBar();
    console.log('🚀 QIT Scanner v2 Pro System initialized successfully!');
});

/**
 * Tiện ích nhường CPU cho giao diện trình duyệt (Tránh đơ khi duyệt triệu file)
 */
function yieldToUI() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Kiểm tra siêu tốc phần mở rộng tệp:
 * Loại bỏ ngay lập tức 99.99% tệp nhị phân Klippel (.kdbx, .wav, .mdat, .bin) hàng trăm GB
 */
function isNonLogBinaryFile(name) {
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx === -1) return true;
    const ext = name.substring(dotIdx).toLowerCase();
    if (ext === '.kdbx' || ext === '.kdb' || ext === '.wav' || ext === '.mdat' || 
        ext === '.bin' || ext === '.raw' || ext === '.bak' || ext === '.tmp' || 
        ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.zip' || 
        ext === '.7z' || ext === '.rar' || ext === '.pdf' || ext === '.exe' || 
        ext === '.dll' || ext === '.dat' || ext === '.mat') {
        return true;
    }
    return ext !== '.log' && ext !== '.txt' && ext !== '.csv';
}

/**
 * Kiểm tra các thư mục rác / dung lượng lớn cần bỏ qua đệ quy
 */
function isIgnoredDirectory(dirName) {
    const lower = dirName.toLowerCase();
    return lower === 'waveforms' || lower === 'rawdata' || lower === 'audio' ||
           lower === 'snapshots' || lower === 'attachments' || lower === 'kdbx_backup' ||
           lower === 'temp' || lower === 'tmp' || lower === 'node_modules' ||
           lower === '.git' || lower === '$recycle.bin' || lower === 'system volume information' ||
           lower === 'backup' || lower === 'backups';
}

/**
 * Trích xuất toàn bộ tệp đệ quy từ DataTransfer với cơ chế lọc sớm và nhường CPU
 */
async function extractFilesFromDataTransfer(dataTransfer) {
    const files = [];
    const items = dataTransfer.items;

    if (items && items.length > 0) {
        const queue = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.webkitGetAsEntry) {
                const entry = item.webkitGetAsEntry();
                if (entry) queue.push({ entry, depth: 0 });
            } else if (item.kind === 'file') {
                const f = item.getAsFile();
                if (f && !isNonLogBinaryFile(f.name)) files.push(f);
            }
        }

        let processedCount = 0;

        while (queue.length > 0) {
            const { entry, depth } = queue.shift();
            processedCount++;

            if (processedCount % 100 === 0) {
                await yieldToUI();
            }

            if (entry.isFile) {
                if (!isNonLogBinaryFile(entry.name)) {
                    if (!CFG.AUTO_FILTER_SUMMARY_ONLY || entry.name.toLowerCase().includes('summary')) {
                        const f = await new Promise(resolve => entry.file(resolve, () => resolve(null)));
                        if (f) files.push(f);
                    }
                }
            } else if (entry.isDirectory && depth < (CFG.SCAN_MAX_DEPTH || 6)) {
                if (isIgnoredDirectory(entry.name)) {
                    continue;
                }

                const reader = entry.createReader();
                let entries = [];
                let readBatch = async () => {
                    return new Promise(resolve => reader.readEntries(resolve, () => resolve([])));
                };

                let batch = await readBatch();
                while (batch && batch.length > 0) {
                    entries.push(...batch);
                    batch = await readBatch();
                }

                for (const child of entries) {
                    queue.push({ entry: child, depth: depth + 1 });
                }
            }
        }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
        const arr = Array.from(dataTransfer.files).filter(f => !isNonLogBinaryFile(f.name));
        files.push(...arr);
    }

    return files;
}

/**
 * ⚡ BỘ TÌM KIẾM NHANH FILE SUMMARY DÙNG FILE SYSTEM ACCESS API (CHROME / EDGE)
 * Quét luồng trực tiếp (Streaming Traversal), loại bỏ file .kdbx ngay lập tức.
 */
async function startFastDirectoryScan() {
    if (!window.showDirectoryPicker) {
        const folderInput = document.getElementById('folder-input');
        if (folderInput) folderInput.click();
        return;
    }

    try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        if (!dirHandle) return;

        openFastScanModal(dirHandle.name);
        isFastScanRunning = true;
        isFastScanAborted = false;
        currentFastScanFoundFiles = [];

        let stats = {
            dirsScanned: 0,
            filesInspected: 0,
            summaryFound: 0
        };

        await traverseDirectoryHandle(dirHandle, 0, stats);

        isFastScanRunning = false;
        updateFastScanUI(stats, true);
        closeFastScanModal();

        if (currentFastScanFoundFiles.length > 0) {
            const files = Array.from(currentFastScanFoundFiles);
            currentFastScanFoundFiles = [];
            handleSelectedFiles(files, true, true);
        } else {
            showToast(_t('ℹ️ Đã quét xong nhưng không tìm thấy tệp chứa chữ "Summary".'), 'info');
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Fast directory scan error:', err);
            showToast(_t('⚠️ Không thể truy cập thư mục: {0}', err.message), 'warning');
        }
        closeFastScanModal();
    }
}

/**
 * Hàm duyệt đệ quy DirectoryHandle hiệu năng cao
 */
async function traverseDirectoryHandle(dirHandle, depth, stats) {
    if (isFastScanAborted) return;
    if (depth > (CFG.SCAN_MAX_DEPTH || 6)) return;

    stats.dirsScanned++;

    try {
        for await (const [name, handle] of dirHandle.entries()) {
            if (isFastScanAborted) break;

            if (handle.kind === 'file') {
                stats.filesInspected++;

                // 1. LOẠI BỎ SIÊU TỐC TỆP .KDBX / NHỊ PHÂN TRĂM GB
                if (isNonLogBinaryFile(name)) {
                    if (stats.filesInspected % 300 === 0) {
                        updateFastScanUI(stats, false);
                        await yieldToUI();
                    }
                    continue;
                }

                // 2. KIỂM TRA CHỮ SUMMARY NẾU BẬT CHẾ ĐỘ LỌC
                if (CFG.AUTO_FILTER_SUMMARY_ONLY && !name.toLowerCase().includes('summary')) {
                    continue;
                }

                // 3. CHỈ KHI LÀ FILE SUMMARY MỚI LẤY FILE OBJECT
                try {
                    const fileObj = await handle.getFile();
                    if (fileObj) {
                        currentFastScanFoundFiles.push(fileObj);
                        stats.summaryFound++;
                        addFastScanFoundItem(fileObj);
                    }
                } catch(e) {}

                if (stats.filesInspected % 100 === 0) {
                    updateFastScanUI(stats, false);
                    await yieldToUI();
                }
            } else if (handle.kind === 'directory') {
                if (isIgnoredDirectory(name)) {
                    continue;
                }
                await traverseDirectoryHandle(handle, depth + 1, stats);
            }
        }
    } catch(e) {
        console.warn('Lỗi đọc thư mục con:', e);
    }
}

/* ════════════ MODAL & GIAO DIỆN TÌM KIẾM NHANH (FAST SCAN HUD VỚI LOGO QIT) ════════════ */
function openFastScanModal(folderName) {
    let modal = document.getElementById('fast-scan-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fast-scan-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-card" style="max-width:640px; border-color:var(--accent-blue); box-shadow:0 20px 60px rgba(0,242,254,0.25);">
            <div class="modal-header" style="border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <!-- Logo QIT Hoạt Họa Đang Quét / Phân Tích -->
                    <div style="width:42px; height:42px; flex-shrink:0;">
                        <svg class="qit-logo-analyzing" viewBox="50 50 200 200" style="width:100%; height:100%;">
                            <defs>
                                <linearGradient id="qScanG" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#00f2fe"/>
                                    <stop offset="100%" stop-color="#38bdf8"/>
                                </linearGradient>
                            </defs>
                            <line x1="175" y1="175" x2="230" y2="230" stroke="url(#qScanG)" stroke-width="26" stroke-linecap="round"/>
                            <circle cx="140" cy="140" r="65" fill="none" stroke="url(#qScanG)" stroke-width="18"/>
                            <g>
                                <rect x="90" y="145" width="14" height="40" fill="#0ea5e9" class="qit-bar-bounce-1"/>
                                <rect x="118" y="160" width="14" height="25" fill="#8b5cf6" class="qit-bar-bounce-2"/>
                                <rect x="146" y="125" width="14" height="60" fill="#06b6d4" class="qit-bar-bounce-3"/>
                                <rect x="174" y="135" width="14" height="50" fill="#a855f7" class="qit-bar-bounce-4"/>
                            </g>
                            <polyline points="97,125 125,140 153,105 181,115" fill="none" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="97" cy="125" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3" class="qit-node-pulse"/>
                            <circle cx="125" cy="140" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3" class="qit-node-pulse"/>
                            <circle cx="153" cy="105" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3" class="qit-node-pulse"/>
                            <circle cx="181" cy="115" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3" class="qit-node-pulse"/>
                        </svg>
                    </div>
                    <div>
                        <h3 style="font-size:16px; font-weight:800; margin:0; color:var(--text-main);">${_t('ĐANG QUÉT TÌM TỆP SUMMARY...')}</h3>
                        <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); margin-top:2px;">
                            ${_t('Thư mục:')} <strong style="color:var(--accent-blue);">${escapeHtml(folderName)}</strong>
                        </div>
                    </div>
                </div>
                <button class="btn-icon" onclick="abortFastScan(true)" title="${_t('Đóng')}">✕</button>
            </div>

            <div class="modal-body" style="padding:16px; display:flex; flex-direction:column; gap:14px;">
                <!-- 3 Thẻ Đếm Thời Gian Thực -->
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:8px; padding:10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">${_t('Thư Mục Đã Quét')}</div>
                        <div id="fs-dirs-count" style="font-size:18px; font-weight:800; font-family:var(--font-mono); color:var(--accent-blue); margin-top:4px;">0</div>
                    </div>
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:8px; padding:10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">${_t('Tệp Đã Lọc Bỏ')}</div>
                        <div id="fs-files-count" style="font-size:18px; font-weight:800; font-family:var(--font-mono); color:var(--text-main); margin-top:4px;">0</div>
                    </div>
                    <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:10px; text-align:center;">
                        <div style="font-size:10px; font-weight:800; color:#34d399; text-transform:uppercase;">${_t('File Summary Tìm Thấy')}</div>
                        <div id="fs-summary-count" style="font-size:18px; font-weight:900; font-family:var(--font-mono); color:#10b981; margin-top:4px;">0</div>
                    </div>
                </div>

                <!-- Danh sách file tìm thấy trực tiếp -->
                <div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); margin-bottom:6px; display:flex; justify-content:space-between;">
                        <span>${_t('📋 TỆP SUMMARY TÌM THẤY TRỰC TIẾP:')}</span>
                        <span id="fs-status-text" style="color:var(--accent-blue); font-weight:700;">${_t('Đang duyệt luồng...')}</span>
                    </div>
                    <div id="fs-found-list" style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; max-height:160px; overflow-y:auto; padding:6px 10px; font-family:var(--font-mono); font-size:11.5px; display:flex; flex-direction:column; gap:4px;">
                        <div style="color:var(--text-muted); text-align:center; padding:20px;">${_t('Đang quét qua các thư mục con...')}</div>
                    </div>
                </div>
            </div>

            <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-top:1px solid var(--border-color);">
                <button class="btn btn-secondary btn-sm" onclick="abortFastScan(true)">${_t('✕ Hủy Bỏ')}</button>
                <button id="fs-btn-done" class="btn btn-primary btn-sm" onclick="finishFastScanImmediately()">
                    ⏹ ${_t('Dừng & Nạp Ngay')} (<span id="fs-done-count">0</span> ${_t('Tệp')})
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function updateFastScanUI(stats, isComplete) {
    const dEl = document.getElementById('fs-dirs-count');
    const fEl = document.getElementById('fs-files-count');
    const sEl = document.getElementById('fs-summary-count');
    const doneCountEl = document.getElementById('fs-done-count');
    const statusEl = document.getElementById('fs-status-text');

    if (dEl) dEl.innerText = stats.dirsScanned.toLocaleString();
    if (fEl) fEl.innerText = stats.filesInspected.toLocaleString();
    if (sEl) sEl.innerText = stats.summaryFound.toLocaleString();
    if (doneCountEl) doneCountEl.innerText = stats.summaryFound;

    if (statusEl && isComplete) {
        statusEl.innerHTML = '<span style="color:#10b981;">✓ ' + _t('Hoàn tất') + '</span>';
    }
}

function addFastScanFoundItem(fileObj) {
    const list = document.getElementById('fs-found-list');
    if (!list) return;

    if (currentFastScanFoundFiles.length === 1) {
        list.innerHTML = '';
    }

    const item = document.createElement('div');
    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04);';
    item.innerHTML = `
        <span style="color:var(--accent-blue); font-weight:700;">📄 ${escapeHtml(fileObj.name)}</span>
        <span style="color:var(--text-muted); font-size:10.5px;">${formatBytes(fileObj.size)}</span>
    `;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
}

function abortFastScan(cancelAll = false) {
    isFastScanAborted = true;
    isFastScanRunning = false;
    closeFastScanModal();
    if (cancelAll) {
        showToast(_t('Đã hủy quá trình quét thư mục.'), 'info');
    }
}

function finishFastScanImmediately() {
    isFastScanAborted = true;
    isFastScanRunning = false;
    closeFastScanModal();

    if (currentFastScanFoundFiles.length > 0) {
        const files = Array.from(currentFastScanFoundFiles);
        currentFastScanFoundFiles = [];
        handleSelectedFiles(files, true, true);
    } else {
        showToast(_t('⚠️ Chưa tìm thấy tệp Summary nào để nạp.'), 'warning');
    }
}

function closeFastScanModal() {
    const modal = document.getElementById('fast-scan-modal');
    if (modal) modal.classList.add('hidden');
}

/* ════════════ HƯỚNG DẪN QUÉT SIÊU TỐC TRÊN Ổ MẠNG DOANH NGHIỆP ════════════ */
function openNetworkShareGuideModal() {
    let modal = document.getElementById('network-guide-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'network-guide-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-card" style="max-width:680px;">
            <div class="modal-header">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,#00f2fe,#38bdf8); display:grid; place-items:center; font-size:16px;">🌐</div>
                    <div>
                        <h3 style="font-size:16px; font-weight:800; margin:0;">${_t('MẸO TÌM FILE SUMMARY SIÊU TỐC TRÊN Ổ MẠNG (MILLION FILES)')}</h3>
                        <div style="font-size:10.5px; color:var(--text-muted); font-family:var(--font-mono);">HIGH-SCALE NETWORK SHARED DRIVE SCANNING</div>
                    </div>
                </div>
                <button class="btn-icon" onclick="closeNetworkShareGuideModal()" title="${_t('Đóng')}">✕</button>
            </div>

            <div class="modal-body" style="padding:18px; display:flex; flex-direction:column; gap:16px; font-size:13px; line-height:1.6;">
                <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:10px; padding:12px 14px;">
                    <strong style="color:var(--accent-blue);">💡 ${_t('Tại sao quét ổ mạng qua trình duyệt có thể chậm?')}</strong>
                    <div style="color:var(--text-sub); font-size:12px; margin-top:4px;">
                        ${_t('Khi thư mục mạng chứa hàng trăm ngàn đến hàng triệu file con (đặc biệt là file sóng .wav, file dữ liệu thô), giao thức SMB qua mạng LAN tạo độ trễ kết nối cho từng file. Dưới đây là 3 cách tối ưu nhất:')}
                    </div>
                </div>

                <!-- Cách 1: Nút Quét Nhanh Trực Tiếp -->
                <div>
                    <h4 style="font-size:13px; font-weight:800; color:var(--text-main); margin-bottom:4px;">
                        🚀 ${_t('Cách 1: Sử dụng nút "⚡ Quét Nhanh File System" trực tiếp trên Web')}
                    </h4>
                    <p style="color:var(--text-sub); font-size:12px; margin:0;">
                        ${_t('Bấm nút "⚡ Quét Nhanh Thư Mục / Ổ Mạng" tại màn hình nạp tệp. Trình duyệt sẽ dùng API Streaming bỏ qua 100% file không phải Summary, không tốn RAM và cho phép bấm [⏹ Dừng & Nạp Ngay] bất kỳ lúc nào.')}
                    </p>
                </div>

                <!-- Cách 2: Tìm bằng Windows Explorer -->
                <div>
                    <h4 style="font-size:13px; font-weight:800; color:#34d399; margin-bottom:4px;">
                        📂 ${_t('Cách 2: Tìm bằng Windows Explorer rồi kéo thả (Khuyên Dùng - 3 giây)')}
                    </h4>
                    <ol style="color:var(--text-sub); font-size:12px; padding-left:20px; margin:4px 0 0 0;">
                        <li>${_t('Mở thư mục ổ mạng trên máy tính (ví dụ: ổ Z:\\Klippel_Logs).')}</li>
                        <li>${_t('Gõ *summary*.log hoặc *summary* vào ô tìm kiếm góc trên bên phải Windows Explorer và bấm Enter.')}</li>
                        <li>${_t('Bấm {0} chọn toàn bộ các file kết quả {1} Kéo thả thẳng vào giao diện QIT Scanner.', '<code>Ctrl + A</code>', '→')}</li>
                    </ol>
                </div>

                <!-- Cách 3: Lệnh PowerShell 1 Dòng -->
                <div>
                    <h4 style="font-size:13px; font-weight:800; color:#a855f7; margin-bottom:6px;">
                        ⚡ ${_t('Cách 3: Lệnh PowerShell tự động lọc gom file ra thư mục riêng')}
                    </h4>
                    <div style="position:relative; background:#0b0f19; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-family:var(--font-mono); font-size:11.5px; color:#38bdf8;">
                        <code>Get-ChildItem -Path "Z:\\Log" -Filter "*summary*.log" -Recurse | Copy-Item -Destination "C:\\QIT_Logs\\"</code>
                        <button class="btn btn-sm btn-secondary" onclick="copyPowerShellCommand()" style="position:absolute; right:8px; top:8px; font-size:11px;">📋 Copy</button>
                    </div>
                </div>
            </div>

            <div class="modal-footer" style="display:flex; justify-content:flex-end; padding:12px 16px; border-top:1px solid var(--border-color);">
                <button class="btn btn-primary btn-sm" onclick="closeNetworkShareGuideModal()">${_t('Đã Hiểu')}</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeNetworkShareGuideModal() {
    const modal = document.getElementById('network-guide-modal');
    if (modal) modal.classList.add('hidden');
}

function copyPowerShellCommand() {
    const cmd = 'Get-ChildItem -Path "Z:\\Log" -Filter "*summary*.log" -Recurse | Copy-Item -Destination "C:\\QIT_Logs\\"';
    copyTextSafe(cmd, _t('✅ Đã sao chép lệnh PowerShell vào Clipboard!'));
}

/**
 * Xử lý danh sách tệp được chọn từ File/Folder picker hoặc Drag-Drop
 */
function handleSelectedFiles(files, isFromFolder = false, autoProcess = false) {
    // Lọc theo phần mở rộng hợp lệ (.log, .txt, .csv)
    let validFiles = files.filter(f => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.log') || lower.endsWith('.txt') || lower.endsWith('.csv');
    });

    if (validFiles.length === 0) {
        showToast(_t('⚠️ Vui lòng chọn tệp có định dạng .log, .txt hoặc .csv'), 'warning');
        return;
    }

    // Tự động lọc tệp Summary nếu bật tùy chọn hoặc nạp từ thư mục
    const shouldFilterSummary = CFG.AUTO_FILTER_SUMMARY_ONLY !== false;
    if (shouldFilterSummary && isFromFolder) {
        const summaryFiles = validFiles.filter(f => /summary/i.test(f.name));
        if (summaryFiles.length > 0) {
            showToast(_t('🔍 Đã tự động lọc {0} tệp Summary!', summaryFiles.length), 'success');
            validFiles = summaryFiles;
        } else {
            showToast(_t('ℹ️ Không tìm thấy chữ "Summary" trong tên. Đã nạp {0} tệp nhật ký.', validFiles.length), 'info');
        }
    }

    filesToLoad = validFiles;
    renderFilePreviewList();
    setProcessingButtonState(false, _t('TIẾN HÀNH XỬ LÝ DỮ LIỆU') + ` (${filesToLoad.length} Tệp)`);

    // Tự động xử lý nạp tệp ngay nếu:
    // 1. autoProcess được yêu cầu
    // 2. Hoặc người dùng đang thao tác trong màn hình làm việc chính (các Tab 1, 3, 4, 5)
    // 3. Hoặc được nạp từ thư mục (Folder Picker / Fast Scan / Drop Thư mục)
    const setupScr = document.getElementById('setup-screen');
    const isSetupVisible = setupScr && !setupScr.classList.contains('hidden');

    if (autoProcess || !isSetupVisible || isFromFolder) {
        processMultipleLogFiles(validFiles);
    }
}

function renderFilePreviewList() {
    const preview = document.getElementById('file-list-preview');
    const processBtn = document.getElementById('btn-process');
    if (!preview) return;

    if (filesToLoad.length === 0) {
        preview.innerHTML = '';
        if (processBtn) processBtn.disabled = true;
        return;
    }

    let html = '<div class="preview-stack" style="max-height:180px; overflow-y:auto; text-align:left;">';
    filesToLoad.forEach((f, idx) => {
        const displayName = f.webkitRelativePath || f.name;
        const isSum = /summary/i.test(f.name);
        html += `
            <div class="preview-item" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">
                <div style="display:flex; align-items:center; gap:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <span class="preview-icon">${isSum ? '📋' : '📄'}</span>
                    <span class="preview-name" style="font-weight:${isSum ? '700' : '500'}; color:${isSum ? 'var(--accent-blue)' : 'var(--text-main)'};" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
                </div>
                <span class="preview-size" style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); margin-left:12px;">${formatBytes(f.size)}</span>
            </div>
        `;
    });
    html += '</div>';

    preview.innerHTML = html;
    if (processBtn) processBtn.disabled = false;
}

