/* ════════════ HỆ THỐNG ĐỐI SOÁT DANH SÁCH ĐA GROUP ĐỘC LẬP (MULTI-GROUP AUDIT ENGINE) V2 PRO ════════════ */

/**
 * Lưu và khôi phục trạng thái Multi-Group Audit từ LocalStorage
 */
function saveAuditStateToStorage() {
    try {
        const serialized = {
            groups: auditState.groups,
            activeGroupId: auditState.activeGroupId,
            scanScope: auditState.scanScope,
            autoSwitchGroup: auditState.autoSwitchGroup,
            warnOnKlippelFail: auditState.warnOnKlippelFail,
            strangerList: (auditState.strangerList || []).slice(0, 100),
            scanLog: (auditState.scanLog || []).slice(0, 200)
        };
        localStorage.setItem(LS.AUDIT, JSON.stringify(serialized));
    } catch (e) {}
}

function loadAuditStateFromStorage() {
    try {
        const raw = localStorage.getItem(LS.AUDIT);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.groups) && parsed.groups.length > 0) {
            auditState.groups = parsed.groups;
            auditState.activeGroupId = parsed.activeGroupId || 'ALL';
            auditState.scanScope = parsed.scanScope || CFG.AUDIT_SCAN_SCOPE || 'GLOBAL';
            auditState.autoSwitchGroup = parsed.autoSwitchGroup !== false;
            auditState.warnOnKlippelFail = parsed.warnOnKlippelFail !== false;
            auditState.strangerList = Array.isArray(parsed.strangerList) ? parsed.strangerList : [];
            auditState.scanLog = Array.isArray(parsed.scanLog) ? parsed.scanLog : [];
            syncAuditFlatState();
            return true;
        }
    } catch (e) {}
    return false;
}

/**
 * Tạo đối tượng mục tiêu chuẩn hóa kèm tách Model/Serial và liên kết Klippel QC
 */
function createAuditTargetItem(rawId, indexInGroup, groupId, groupName, note = '') {
    const cleanRaw = sanitizeIdentifier(rawId);
    const idInfo = typeof parseIdentifier === 'function'
        ? parseIdentifier(cleanRaw, '', null, indexInGroup, '')
        : { displayID: cleanRaw, cleanSN: getAlphaNum(cleanRaw), cleanSeri: getAlphaNum(cleanRaw), modelName: '', serialNo: cleanRaw };

    return {
        index: indexInGroup,
        groupId: groupId,
        groupName: groupName,
        rawId: cleanRaw,
        cleanId: idInfo.cleanSN || getAlphaNum(cleanRaw),
        cleanSeri: idInfo.cleanSeri || getAlphaNum(cleanRaw),
        modelHint: (idInfo.modelName && idInfo.modelName !== 'STANDARD_MODEL') ? idInfo.modelName : '',
        serialOnly: idInfo.serialNo || cleanRaw,
        note: note || '',
        scanCount: 0,
        firstScanTime: null,
        lastScanTime: null
    };
}

/**
 * Tạo một Group kiểm soát mới
 */
function createAuditGroupObject(name, rawLines, note = '', existingItems = null) {
    const groupId = 'GRP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const cleanName = (name || '').trim() || `Group #${(auditState.groups ? auditState.groups.length : 0) + 1}`;

    let items = [];
    if (Array.isArray(existingItems)) {
        items = existingItems.map((it, idx) => Object.assign({}, it, {
            index: idx + 1,
            groupId: groupId,
            groupName: cleanName
        }));
    } else if (Array.isArray(rawLines)) {
        items = rawLines.map((lineObj, idx) => {
            if (typeof lineObj === 'string') {
                return createAuditTargetItem(lineObj, idx + 1, groupId, cleanName);
            }
            return createAuditTargetItem(lineObj.rawId, idx + 1, groupId, cleanName, lineObj.note || '');
        });
    }

    const scannedCount = items.filter(i => i.scanCount > 0).length;
    const duplicateCount = items.reduce((acc, i) => acc + Math.max(0, (i.scanCount || 0) - 1), 0);

    return {
        id: groupId,
        name: cleanName,
        note: note || '',
        locked: false,
        createdAt: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        targetList: items,
        scannedCount: scannedCount,
        duplicateCount: duplicateCount
    };
}

/**
 * Đồng bộ trạng thái phẳng (auditState.targetList & auditState.scannedCount) từ danh sách các Group
 * Bảo đảm tương thích 100% với mọi hàm xuất báo cáo và bộ kiểm thử tự động.
 */
function syncAuditFlatState() {
    if (!Array.isArray(auditState.groups)) {
        auditState.groups = [];
    }

    let globalIdx = 1;
    let allTargets = [];
    let totalScanned = 0;
    let totalDup = 0;

    auditState.groups.forEach(g => {
        if (!Array.isArray(g.targetList)) g.targetList = [];
        g.scannedCount = 0;
        g.duplicateCount = 0;

        g.targetList.forEach((item, idx) => {
            item.index = idx + 1;
            item.globalIndex = globalIdx++;
            item.groupId = g.id;
            item.groupName = g.name;
            if ((item.scanCount || 0) > 0) {
                g.scannedCount++;
                totalScanned++;
            }
            if ((item.scanCount || 0) > 1) {
                g.duplicateCount += (item.scanCount - 1);
                totalDup += (item.scanCount - 1);
            }
            allTargets.push(item);
        });
    });

    // Kiểm tra nếu activeGroupId không còn tồn tại
    if (auditState.activeGroupId !== 'ALL' && !auditState.groups.some(g => g.id === auditState.activeGroupId)) {
        auditState.activeGroupId = auditState.groups.length === 1 ? auditState.groups[0].id : 'ALL';
    }

    auditState.targetList = allTargets;
    auditState.scannedCount = totalScanned;
    auditState.duplicateCount = totalDup;
    saveAuditStateToStorage();
    if (typeof updateStatusBar === 'function') updateStatusBar();
}

function syncAuditWithKlippelLogs() {
    if (currentTab === 'audit') {
        renderAuditDashboard();
    }
}

/**
 * Phân tích văn bản đầu vào thành 1 hoặc nhiều Group:
 * Hỗ trợ:
 * 1) Tiêu đề nhóm: "# Tên Group", "[Tên Group]", "=== Tên Group ===", "GROUP: Tên Group"
 * 2) Định dạng 2 cột CSV/TSV: "Tên Group, Mã_Serial" hoặc "Tên Group \t Mã_Serial"
 * 3) Danh sách mã đơn thuần (1 mã / dòng)
 */
function parseRawTextIntoGroupSpecs(rawText, defaultGroupName) {
    const lines = String(rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const groupMap = new Map(); // groupName -> Array<{ rawId, note }>
    let currentGroup = (defaultGroupName || '').trim() || _t('Group #01 · Danh Sách Chính');

    lines.forEach(line => {
        // Bỏ qua dòng tiêu đề bảng
        const lower = line.toLowerCase();
        if (lower === 'serial' || lower === 'serialnumber' || lower === 'stt,serial' || lower === 'group,serial' || lower.startsWith('stt\t')) {
            return;
        }

        // Kiểm tra cú pháp Header Group: # Tên Group, [Tên Group], === Tên Group ===, GROUP: Tên Group
        const headerMatch = line.match(/^(?:#+|\[|===+|group\s*[:\-]|kiện\s*[:\-]|thùng\s*[:\-]|pallet\s*[:\-])\s*(.+?)(?:\]|===+)?$/i);
        if (headerMatch && headerMatch[1]) {
            currentGroup = headerMatch[1].trim();
            if (!groupMap.has(currentGroup)) groupMap.set(currentGroup, []);
            return;
        }

        // Kiểm tra định dạng 2 cột: GroupName , SerialNumber hoặc GroupName \t SerialNumber
        if (line.includes('\t') || line.includes(',') || line.includes(';')) {
            const delim = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
            const parts = line.split(delim).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
            if (parts.length >= 2) {
                // Nếu cột 1 là số thứ tự (1, 2, 3...) thì cột 2 là Serial, cột 3 (nếu có) là Group
                if (/^\d+$/.test(parts[0])) {
                    const serial = parts[1];
                    const grp = parts[2] || currentGroup;
                    if (!groupMap.has(grp)) groupMap.set(grp, []);
                    groupMap.get(grp).push({ rawId: serial, note: parts[3] || '' });
                    return;
                } else {
                    // Cột 1 là Tên Group, Cột 2 là Mã Serial
                    const grp = parts[0];
                    const serial = parts[1];
                    if (serial && serial.length >= 2 && !/^(serial|mã|target|id)$/i.test(serial)) {
                        if (!groupMap.has(grp)) groupMap.set(grp, []);
                        groupMap.get(grp).push({ rawId: serial, note: parts[2] || '' });
                        return;
                    }
                }
            }
        }

        if (!groupMap.has(currentGroup)) {
            groupMap.set(currentGroup, []);
        }
        groupMap.get(currentGroup).push({ rawId: line, note: '' });
    });

    const result = [];
    groupMap.forEach((items, name) => {
        if (items.length > 0) {
            result.push({ name, items });
        }
    });
    return result;
}

/**
 * Nạp danh sách mã mục tiêu từ ô nhập liệu (Hỗ trợ cả Ghi đè danh sách mới hoặc Thêm thành Group mới)
 */
function loadAuditTargetList(appendAsNewGroup = false) {
    const textarea = document.getElementById('audit-target-input');
    const nameInput = document.getElementById('audit-group-name-input');
    const noteInput = document.getElementById('audit-group-note-input');
    if (!textarea) return;

    const rawText = textarea.value.trim();
    if (!rawText) {
        showToast(_t('⚠️ Vui lòng dán danh sách mã cần kiểm tra vào ô nhập liệu.'), 'warning');
        return;
    }

    const customGroupName = nameInput && nameInput.value.trim()
        ? nameInput.value.trim()
        : `Group #${String((appendAsNewGroup ? auditState.groups.length : 0) + 1).padStart(2, '0')}`;
    const customNote = noteInput && noteInput.value.trim() ? noteInput.value.trim() : '';

    const specs = parseRawTextIntoGroupSpecs(rawText, customGroupName);
    if (specs.length === 0) return;

    if (!appendAsNewGroup) {
        auditState.groups = [];
        auditState.scanLog = [];
        auditState.strangerList = [];
    }

    let addedItemsCount = 0;
    let lastCreatedGroupId = null;

    specs.forEach(sp => {
        const grp = createAuditGroupObject(sp.name, sp.items, customNote);
        auditState.groups.push(grp);
        addedItemsCount += grp.targetList.length;
        lastCreatedGroupId = grp.id;
    });

    if (auditState.groups.length === 1) {
        auditState.activeGroupId = auditState.groups[0].id;
    } else if (appendAsNewGroup && lastCreatedGroupId) {
        auditState.activeGroupId = lastCreatedGroupId;
    } else {
        auditState.activeGroupId = 'ALL';
    }

    if (nameInput) nameInput.value = '';
    if (noteInput) noteInput.value = '';

    syncAuditFlatState();
    renderAuditDashboard();
    showToast(_t('✅ Đã nạp {0} mã mục tiêu vào {1} Group kiểm soát!', addedItemsCount, specs.length), 'success');
}

/**
 * Nạp tệp danh sách mã mục tiêu từ file (.xlsx, .xls, .csv, .txt) — Tự động tách Group theo Sheet hoặc Cột Group
 */
async function handleAuditFileUpload(fileInput) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const fileName = file.name;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

    try {
        showToast(_t('⏳ Đang nạp tệp danh sách: {0}...', fileName), 'info');
        let structuredLines = [];

        if (ext === '.xlsx' || ext === '.xls') {
            if (typeof ExcelJS === 'undefined') {
                showToast(_t('⚠️ Thư viện ExcelJS chưa tải xong. Vui lòng thử lại sau giây lát.'), 'warning');
                return;
            }
            const arrayBuffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);

            workbook.worksheets.forEach(worksheet => {
                const sheetGroup = workbook.worksheets.length > 1 ? `${baseName} - ${worksheet.name}` : baseName;
                const sheetItems = [];
                worksheet.eachRow((row, rowNumber) => {
                    const vals = [];
                    row.eachCell((cell) => {
                        if (cell.value != null) vals.push(String(cell.value).trim());
                    });
                    if (vals.length === 0) return;
                    const firstLower = vals[0].toLowerCase();
                    if (firstLower.includes('serial') || firstLower === 'stt' || firstLower === 'mã' || firstLower === 'group') return;

                    if (vals.length >= 2 && !/^\d+$/.test(vals[0])) {
                        // Cột 1 là Group, Cột 2 là Serial
                        structuredLines.push(`${vals[0]}\t${vals[1]}`);
                    } else if (vals.length >= 2 && /^\d+$/.test(vals[0])) {
                        // Cột 1 là STT, Cột 2 là Serial, Cột 3 (nếu có) là Group
                        const grp = vals[2] || sheetGroup;
                        structuredLines.push(`${grp}\t${vals[1]}`);
                    } else if (vals[0].length >= 2) {
                        sheetItems.push(vals[0]);
                    }
                });
                if (sheetItems.length > 0) {
                    structuredLines.push(`# ${sheetGroup}`);
                    sheetItems.forEach(s => structuredLines.push(s));
                }
            });
        } else {
            const text = await file.text();
            structuredLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        }

        if (structuredLines.length === 0) {
            showToast(_t('⚠️ Không tìm thấy mã hợp lệ trong tệp đã chọn.'), 'warning');
            return;
        }

        const textarea = document.getElementById('audit-target-input');
        if (textarea) {
            textarea.value = structuredLines.join('\n');
        }
        const nameInput = document.getElementById('audit-group-name-input');
        if (nameInput && !nameInput.value.trim()) {
            nameInput.value = baseName;
        }

        loadAuditTargetList(auditState.groups.length > 0);
    } catch (err) {
        console.error('Lỗi khi nạp tệp danh sách:', err);
        showToast(_t('❌ Lỗi khi đọc tệp: {0}', err.message), 'error');
    } finally {
        fileInput.value = '';
    }
}

/**
 * ⚡ CÔNG CỤ TÁCH GROUP TỰ ĐỘNG (AUTO-SPLIT GROUPS)
 * 1) 'BATCH_SIZE': Chia danh sách hiện tại thành các Thùng/Kiện theo số lượng định mức (VD: 10, 20, 50 PCS/thùng)
 * 2) 'MODEL_PREFIX': Tự động gom nhóm theo Tiền tố Model hoặc Model/Trạm trong Klippel Log
 * 3) 'KLIPPEL_STATUS': Tách riêng Group Đạt (PASS), Group Lỗi (FAIL/NG) và Group Chưa Đo
 */
function splitAuditIntoGroups(mode) {
    if (!auditState.targetList || auditState.targetList.length === 0) {
        showToast(_t('⚠️ Chưa có danh sách mục tiêu để tách Group. Hãy nạp danh sách hoặc bấm [Nạp Mẫu 4 Group].'), 'warning');
        return;
    }

    const allItems = auditState.targetList.slice();

    if (mode === 'BATCH_SIZE') {
        const sizeInput = document.getElementById('audit-batch-size-input');
        const batchSize = Math.max(1, parseInt(sizeInput ? sizeInput.value : CFG.AUDIT_DEFAULT_BATCH_SIZE, 10) || 10);
        CFG.AUDIT_DEFAULT_BATCH_SIZE = batchSize;
        saveCustomConfig();

        const newGroups = [];
        const totalBatches = Math.ceil(allItems.length / batchSize);
        for (let b = 0; b < totalBatches; b++) {
            const slice = allItems.slice(b * batchSize, (b + 1) * batchSize);
            const startNum = b * batchSize + 1;
            const endNum = b * batchSize + slice.length;
            const gName = _t('Thùng #{0} ({1}–{2})', String(b + 1).padStart(2, '0'), startNum, endNum);
            newGroups.push(createAuditGroupObject(gName, null, _t('Quy cách {0} PCS/thùng', batchSize), slice));
        }

        auditState.groups = newGroups;
        auditState.activeGroupId = 'ALL';
        syncAuditFlatState();
        renderAuditDashboard();
        showToast(_t('📦 Đã chia tách {0} mã thành {1} Thùng/Group ({2} PCS/Group)!', allItems.length, newGroups.length, batchSize), 'success');
    } else if (mode === 'MODEL_PREFIX') {
        const map = new Map();
        allItems.forEach(item => {
            let groupKey = item.modelHint || '';
            if (!groupKey && loadedFilesMap.size > 0) {
                const m = findRecordByBarcode(item.rawId);
                if (m && m.record) {
                    groupKey = m.record.modelName ? `${m.record.modelName} (${m.record.stationName})` : m.record.stationName;
                }
            }
            if (!groupKey) {
                if (item.rawId.includes('_')) groupKey = 'Model ' + item.rawId.split('_')[0];
                else if (item.rawId.includes('-')) groupKey = _t('Lô ') + item.rawId.split('-').slice(0, 2).join('-');
                else groupKey = 'Prefix ' + item.rawId.slice(0, 6).toUpperCase();
            }
            if (!map.has(groupKey)) map.set(groupKey, []);
            map.get(groupKey).push(item);
        });

        const newGroups = [];
        map.forEach((list, key) => {
            newGroups.push(createAuditGroupObject(key, null, _t('{0} sản phẩm', list.length), list));
        });

        auditState.groups = newGroups;
        auditState.activeGroupId = 'ALL';
        syncAuditFlatState();
        renderAuditDashboard();
        showToast(_t('🏷️ Đã tự động phân loại thành {0} Group theo Model / Tiền tố!', newGroups.length), 'success');
    } else if (mode === 'KLIPPEL_STATUS') {
        const passList = [];
        const failList = [];
        const noLogList = [];

        allItems.forEach(item => {
            const m = loadedFilesMap.size > 0 ? findRecordByBarcode(item.rawId) : null;
            if (!m || !m.record) {
                noLogList.push(item);
            } else if (isRecordPass(m.record)) {
                passList.push(item);
            } else {
                failList.push(item);
            }
        });

        const newGroups = [];
        if (passList.length > 0) newGroups.push(createAuditGroupObject(_t('✓ Group Đạt Chuẩn Klippel (PASS)'), null, _t('Đủ điều kiện đóng gói xuất kho'), passList));
        if (failList.length > 0) newGroups.push(createAuditGroupObject(_t('✕ Group Hàng Lỗi Klippel (FAIL/NG)'), null, _t('Cần cách ly / Không được xuất kho'), failList));
        if (noLogList.length > 0) newGroups.push(createAuditGroupObject(_t('❓ Group Chưa Có Log Đo'), null, _t('Cần kiểm tra lại trên trạm Klippel'), noLogList));

        auditState.groups = newGroups;
        auditState.activeGroupId = 'ALL';
        syncAuditFlatState();
        renderAuditDashboard();
        showToast(_t('🔬 Đã tách thành {0} Group theo phán định chất lượng Klippel QC!', newGroups.length), 'success');
    }
}

/**
 * Nạp bộ dữ liệu mẫu 4 Group Kiểm Tra Danh Sách (liên kết trực tiếp với dữ liệu Klippel Log)
 */
function loadDemoMultiGroupAudit(silent = false) {
    const demoText = [
        _t('# Kiện #01 · Pallet A (Chuyền SAS208-01)'),
        'P2001315-10-B_SIEV261531B1001',
        'P2001315-10-B_SIEV261531B1002',
        'P2001315-10-B_SIEV261531B1003',
        'P2001315-10-B_SIEV261531B1004',
        'P2001315-10-B_SIEV261531B1005',
        'P2001315-10-B_SIEV261531B1006',
        _t('# Kiện #02 · Pallet B (Chuyền SAS208-02)'),
        'P2001315-10-B_SIEV261531B1007',
        'P2001315-10-B_SIEV261531B1008',
        'P2001315-10-B_SIEV261531B1009',
        'P2001315-10-B_SIEV261531B1010',
        'P2001315-10-B_SIEV261531B1011',
        'P2001315-10-B_SIEV261531B1012',
        _t('# Kiện #03 · Lô Loa Woofer (Chuyền SFS203-01)'),
        '655983-WOOFER_WFR261016C2001',
        '655983-WOOFER_WFR261016C2002',
        '655983-WOOFER_WFR261016C2003',
        '655983-WOOFER_WFR261016C2004',
        '655983-WOOFER_WFR261016C2005'
    ].join('\n');

    const textarea = document.getElementById('audit-target-input');
    if (textarea) textarea.value = demoText;

    const specs = parseRawTextIntoGroupSpecs(demoText, 'Kiện #01');
    auditState.groups = specs.map((sp, i) => createAuditGroupObject(sp.name, sp.items, _t('Lô xuất kho #0{0}', i + 1)));
    auditState.activeGroupId = 'ALL';
    auditState.scanLog = [];
    auditState.strangerList = [];

    // Đánh dấu mẫu một vài mã đã quét ở Kiện #01 để người dùng thấy trực quan ngay
    if (auditState.groups[0] && auditState.groups[0].targetList.length >= 3) {
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        auditState.groups[0].targetList[0].scanCount = 1;
        auditState.groups[0].targetList[0].firstScanTime = nowStr;
        auditState.groups[0].targetList[0].lastScanTime = nowStr;
        auditState.groups[0].targetList[1].scanCount = 1;
        auditState.groups[0].targetList[1].firstScanTime = nowStr;
        auditState.groups[0].targetList[1].lastScanTime = nowStr;
    }

    syncAuditFlatState();
    renderAuditDashboard();
    if (!silent) {
        showToast(_t('🎯 Đã khởi tạo 3 Group Kiểm Soát Kiện Hàng Mẫu!'), 'success');
    }
}

/**
 * Chọn Group đang làm việc ('ALL' hoặc ID của Group cụ thể)
 */
function selectAuditGroup(groupId) {
    auditState.activeGroupId = groupId || 'ALL';
    saveAuditStateToStorage();
    renderAuditDashboard();
    focusActiveScanInput();
}

/**
 * Chuyển đổi phạm vi quét ('GLOBAL' tự động định tuyến vs 'ACTIVE' khóa riêng trong Group đang chọn)
 */
function setAuditScanScope(scope) {
    auditState.scanScope = scope === 'ACTIVE' ? 'ACTIVE' : 'GLOBAL';
    CFG.AUDIT_SCAN_SCOPE = auditState.scanScope;
    saveCustomConfig();
    saveAuditStateToStorage();
    renderAuditDashboard();
    showToast(
        auditState.scanScope === 'ACTIVE'
            ? _t('🎯 Đã bật [Khóa Phạm Vi Group]: Chỉ cho phép quét mã thuộc Group đang chọn (Chống đóng nhầm thùng)!')
            : _t('🌐 Đã bật [Quét Tự Động Toàn Cục]: Tự động nhận diện và phân bổ mã quét vào đúng Group!'),
        'info'
    );
    focusActiveScanInput();
}

function toggleAuditScanScope() {
    const newScope = auditState.scanScope === 'ACTIVE' ? 'GLOBAL' : 'ACTIVE';
    setAuditScanScope(newScope);
    updateAuditScopeButtonUI();
}

function updateAuditScopeButtonUI() {
    const iconEl = document.getElementById('audit-scope-btn-icon');
    const textEl = document.getElementById('audit-scope-btn-text');
    if (!iconEl || !textEl) return;
    if (auditState.scanScope === 'ACTIVE') {
        iconEl.textContent = '🎯';
        textEl.textContent = _t('Khóa Riêng Group Này');
    } else {
        iconEl.textContent = '🌐';
        textEl.textContent = _t('Tự Động Định Tuyến Mọi Group');
    }
}

function toggleAuditEngineeringDrawer() {
    const drawer = document.getElementById('audit-eng-drawer');
    if (!drawer) return;
    drawer.classList.toggle('collapsed');
    const isOpen = !drawer.classList.contains('collapsed');
    try {
        localStorage.setItem('qit_eng_drawer_open', isOpen ? '1' : '0');
    } catch (e) {}
    updateEngineeringDrawerButtonUI();
}

function updateEngineeringDrawerButtonUI() {
    const drawer = document.getElementById('audit-eng-drawer');
    const btn = document.getElementById('audit-drawer-toggle-btn');
    if (!drawer || !btn) return;
    const isOpen = !drawer.classList.contains('collapsed');
    btn.classList.toggle('btn-primary', isOpen);
    btn.classList.toggle('btn-secondary', !isOpen);
}

function toggleAuditAutoSwitchGroup(checked) {
    auditState.autoSwitchGroup = !!checked;
    CFG.AUDIT_AUTO_SWITCH_GROUP = !!checked;
    saveCustomConfig();
    saveAuditStateToStorage();
}

/**
 * Khóa / Mở khóa một Group (khi kiện hàng đã kiểm đủ 100% và niêm phong)
 */
function toggleLockAuditGroup(groupId, evt) {
    if (evt) evt.stopPropagation();
    const grp = auditState.groups.find(g => g.id === groupId);
    if (!grp) return;
    grp.locked = !grp.locked;
    saveAuditStateToStorage();
    renderAuditDashboard();
    showToast(grp.locked ? _t('🔒 Đã khóa bảo vệ [{0}]', grp.name) : _t('🔓 Đã mở khóa [{0}]', grp.name), 'info');
}

/**
 * Đổi tên & ghi chú của một Group
 */
function renameAuditGroup(groupId, evt) {
    if (evt) evt.stopPropagation();
    const grp = auditState.groups.find(g => g.id === groupId);
    if (!grp) return;

    openAppDialog({
        title: _t('✏️ Đổi Tên Group Kiểm Soát'),
        message: _t('Nhập tên mới cho Group <strong>{0}</strong> ({1} mã):', escapeHtml(grp.name), grp.targetList.length),
        showInput: true,
        inputPlaceholder: _t('VD: Thùng #01 - Pallet A'),
        inputDefault: grp.name,
        confirmText: _t('Lưu Tên Mới'),
        onConfirm: (newName) => {
            if (newName && String(newName).trim()) {
                grp.name = String(newName).trim();
                syncAuditFlatState();
                renderAuditDashboard();
                showToast(_t('✓ Đã đổi tên Group thành: {0}', grp.name), 'success');
            }
        }
    });
}

/**
 * Đặt lại (Reset) kết quả quét của RIÊNG 1 Group mà không ảnh hưởng các Group khác
 */
function resetSingleAuditGroup(groupId, evt) {
    if (evt) evt.stopPropagation();
    const grp = auditState.groups.find(g => g.id === groupId);
    if (!grp) return;

    openAppDialog({
        title: _t('🔄 Đặt Lại Tiến Độ Riêng Group Này'),
        message: _t('Bạn có chắc muốn đặt lại số lần quét của riêng <strong>{0}</strong> về 0? Các Group khác vẫn giữ nguyên 100% dữ liệu.', escapeHtml(grp.name)),
        confirmText: _t('Đặt Lại Group Này'),
        danger: true,
        onConfirm: () => {
            grp.targetList.forEach(it => {
                it.scanCount = 0;
                it.firstScanTime = null;
                it.lastScanTime = null;
            });
            grp.locked = false;
            syncAuditFlatState();
            renderAuditDashboard();
            showToast(_t('✓ Đã đặt lại tiến độ của [{0}]', grp.name), 'info');
        }
    });
}

/**
 * Xóa 1 Group độc lập
 */
function deleteSingleAuditGroup(groupId, evt) {
    if (evt) evt.stopPropagation();
    const idx = auditState.groups.findIndex(g => g.id === groupId);
    if (idx === -1) return;
    const grp = auditState.groups[idx];

    openAppDialog({
        title: _t('🗑️ Xóa Group Kiểm Soát'),
        message: _t('Xóa <strong>{0}</strong> ({1} mã) khỏi danh sách đối soát?', escapeHtml(grp.name), grp.targetList.length),
        confirmText: _t('Xóa Group'),
        danger: true,
        onConfirm: () => {
            auditState.groups.splice(idx, 1);
            if (auditState.activeGroupId === groupId) {
                auditState.activeGroupId = 'ALL';
            }
            syncAuditFlatState();
            renderAuditDashboard();
            showToast(_t('🗑️ Đã xóa [{0}]', grp.name), 'info');
        }
    });
}

function setAuditFilterStatus(status) {
    auditState.filterStatus = status || 'ALL';
    renderAuditTable();
}

function onAuditTableSearch(q) {
    auditState.searchQuery = String(q || '').trim();
    renderAuditTable();
}

function onAuditScanKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        onAuditManualSubmit();
    }
}

function onAuditManualSubmit() {
    const input = document.getElementById('audit-scanner-input');
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        handleAuditScan(val);
        input.value = '';
        input.focus();
    }
}

/**
 * Xử lý quét mã vạch đối soát thông minh theo Group
 */
function handleAuditScan(rawBarcode) {
    if (!auditState.targetList || auditState.targetList.length === 0) {
        showToast(_t('⚠️ Chưa có danh sách mục tiêu. Vui lòng nạp danh sách trước.'), 'warning');
        return;
    }

    // Nếu người dùng truyền trực tiếp auditState.targetList mà chưa có auditState.groups (tương thích ngược)
    if (!auditState.groups || auditState.groups.length === 0) {
        const fallbackGrp = createAuditGroupObject(_t('Group #01 · Mặc Định'), null, '', auditState.targetList);
        auditState.groups = [fallbackGrp];
        syncAuditFlatState();
    }

    const activeGrp = auditState.activeGroupId !== 'ALL'
        ? auditState.groups.find(g => g.id === auditState.activeGroupId)
        : null;

    const isStrictActiveScope = (auditState.scanScope === 'ACTIVE' && activeGrp);
    const primaryPool = isStrictActiveScope ? activeGrp.targetList : auditState.targetList;

    const matchRes = matchScanToTargets(rawBarcode, primaryPool, CFG.SCAN_MATCH_MODE || 'flex');
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });

    const logEntry = {
        time: nowStr,
        rawScan: rawBarcode,
        result: matchRes.result,
        groupName: activeGrp ? activeGrp.name : _t('Toàn bộ'),
        targetItem: null,
        klippelVerdict: null
    };

    if (matchRes.result === 'MATCH' && matchRes.best) {
        const item = matchRes.best;
        const owningGroup = auditState.groups.find(g => g.id === item.groupId);

        // Kiểm tra nếu Group chứa mã này đã bị Khóa (Locked)
        if (owningGroup && owningGroup.locked) {
            playScanSound('FAIL');
            logEntry.result = 'GROUP_LOCKED';
            logEntry.groupName = owningGroup.name;
            logEntry.targetItem = item;
            auditState.scanLog.unshift(logEntry);
            updateAuditHeroBanner(logEntry);
            saveAuditStateToStorage();
            renderAuditDashboard();
            showToast(_t('🔒 TỪ CHỐI: [{0}] đã khóa hoàn tất, không nhận thêm mã quét!', owningGroup.name), 'error');
            return;
        }

        const isFirstScan = (item.scanCount === 0);
        item.scanCount++;
        if (!item.firstScanTime) item.firstScanTime = nowStr;
        item.lastScanTime = nowStr;

        // Tự động nhảy sang Group vừa khớp nếu đang ở chế độ xem từng Group và bật Auto-Switch
        if (!isStrictActiveScope && auditState.autoSwitchGroup && auditState.activeGroupId !== 'ALL' && owningGroup && auditState.activeGroupId !== owningGroup.id) {
            auditState.activeGroupId = owningGroup.id;
        }

        // Kiểm tra chất lượng Klippel QC của mã vừa quét (Outgoing Quality Gate)
        let klippelRec = null;
        let isKlippelFail = false;
        if (loadedFilesMap.size > 0) {
            const klMatch = findRecordByBarcode(item.rawId);
            if (klMatch && klMatch.record) {
                klippelRec = klMatch.record;
                isKlippelFail = !isRecordPass(klippelRec);
                logEntry.klippelVerdict = isKlippelFail ? 'FAIL' : 'PASS';
            }
        }

        logEntry.groupName = owningGroup ? owningGroup.name : (item.groupName || 'Group #1');
        logEntry.targetItem = item;

        syncAuditFlatState();

        if (isKlippelFail && auditState.warnOnKlippelFail) {
            playScanSound('FAIL');
            showToast(_t('🚨 CẢNH BÁO NG: Mã [{0}] khớp tại [{1}] nhưng bị LỖI (FAIL) trong Klippel QC!', item.rawId, logEntry.groupName), 'error');
        } else if (isFirstScan) {
            playScanSound('PASS');
            // Kiểm tra nếu Group vừa hoàn thành 100%
            if (owningGroup && owningGroup.scannedCount === owningGroup.targetList.length) {
                if (typeof triggerConfetti === 'function') triggerConfetti();
                showToast(_t('🎉 HOÀN TẤT 100% [{0}] ({1}/{2} mã)!', owningGroup.name, owningGroup.scannedCount, owningGroup.targetList.length), 'success');
            } else {
                showToast(_t('✓ Khớp [{0}]: {1} (#{2})', logEntry.groupName, item.rawId, item.index), 'success');
            }
        } else {
            playScanSound('DUPLICATE');
            logEntry.result = 'DUPLICATE';
            showToast(_t('⚠️ Quét lặp lần {0} tại [{1}]: {2}', item.scanCount, logEntry.groupName, item.rawId), 'warning');
        }
    } else if (matchRes.result === 'AMBIGUOUS') {
        playScanSound('NOT_FOUND');
        showToast(_t('⚠️ Nhập nhằng ({0} mã trùng độ khớp)', matchRes.candidates.length), 'warning');
    } else {
        // Nếu đang khóa trong Group hiện tại (ACTIVE), kiểm tra xem mã này có nằm ở Group KHÁC không!
        if (isStrictActiveScope) {
            const globalCheck = matchScanToTargets(rawBarcode, auditState.targetList, CFG.SCAN_MATCH_MODE || 'flex');
            if (globalCheck.result === 'MATCH' && globalCheck.best) {
                const otherItem = globalCheck.best;
                const otherGroup = auditState.groups.find(g => g.id === otherItem.groupId);
                playScanSound('FAIL');
                logEntry.result = 'WRONG_GROUP';
                logEntry.groupName = otherGroup ? otherGroup.name : _t('Group khác');
                logEntry.targetItem = otherItem;
                auditState.scanLog.unshift(logEntry);
                updateAuditHeroBanner(logEntry);
                saveAuditStateToStorage();
                renderAuditDashboard();
                showToast(_t('🚨 NHẦM KIỆN HÀNG: Mã [{0}] thuộc [{1}], KHÔNG thuộc [{2}]!', otherItem.rawId, logEntry.groupName, activeGrp.name), 'error');
                return;
            }
        }

        playScanSound('NOT_FOUND');
        auditState.strangerList.unshift({
            time: nowStr,
            rawScan: rawBarcode,
            cleanScan: getAlphaNum(rawBarcode),
            activeGroupName: activeGrp ? activeGrp.name : _t('Toàn bộ')
        });
        showToast(_t('✕ MÃ LẠ: [{0}] không có trong danh sách mục tiêu!', rawBarcode), 'error');
    }

    auditState.scanLog.unshift(logEntry);
    if (auditState.scanLog.length > 200) auditState.scanLog.pop();

    updateAuditHeroBanner(logEntry);
    saveAuditStateToStorage();
    renderAuditDashboard();
}

/**
 * Cập nhật Banner Định Tuyến Nhóm Hàng Cỡ Lớn (Smart Group Routing Hero Banner)
 * Hỗ trợ các trạng thái PASS, DUPLICATE, KLIPPEL_FAIL, WRONG_GROUP, GROUP_LOCKED, UNKNOWN
 */
function updateAuditHeroBanner(logEntry = null) {
    const banner = document.getElementById('audit-hero-banner');
    if (!banner) return;

    const grpTitleEl = document.getElementById('hero-group-title');
    const statusPillEl = document.getElementById('hero-status-pill');
    const serialEl = document.getElementById('hero-serial-display');
    const seqEl = document.getElementById('hero-seq-display');
    const qcEl = document.getElementById('hero-qc-display');
    const scannedEl = document.getElementById('hero-scanned-count');
    const missingEl = document.getElementById('hero-missing-count');
    const progressEl = document.getElementById('hero-progress-bar');

    // Kích hoạt hiệu ứng xung nhịp khi nhận mã quét
    banner.classList.remove('scan-receive-pulse');
    if (typeof banner.offsetWidth !== 'undefined') void banner.offsetWidth;
    banner.classList.add('scan-receive-pulse');

    banner.classList.remove('hero-banner-idle', 'hero-banner-pass', 'hero-banner-fail', 'hero-banner-warn');

    if (!logEntry) {
        banner.classList.add('hero-banner-idle');
        const activeGrp = auditState.activeGroupId !== 'ALL'
            ? auditState.groups.find(g => g.id === auditState.activeGroupId)
            : null;
        if (grpTitleEl) grpTitleEl.textContent = activeGrp ? activeGrp.name : _t('CHỜ QUÉT MÃ...');
        if (statusPillEl) statusPillEl.innerHTML = `<span class="hero-status-text">${_t('Sẵn sàng nhận mã từ súng barcode hoặc camera')}</span>`;
        if (serialEl) serialEl.textContent = '—';
        if (seqEl) seqEl.innerHTML = `<span>${_t('Thứ tự trong kiện: —')}</span>`;
        if (qcEl) qcEl.innerHTML = `<span class="badge-pill" style="background:rgba(148,163,184,0.12); color:var(--text-muted);">${_t('Klippel: Chờ quét')}</span>`;

        const viewItems = getActiveAuditViewItems();
        const tot = viewItems.length;
        const sc = viewItems.filter(i => (i.scanCount || 0) > 0).length;
        const rem = Math.max(0, tot - sc);
        const p = tot > 0 ? (sc / tot) * 100 : 0;
        if (scannedEl) scannedEl.textContent = `${sc} / ${tot}`;
        if (missingEl) missingEl.textContent = `${rem}`;
        if (progressEl) progressEl.style.width = `${p.toFixed(1)}%`;
        return;
    }

    // Xác định Group mục tiêu & tiến độ
    let targetGroup = null;
    if (logEntry.targetItem && logEntry.targetItem.groupId) {
        targetGroup = auditState.groups.find(g => g.id === logEntry.targetItem.groupId);
    } else if (auditState.activeGroupId !== 'ALL') {
        targetGroup = auditState.groups.find(g => g.id === auditState.activeGroupId);
    }

    const groupName = targetGroup ? targetGroup.name : (logEntry.groupName || _t('Toàn bộ'));
    if (grpTitleEl) grpTitleEl.textContent = groupName;

    let gTot = targetGroup ? targetGroup.targetList.length : auditState.targetList.length;
    let gSc = targetGroup ? targetGroup.scannedCount : auditState.scannedCount;
    let gRem = Math.max(0, gTot - gSc);
    let gPct = gTot > 0 ? (gSc / gTot) * 100 : 0;

    if (scannedEl) scannedEl.textContent = `${gSc} / ${gTot}`;
    if (missingEl) missingEl.textContent = `${gRem}`;
    if (progressEl) progressEl.style.width = `${gPct.toFixed(1)}%`;

    if (serialEl) serialEl.textContent = logEntry.rawScan || '—';

    if (seqEl) {
        if (logEntry.targetItem) {
            seqEl.innerHTML = `<span>${_t('Thứ tự trong kiện:')} <strong>#${logEntry.targetItem.index} / ${gTot}</strong></span>`;
        } else {
            seqEl.innerHTML = `<span>${_t('Thứ tự trong kiện: —')}</span>`;
        }
    }

    let pillHtml = '';
    let qcHtml = '';

    switch (logEntry.result) {
        case 'MATCH':
            if (logEntry.klippelVerdict === 'FAIL') {
                banner.classList.add('hero-banner-fail');
                pillHtml = `<span class="hero-status-text" style="color:#f87171;">🚨 ${_t('NG KLIPPEL: MÃ KHỚP NHƯNG LỖI THÔNG SỐ QC')}</span>`;
                qcHtml = `<span class="badge-pill badge-fail" style="font-weight:800; cursor:pointer;" onclick="inspectRecordInModal('${escapeHtml(logEntry.targetItem.rawId)}')">✕ KLIPPEL FAIL 🔍</span>`;
            } else {
                banner.classList.add('hero-banner-pass');
                pillHtml = `<span class="hero-status-text" style="color:#34d399;">✓ ${_t('ĐỐI SOÁT HỢP LỆ — ĐÚNG KIỆN HÀNG')}</span>`;
                qcHtml = logEntry.klippelVerdict === 'PASS'
                    ? `<span class="badge-pill badge-pass" style="font-weight:800; cursor:pointer;" onclick="inspectRecordInModal('${escapeHtml(logEntry.targetItem.rawId)}')">✓ KLIPPEL PASS 🔍</span>`
                    : `<span class="badge-pill badge-pass">${_t('✓ ĐÃ QUÉT')}</span>`;
            }
            break;
        case 'DUPLICATE':
            banner.classList.add('hero-banner-warn');
            const dupTimes = logEntry.targetItem ? logEntry.targetItem.scanCount : 2;
            pillHtml = `<span class="hero-status-text" style="color:#fbbf24;">⚠️ ${_t('QUÉT LẶP LẦN {0} TRONG KIỆN', dupTimes)}</span>`;
            qcHtml = `<span class="badge-pill badge-warn">${_t('⚠️ LẶP ×{0}', dupTimes)}</span>`;
            break;
        case 'WRONG_GROUP':
            banner.classList.add('hero-banner-fail');
            pillHtml = `<span class="hero-status-text" style="color:#f87171;">🚨 ${_t('NHẦM KIỆN: THUỘC [{0}]', escapeHtml(logEntry.groupName))}</span>`;
            qcHtml = `<span class="badge-pill badge-fail">${_t('🚨 SAI GROUP')}</span>`;
            break;
        case 'GROUP_LOCKED':
            banner.classList.add('hero-banner-warn');
            pillHtml = `<span class="hero-status-text" style="color:#fbbf24;">🔒 ${_t('TỪ CHỐI: KIỆN [{0}] ĐÃ KHÓA NIÊM PHONG', escapeHtml(logEntry.groupName))}</span>`;
            qcHtml = `<span class="badge-pill badge-warn">${_t('🔒 ĐÃ KHÓA')}</span>`;
            break;
        case 'AMBIGUOUS':
            banner.classList.add('hero-banner-warn');
            pillHtml = `<span class="hero-status-text" style="color:#fbbf24;">⚠️ ${_t('NHẬP NHẰNG NHIỀU MÃ TRÙNG KHỚP')}</span>`;
            qcHtml = `<span class="badge-pill badge-warn">${_t('⚠️ NHẬP NHẰNG')}</span>`;
            break;
        default: // NOT_FOUND / STRANGER
            banner.classList.add('hero-banner-fail');
            pillHtml = `<span class="hero-status-text" style="color:#f87171;">✕ ${_t('MÃ LẠ: KHÔNG NẰM TRONG MỤC TIÊU')}</span>`;
            qcHtml = `<span class="badge-pill badge-fail">${_t('✕ MÃ LẠ')}</span>`;
            break;
    }

    if (statusPillEl) statusPillEl.innerHTML = pillHtml;
    if (qcEl) qcEl.innerHTML = qcHtml;
}

/**
 * Đánh dấu thủ công / Bỏ đánh dấu 1 mục tiêu trong bảng (dành cho kiểm tra viên có quyền điều chỉnh)
 */
function toggleManualAuditItemScan(groupId, itemIndex) {
    const grp = auditState.groups.find(g => g.id === groupId);
    if (!grp) return;
    if (grp.locked) {
        showToast(_t('🔒 [{0}] đang khóa. Hãy mở khóa trước khi chỉnh sửa.', grp.name), 'warning');
        return;
    }
    const item = grp.targetList.find(it => it.index === itemIndex);
    if (!item) return;

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    if (item.scanCount > 0) {
        item.scanCount = 0;
        item.firstScanTime = null;
        item.lastScanTime = null;
    } else {
        item.scanCount = 1;
        item.firstScanTime = nowStr;
        item.lastScanTime = nowStr;
    }
    syncAuditFlatState();
    renderAuditDashboard();
}

/**
 * Sao chép nhanh danh sách các mã CÒN THIẾU (Chưa quét) của phạm vi đang xem
 */
function copyMissingAuditTargets() {
    const pool = getActiveAuditViewItems();
    const missing = pool.filter(it => (it.scanCount || 0) === 0).map(it => it.rawId);
    if (missing.length === 0) {
        showToast(_t('🎉 Đã quét đủ 100%, không còn mã nào bị thiếu!'), 'success');
        return;
    }
    copyTextSafe(missing.join('\n'), _t('📋 Đã sao chép {0} mã còn thiếu vào Clipboard!', missing.length));
}

function getActiveAuditViewItems() {
    if (auditState.activeGroupId === 'ALL') {
        return auditState.targetList || [];
    }
    const grp = auditState.groups.find(g => g.id === auditState.activeGroupId);
    return grp ? grp.targetList : [];
}

/**
 * Render toàn bộ bảng điều khiển Đối Soát Đa Group (Multi-Group Audit Dashboard)
 */
function renderAuditDashboard() {
    // Khôi phục từ bộ nhớ nếu chưa khởi tạo
    if ((!auditState.groups || auditState.groups.length === 0) && (!auditState.targetList || auditState.targetList.length === 0)) {
        loadAuditStateFromStorage();
    } else if (auditState.targetList.length > 0 && (!auditState.groups || auditState.groups.length === 0)) {
        auditState.groups = [createAuditGroupObject(_t('Group #01 · Danh Sách Chính'), null, '', auditState.targetList)];
        syncAuditFlatState();
    }

    const totalEl = document.getElementById('audit-total-count');
    const scannedEl = document.getElementById('audit-scanned-count');
    const remainingEl = document.getElementById('audit-remaining-count');
    const dupEl = document.getElementById('audit-dup-count');
    const strangerEl = document.getElementById('audit-stranger-count');
    const qcFailEl = document.getElementById('audit-qcfail-count');
    const progressEl = document.getElementById('audit-progress-bar');
    const pctTextEl = document.getElementById('audit-progress-pct');
    const scopeLabelEl = document.getElementById('audit-active-scope-title');

    const viewItems = getActiveAuditViewItems();
    const total = viewItems.length;
    const scanned = viewItems.filter(i => (i.scanCount || 0) > 0).length;
    const remaining = Math.max(0, total - scanned);
    const dupCount = viewItems.reduce((acc, i) => acc + Math.max(0, (i.scanCount || 0) - 1), 0);
    const pct = total > 0 ? (scanned / total) * 100 : 0;

    // Đếm số mã trong danh sách bị FAIL Klippel QC
    let qcFailInList = 0;
    if (loadedFilesMap.size > 0) {
        viewItems.forEach(it => {
            const m = findRecordByBarcode(it.rawId);
            if (m && m.record && !isRecordPass(m.record)) qcFailInList++;
        });
    }

    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (scannedEl) scannedEl.textContent = scanned.toLocaleString();
    if (remainingEl) remainingEl.textContent = remaining.toLocaleString();
    if (dupEl) dupEl.textContent = dupCount.toLocaleString();
    if (strangerEl) strangerEl.textContent = (auditState.strangerList ? auditState.strangerList.length : 0).toLocaleString();
    if (qcFailEl) qcFailEl.textContent = qcFailInList.toLocaleString();
    if (progressEl) progressEl.style.width = pct + '%';
    if (pctTextEl) pctTextEl.textContent = pct.toFixed(1) + '%';

    const activeGrp = auditState.activeGroupId !== 'ALL'
        ? auditState.groups.find(g => g.id === auditState.activeGroupId)
        : null;

    if (scopeLabelEl) {
        if (activeGrp) {
            scopeLabelEl.innerHTML = _t('📦 ĐANG KIỂM SOÁT GROUP: {0} ({1}/{2} mã · {3})', `<strong style="color:var(--accent-cyan);">${escapeHtml(activeGrp.name)}</strong>`, scanned, total, activeGrp.locked ? _t('🔒 Đã Khóa') : _t('🔓 Đang Mở'));
        } else {
            scopeLabelEl.innerHTML = _t('🌐 TỔNG HỢP TOÀN BỘ <strong>{0} GROUP</strong> ({1}/{2} mã đã đối soát)', auditState.groups.length, auditState.scannedCount, auditState.targetList.length);
        }
    }

    updateAuditScopeButtonUI();
    updateEngineeringDrawerButtonUI();
    updateAuditHeroBanner(auditState.scanLog[0] || null);

    // Auto open/close engineering drawer based on state if not manually set
    const drawer = document.getElementById('audit-eng-drawer');
    if (drawer) {
        let storedDrawer = null;
        try { storedDrawer = localStorage.getItem('qit_eng_drawer_open'); } catch (e) {}
        if (storedDrawer === null) {
            if (auditState.groups.length === 0) {
                drawer.classList.remove('collapsed');
            } else {
                drawer.classList.add('collapsed');
            }
            updateEngineeringDrawerButtonUI();
        }
    }

    // Render danh sách thẻ Group (Group Control Cards)
    renderAuditGroupsPanel();

    // Render Chip Lịch Sử Quét Trực Tiếp (Live Scan Chips)
    const chipsContainer = document.getElementById('audit-chips-container');
    if (chipsContainer) {
        if (auditState.scanLog.length === 0) {
            chipsContainer.innerHTML = `<span style="font-size:11.5px; color:var(--text-muted); padding:6px 0;">(${_t('Chưa có lượt quét nào — Kết quả quét từng mã & Group tương ứng sẽ hiển thị tức thì tại đây')})</span>`;
        } else {
            chipsContainer.innerHTML = auditState.scanLog.slice(0, 18).map(log => {
                let badgeStyle = 'background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.38); color:#34d399;';
                let icon = '✓';
                let label = log.rawScan;
                let subTag = log.groupName ? `[${log.groupName}]` : '';

                if (log.result === 'MATCH' || log.result === 'DUPLICATE') {
                    if (log.klippelVerdict === 'FAIL') {
                        badgeStyle = 'background:rgba(239,68,68,0.22); border:1px solid rgba(239,68,68,0.6); color:#fca5a5;';
                        icon = '🚨 QC FAIL:';
                    } else if (log.result === 'DUPLICATE' || (log.targetItem && log.targetItem.scanCount > 1)) {
                        badgeStyle = 'background:rgba(245,158,11,0.16); border:1px solid rgba(245,158,11,0.42); color:#fbbf24;';
                        icon = _t('⚠️ Lặp ×{0}:', log.targetItem ? log.targetItem.scanCount : 2);
                    }
                } else if (log.result === 'WRONG_GROUP') {
                    badgeStyle = 'background:rgba(239,68,68,0.22); border:1px solid rgba(239,68,68,0.6); color:#fca5a5;';
                    icon = _t('🚨 Sai Group (Thuộc {0}):', log.groupName);
                    subTag = '';
                } else if (log.result === 'GROUP_LOCKED') {
                    badgeStyle = 'background:rgba(245,158,11,0.2); border:1px solid rgba(245,158,11,0.5); color:#fbbf24;';
                    icon = _t('🔒 Đã khóa:');
                } else if (log.result === 'AMBIGUOUS') {
                    badgeStyle = 'background:rgba(245,158,11,0.16); border:1px solid rgba(245,158,11,0.4); color:#fbbf24;';
                    icon = _t('⚠️ Nhập nhằng:');
                } else {
                    badgeStyle = 'background:rgba(239,68,68,0.16); border:1px solid rgba(239,68,68,0.4); color:#f87171;';
                    icon = _t('✕ Mã lạ:');
                    subTag = '';
                }
                return `<span class="badge-pill" style="${badgeStyle} font-size:11px; padding:4px 9px; font-family:var(--font-mono);" title="${_t('Quét lúc {0}', log.time)}">
                    ${icon} <strong>${escapeHtml(label)}</strong> ${subTag ? `<span style="color:var(--accent-cyan);">${escapeHtml(subTag)}</span>` : ''} <span style="font-size:9.5px; opacity:0.75;">(${log.time})</span>
                </span>`;
            }).join('');
        }
    }

    // Badge thông báo trạng thái liên kết Klippel Log
    const badgeEl = document.getElementById('audit-log-reference-badge');
    if (badgeEl) {
        if (loadedFilesMap.size > 0) {
            badgeEl.innerHTML = `<span class="badge-pill badge-pass" style="font-size:11px;">🔗 ${_t('Đang liên kết Chốt Chặn Chất Lượng với {0} tệp Klippel Log ({1} DUT)', loadedFilesMap.size, dictLookupClean.size.toLocaleString())}</span>`;
        } else {
            badgeEl.innerHTML = `<span class="meta-chip">${_t('ℹ️ Chế độ Kiểm Tra Danh Sách Độc Lập (Zero-Log Mode)')}</span>`;
        }
    }

    renderAuditTable();
}

/**
 * Render Bảng Điều Khiển Các Group Độc Lập (Multi-Group Control Deck)
 */
function renderAuditGroupsPanel() {
    const container = document.getElementById('audit-groups-deck');
    const countBadge = document.getElementById('audit-groups-count-badge');
    if (!container) return;

    const groups = auditState.groups || [];
    if (countBadge) {
        countBadge.textContent = `${groups.length} Group`;
    }

    if (groups.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:18px; color:var(--text-muted); border:1px dashed var(--border-color); border-radius:12px; width:100%;">
                ${_t('Chưa có Group kiểm soát nào. Hãy dán danh sách mã trong Ngăn Kỹ Sư hoặc bấm [🧪 Nạp Mẫu 3 Group].')}
            </div>
        `;
        return;
    }

    const totalAll = auditState.targetList.length;
    const scannedAll = auditState.scannedCount;
    const pctAll = totalAll > 0 ? ((scannedAll / totalAll) * 100).toFixed(1) : '0.0';
    const isAllActive = auditState.activeGroupId === 'ALL';

    let html = `
        <!-- Thẻ Tổng Hợp Tất Cả Các Group -->
        <div class="audit-group-card ${isAllActive ? 'active-group-card' : ''}" onclick="selectAuditGroup('ALL')" style="min-width:240px; flex:0 0 auto;">
            <div class="agc-header">
                <div>
                    <div class="agc-title">${_t('🌐 TẤT CẢ CÁC GROUP ({0})', groups.length)}</div>
                    <div class="agc-sub">${_t('Tổng hợp toàn bộ lô đối soát')}</div>
                </div>
                <span class="agc-pct" style="color:var(--accent-cyan); font-weight:800;">${pctAll}%</span>
            </div>
            <div class="agc-progress-track">
                <div class="agc-progress-fill" style="width:${pctAll}%;"></div>
            </div>
            <div class="agc-stats-row">
                <span>${_t('Tổng:')} <strong>${totalAll}</strong></span>
                <span style="color:#10b981;">${_t('Đã quét:')} <strong>${scannedAll}</strong></span>
                <span style="color:#f87171;">${_t('Thiếu:')} <strong>${Math.max(0, totalAll - scannedAll)}</strong></span>
            </div>
        </div>
    `;

    groups.forEach((g, idx) => {
        const isSelected = auditState.activeGroupId === g.id;
        const gTotal = g.targetList.length;
        const gScanned = g.scannedCount || 0;
        const gRem = Math.max(0, gTotal - gScanned);
        const gPct = gTotal > 0 ? (gScanned / gTotal) * 100 : 0;
        const isDone = gTotal > 0 && gScanned === gTotal;

        let qcNgCount = 0;
        if (loadedFilesMap.size > 0) {
            g.targetList.forEach(it => {
                const m = findRecordByBarcode(it.rawId);
                if (m && m.record && !isRecordPass(m.record)) qcNgCount++;
            });
        }

        html += `
            <div class="audit-group-card ${isSelected ? 'active-group-card' : ''} ${isDone ? 'done-group-card' : ''} ${g.locked ? 'locked-group-card' : ''}" onclick="selectAuditGroup('${escapeHtml(g.id)}')" style="min-width:240px; flex:0 0 auto;">
                <div class="agc-header">
                    <div style="min-width:0; flex:1;">
                        <div class="agc-title" title="${escapeHtml(g.name)}">
                            ${g.locked ? '🔒' : (isDone ? '✅' : '📦')} ${escapeHtml(g.name)}
                        </div>
                        <div class="agc-sub">${escapeHtml(g.note || _t('Group #{0} · Tạo lúc {1}', idx + 1, g.createdAt))}</div>
                    </div>
                    <span class="agc-pct" style="color:${isDone ? '#10b981' : 'var(--accent-blue)'}; font-weight:800;">${gPct.toFixed(0)}%</span>
                </div>
                <div class="agc-progress-track">
                    <div class="agc-progress-fill ${isDone ? 'fill-done' : ''}" style="width:${gPct.toFixed(1)}%;"></div>
                </div>
                <div class="agc-stats-row">
                    <span>${_t('Mục tiêu:')} <strong>${gTotal}</strong></span>
                    <span style="color:#10b981;">${_t('Đạt:')} <strong>${gScanned}</strong></span>
                    <span style="color:${gRem > 0 ? '#f87171' : 'var(--text-muted)'};">${_t('Thiếu:')} <strong>${gRem}</strong></span>
                    ${qcNgCount > 0 ? `<span style="color:#ef4444; font-weight:800;" title="${_t('Có {0} sản phẩm trong Group này bị FAIL trong Klippel Log', qcNgCount)}">🚨 ${qcNgCount} NG</span>` : ''}
                </div>
                <div class="agc-actions" onclick="event.stopPropagation();">
                    <button class="agc-btn" onclick="toggleLockAuditGroup('${escapeHtml(g.id)}', event)" title="${g.locked ? _t('Mở khóa Group này') : _t('Khóa bảo vệ Group này')}">
                        ${g.locked ? _t('🔓 Mở') : _t('🔒 Khóa')}
                    </button>
                    <button class="agc-btn" onclick="renameAuditGroup('${escapeHtml(g.id)}', event)" title="${_t('Đổi tên Group')}">✏️</button>
                    <button class="agc-btn" onclick="exportAuditReport('${escapeHtml(g.id)}')" title="${_t('Xuất Excel riêng Group này')}">📥</button>
                    <button class="agc-btn" onclick="resetSingleAuditGroup('${escapeHtml(g.id)}', event)" title="${_t('Đặt lại riêng tiến độ')}">🔄</button>
                    <button class="agc-btn agc-btn-danger" onclick="deleteSingleAuditGroup('${escapeHtml(g.id)}', event)" title="${_t('Xóa Group này')}">✕</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Đóng / Mở hàng chi tiết kỹ thuật Accordion trong bảng đối soát
 */
function toggleAuditRowAccordion(itemIndex) {
    const row = document.getElementById(`audit-accordion-${itemIndex}`);
    const icon = document.getElementById(`audit-acc-icon-${itemIndex}`);
    if (!row) return;
    const willShow = row.classList.contains('hidden');
    row.classList.toggle('hidden');
    if (icon) {
        icon.textContent = willShow ? '▾' : '▸';
    }
}

/**
 * Render Bảng Danh Sách Thích Ứng 5 Cột + Hàng Accordion Mở Rộng
 */
function renderAuditTable() {
    const tbody = document.getElementById('audit-table-tbody');
    const countBadge = document.getElementById('audit-filtered-count-label');
    if (!tbody) return;

    const viewItems = getActiveAuditViewItems();
    if (viewItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:28px;">${_t('Chưa nạp danh sách mục tiêu. Hãy dán danh sách mã vạch, nạp tệp Excel/CSV hoặc bấm [🧪 Nạp Mẫu 3 Group Kiện Hàng].')}</td></tr>`;
        if (countBadge) countBadge.textContent = _t('0 mã');
        return;
    }

    const filter = auditState.filterStatus || 'ALL';
    const q = (auditState.searchQuery || '').toUpperCase();

    const filtered = viewItems.filter(item => {
        const isScanned = (item.scanCount || 0) > 0;
        const isDup = (item.scanCount || 0) > 1;
        const m = loadedFilesMap.size > 0 ? findRecordByBarcode(item.rawId) : null;
        const rec = m ? m.record : null;
        const isQcFail = rec ? !isRecordPass(rec) : false;
        const isNoLog = loadedFilesMap.size > 0 && !rec;

        if (filter === 'SCANNED' && !isScanned) return false;
        if (filter === 'MISSING' && isScanned) return false;
        if (filter === 'DUPLICATE' && !isDup) return false;
        if (filter === 'KLIPPEL_FAIL' && !isQcFail) return false;
        if (filter === 'NO_LOG' && !isNoLog) return false;

        if (q) {
            const hay = `${item.rawId} ${item.cleanId} ${item.groupName || ''} ${item.modelHint || ''} ${rec ? rec.stationName : ''}`.toUpperCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (countBadge) {
        countBadge.textContent = _t('Hiển thị {0} / {1} mã', filtered.length, viewItems.length);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:24px;">${_t('Không có mã mục tiêu nào khớp với bộ lọc hiện tại.')}</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(item => {
        const isDone = (item.scanCount || 0) > 0;
        const isDup = (item.scanCount || 0) > 1;

        let statusBadge = '';
        if (isDone) {
            statusBadge = isDup
                ? `<span class="badge-pill badge-warn">${_t('⚠️ LẶP (×{0})', item.scanCount)}</span>`
                : `<span class="badge-pill badge-pass">${_t('✓ ĐÃ QUÉT')}</span>`;
        } else {
            statusBadge = `<span class="badge-pill badge-notfound">${_t('⏳ CHƯA QUÉT')}</span>`;
        }

        let timeStr = '';
        if (item.firstScanTime) {
            timeStr = item.firstScanTime;
            if (item.lastScanTime && item.lastScanTime !== item.firstScanTime) {
                timeStr += ` → ${item.lastScanTime}`;
            }
        }

        let klippelCol = `<span style="color:var(--text-muted); font-size:11px;">—</span>`;
        let rec = null;
        let isPass = false;
        let reVal = '', fsVal = '', splVal = '';
        let errs = '';

        if (loadedFilesMap.size > 0) {
            const matchRec = findRecordByBarcode(item.rawId);
            if (matchRec && matchRec.record) {
                rec = matchRec.record;
                isPass = isRecordPass(rec);
                if (rec.metrics) {
                    for (let mk in rec.metrics) {
                        const low = mk.toLowerCase();
                        if (low.startsWith('re')) reVal = `${rec.metrics[mk].value.toFixed(2)} Ω`;
                        else if (low.startsWith('fs')) fsVal = `${rec.metrics[mk].value.toFixed(1)} Hz`;
                        else if (low.includes('level') || low.includes('spl')) splVal = `${rec.metrics[mk].value.toFixed(1)} dB`;
                    }
                }
                errs = !isPass ? activeErrors(rec.errors).map(getMappedName).join(', ') : '';

                klippelCol = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="badge-pill ${isPass ? 'badge-pass' : 'badge-fail'}" style="font-size:10.5px; font-weight:800; cursor:pointer;" onclick="event.stopPropagation(); inspectRecordInModal('${escapeHtml(rec.id)}')">
                            ${isPass ? '✓ PASS' : '✕ FAIL'} 🔍
                        </span>
                        <span style="font-family:var(--font-mono); font-size:11px; color:var(--accent-blue); font-weight:700;">${escapeHtml(rec.stationName)}</span>
                    </div>
                `;
            } else {
                klippelCol = `<span class="badge-pill badge-warn" style="font-size:10px;">${_t('❓ Chưa có log')}</span>`;
            }
        }

        html += `
            <tr class="${isDone ? 'row-scanned' : ''} audit-main-row" onclick="toggleAuditRowAccordion(${item.index})" style="cursor:pointer;">
                <td style="text-align:center; font-family:var(--font-mono); font-weight:700;">
                    <span id="audit-acc-icon-${item.index}" style="font-size:10.5px; color:var(--text-muted); margin-right:4px;">▸</span>#${item.index}
                </td>
                <td>
                    <span class="meta-chip meta-chip-cyan" onclick="event.stopPropagation(); selectAuditGroup('${escapeHtml(item.groupId)}')">
                        📦 ${escapeHtml(item.groupName || 'Group #1')}
                    </span>
                </td>
                <td style="font-weight:700; font-family:var(--font-mono); color:var(--text-main);">
                    ${escapeHtml(item.rawId)}
                    ${item.modelHint ? `<div style="font-size:10.5px; font-weight:normal; color:var(--text-muted);">${escapeHtml(item.modelHint)}</div>` : ''}
                </td>
                <td>
                    ${statusBadge}
                    ${timeStr ? `<div style="font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted); margin-top:2px;">${escapeHtml(timeStr)}</div>` : ''}
                </td>
                <td>
                    ${klippelCol}
                </td>
            </tr>
            <tr id="audit-accordion-${item.index}" class="audit-accordion-row hidden">
                <td colspan="5" style="background:var(--bg-surface-elevated); padding:10px 16px; border-bottom:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div style="display:flex; flex-direction:column; gap:4px; font-size:11.5px;">
                            <div>
                                <span style="color:var(--text-muted);">${_t('Mã vạch gốc:')}</span> <strong style="font-family:var(--font-mono); color:var(--text-main);">${escapeHtml(item.rawId)}</strong>
                                ${item.serialOnly ? ` &nbsp;·&nbsp; <span style="color:var(--text-muted);">${_t('Serial tách:')}</span> <span style="font-family:var(--font-mono); color:var(--accent-cyan); font-weight:700;">${escapeHtml(item.serialOnly)}</span>` : ''}
                            </div>
                            <div>
                                <span style="color:var(--text-muted);">${_t('Số lần quét:')}</span> <strong>${item.scanCount || 0}</strong>
                                ${timeStr ? ` &nbsp;·&nbsp; <span style="color:var(--text-muted);">${_t('Thời gian:')}</span> <span style="font-family:var(--font-mono);">${escapeHtml(timeStr)}</span>` : ''}
                            </div>
                            ${rec ? `
                                <div style="display:flex; align-items:center; gap:8px; margin-top:2px; font-family:var(--font-mono); font-size:11px;">
                                    <span style="color:var(--text-muted);">${_t('Trạm đo:')}</span> <strong>${escapeHtml(rec.stationName)}</strong>
                                    ${reVal ? `· <span>Re: <strong>${reVal}</strong></span>` : ''}
                                    ${fsVal ? `· <span>fs: <strong>${fsVal}</strong></span>` : ''}
                                    ${splVal ? `· <span>SPL: <strong>${splVal}</strong></span>` : ''}
                                </div>
                                ${errs ? `<div style="color:#f87171; font-weight:700; font-size:11px;">⚠️ ${_t('Lỗi Klippel:')} ${escapeHtml(errs)}</div>` : ''}
                            ` : ''}
                        </div>
                        <div style="display:flex; gap:6px;">
                            ${rec ? `<button class="btn btn-sm btn-outline" style="padding:4px 10px; font-size:11px;" onclick="event.stopPropagation(); inspectRecordInModal('${escapeHtml(rec.id)}')">🔍 ${_t('Xem Chi Tiết Klippel')}</button>` : ''}
                            <button class="btn btn-sm ${isDone ? 'btn-secondary' : 'btn-primary'}" style="padding:4px 10px; font-size:11px;" onclick="event.stopPropagation(); toggleManualAuditItemScan('${escapeHtml(item.groupId)}', ${item.index})">
                                ${isDone ? _t('↩ Hoàn tác quét') : _t('✓ Đánh dấu đã quét')}
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function resetAuditList() {
    openAppDialog({
        title: _t('🗑️ Xóa Toàn Bộ Các Group Đối Soát'),
        message: _t('Bạn có chắc muốn xóa toàn bộ các Group và danh sách đối soát hiện tại? (Nếu chỉ muốn đặt lại 1 Group, hãy bấm nút [🔄 Reset] trên thẻ Group đó).'),
        confirmText: _t('Xóa Tất Cả Group'),
        danger: true,
        onConfirm: () => {
            auditState.groups = [];
            auditState.activeGroupId = 'ALL';
            auditState.targetList = [];
            auditState.scannedCount = 0;
            auditState.duplicateCount = 0;
            auditState.strangerList = [];
            auditState.scanLog = [];
            try { localStorage.removeItem(LS.AUDIT); } catch(e) {}
            const textarea = document.getElementById('audit-target-input');
            if (textarea) textarea.value = '';
            renderAuditDashboard();
            showToast(_t('Đã làm mới toàn bộ danh sách đối soát'), 'info');
        }
    });
}

/**
 * Xuất Báo Cáo Đối Soát ra Excel (.xlsx) — Hỗ trợ xuất riêng 1 Group hoặc xuất Đa Sheet cho toàn bộ các Group
 */
async function exportAuditReport(targetGroupId = null) {
    if (typeof ExcelJS === 'undefined') {
        showToast(_t('⚠️ Thư viện ExcelJS chưa sẵn sàng'), 'warning');
        return;
    }
    if (!auditState.targetList || auditState.targetList.length === 0) {
        showToast(_t('⚠️ Không có dữ liệu đối soát để xuất'), 'warning');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QIT Scanner v2 Pro';

    const groupsToExport = targetGroupId
        ? auditState.groups.filter(g => g.id === targetGroupId)
        : auditState.groups;

    // Sheet 1: Tổng hợp tất cả Group
    const wsSummary = workbook.addWorksheet('Audit Summary');
    wsSummary.addRow([_t('QIT SCANNER V2 PRO — BÁO CÁO ĐỐI SOÁT DANH SÁCH MÃ VẠCH THEO GROUP')]);
    wsSummary.addRow([_t('Thời gian xuất:'), new Date().toLocaleString()]);
    wsSummary.addRow([_t('Tổng số Group:'), groupsToExport.length]);
    wsSummary.addRow([_t('Tổng số mã mục tiêu:'), auditState.targetList.length]);
    wsSummary.addRow([_t('Đã quét khớp:'), auditState.scannedCount]);
    wsSummary.addRow([_t('Còn thiếu:'), Math.max(0, auditState.targetList.length - auditState.scannedCount)]);
    wsSummary.addRow([_t('Mã lạ ngoài danh sách:'), auditState.strangerList ? auditState.strangerList.length : 0]);
    wsSummary.addRow([]);
    wsSummary.addRow([_t('STT Group'), _t('Tên Group / Kiện Hàng'), _t('Ghi Chú'), _t('Tổng Số Mã'), _t('Đã Quét'), _t('Còn Thiếu'), _t('Tiến Độ (%)'), _t('Trạng Thái Khóa')]);

    groupsToExport.forEach((g, idx) => {
        const gTot = g.targetList.length;
        const gSc = g.scannedCount || 0;
        const gPct = gTot > 0 ? ((gSc / gTot) * 100).toFixed(1) + '%' : '0%';
        wsSummary.addRow([idx + 1, g.name, g.note || '', gTot, gSc, Math.max(0, gTot - gSc), gPct, g.locked ? _t('ĐÃ KHÓA') : _t('ĐANG MỞ')]);
    });

    wsSummary.addRow([]);
    wsSummary.addRow([_t('STT'), _t('Group / Kiện Hàng'), _t('Mã Mục Tiêu (Target ID)'), 'Model', _t('Serial Tách'), _t('Trạng Thái Đối Soát'), _t('Số Lần Quét'), _t('Lần Quét Đầu'), _t('Lần Quét Cuối'), 'Klippel QC', _t('Trạm Đo'), _t('Lỗi Klippel')]);

    const itemsPool = targetGroupId && groupsToExport[0] ? groupsToExport[0].targetList : auditState.targetList;
    itemsPool.forEach((item, idx) => {
        let klStatus = '—', stName = '—', klErrs = '';
        if (loadedFilesMap.size > 0) {
            const m = findRecordByBarcode(item.rawId);
            if (m && m.record) {
                klStatus = isRecordPass(m.record) ? 'PASS' : 'FAIL';
                stName = m.record.stationName || '—';
                klErrs = activeErrors(m.record.errors).map(getMappedName).join('; ');
            } else {
                klStatus = _t('Chưa đo');
            }
        }
        wsSummary.addRow([
            idx + 1,
            item.groupName || 'Group #1',
            item.rawId,
            item.modelHint || '',
            item.serialOnly || item.cleanId,
            item.scanCount > 0 ? _t('ĐÃ QUÉT') : _t('CHƯA QUÉT'),
            item.scanCount || 0,
            item.firstScanTime || '',
            item.lastScanTime || '',
            klStatus,
            stName,
            klErrs
        ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QIT_MultiGroup_Audit_Report_${toLocalDateStr(new Date())}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast(_t('✅ Đã xuất báo cáo Excel Đối Soát Đa Group thành công!'), 'success');
}

/**
 * Xuất Báo Cáo Đối Soát Đa Group ra tệp HTML độc lập tương tác
 */
function exportAuditHTML() {
    if (!auditState.targetList || auditState.targetList.length === 0) {
        showToast(_t('⚠️ Không có dữ liệu đối soát để xuất.'), 'warning');
        return;
    }

    const total = auditState.targetList.length;
    const scanned = auditState.scannedCount;
    const missing = Math.max(0, total - scanned);
    const pct = total > 0 ? ((scanned / total) * 100).toFixed(1) : '0.0';
    const groupsMeta = auditState.groups.map(g => ({
        id: g.id,
        name: g.name,
        total: g.targetList.length,
        scanned: g.scannedCount || 0
    }));

    const itemsJson = JSON.stringify(auditState.targetList.map(item => {
        let kl = '—', st = '—';
        if (loadedFilesMap.size > 0) {
            const m = findRecordByBarcode(item.rawId);
            if (m && m.record) {
                kl = isRecordPass(m.record) ? 'PASS' : 'FAIL';
                st = m.record.stationName || '—';
            } else {
                kl = _t('Chưa đo');
            }
        }
        return {
            index: item.index,
            groupId: item.groupId,
            groupName: item.groupName || 'Group #1',
            rawId: item.rawId,
            scanned: (item.scanCount || 0) > 0,
            scanCount: item.scanCount || 0,
            firstScanTime: item.firstScanTime || '—',
            lastScanTime: item.lastScanTime || '—',
            klippelQC: kl,
            station: st
        };
    }));

    const groupOptsHtml = groupsMeta.map(g => `<option value="${escapeHtml(g.id)}">📦 ${escapeHtml(g.name)} (${g.scanned}/${g.total})</option>`).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="vi" data-theme="dark">
<head>
<meta charset="utf-8">
<title>${_t('QIT Scanner v2 Pro - Báo Cáo Đối Soát Danh Sách Đa Group')}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #090d16; --bg-card: rgba(17, 24, 39, 0.9); --bg-elevated: #1e293b;
    --border: rgba(148, 163, 184, 0.16); --txt: #f1f5f9; --txt-sub: #94a3b8;
    --cyan: #00f2fe; --blue: #38bdf8; --pass: #10b981; --pass-bg: rgba(16, 185, 129, 0.16);
    --fail: #ef4444; --fail-bg: rgba(239, 68, 68, 0.16); --warn: #f59e0b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: var(--bg); color: var(--txt); padding: 24px; }
  .container { max-width: 1320px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .kpi-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; text-align: center; }
  .kpi-label { font-size: 10.5px; font-weight: 800; color: var(--txt-sub); text-transform: uppercase; }
  .kpi-val { font-size: 22px; font-weight: 900; margin-top: 4px; font-family: monospace; }
  .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); }
  select, input { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--txt); padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; outline: none; }
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; white-space: nowrap; }
  th { background: var(--bg-elevated); color: var(--txt-sub); font-weight: 800; padding: 10px 14px; border-bottom: 1px solid var(--border); }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  .badge { display: inline-block; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 800; }
  .badge-pass { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass); }
  .badge-fail { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1 style="font-size:19px; font-weight:900; color:var(--cyan);">${_t('🎯 BÁO CÁO ĐỐI SOÁT DANH SÁCH MÃ VẠCH ĐA GROUP')}</h1>
      <p style="font-size:11px; color:var(--txt-sub); font-family:monospace; margin-top:3px;">QIT SCANNER V2 PRO · MULTI-GROUP AUDIT RECONCILIATION</p>
    </div>
    <div style="font-size:11.5px; color:var(--txt-sub); font-family:monospace;">${_t('Thời gian xuất:')} <strong>${new Date().toLocaleString()}</strong></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">${_t('TỔNG SỐ GROUP')}</div><div class="kpi-val" style="color:var(--blue);">${groupsMeta.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('TỔNG MÃ MỤC TIÊU')}</div><div class="kpi-val">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('ĐÃ QUÉT ĐỐI SOÁT')}</div><div class="kpi-val" style="color:var(--pass);">${scanned}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('CÒN THIẾU')}</div><div class="kpi-val" style="color:var(--fail);">${missing}</div></div>
    <div class="kpi-card"><div class="kpi-label">${_t('TIẾN ĐỘ HOÀN THÀNH')}</div><div class="kpi-val" style="color:var(--cyan);">${pct}%</div></div>
  </div>
  <div class="controls">
    <select id="groupSelect" onchange="applyFilters()">
      <option value="ALL">${_t('🌐 Tất cả các Group ({0})', groupsMeta.length)}</option>
      ${groupOptsHtml}
    </select>
    <select id="auditRptFilterSelect" onchange="applyFilters()">
      <option value="ALL">${_t('Tất cả trạng thái ({0})', total)}</option>
      <option value="SCANNED">${_t('Chỉ mã ĐÃ QUÉT ({0})', scanned)}</option>
      <option value="MISSING">${_t('Chỉ mã CÒN THIẾU ({0})', missing)}</option>
    </select>
    <input type="text" id="auditRptSearchInput" placeholder="${_t('🔍 Tìm kiếm mã mục tiêu...')}" oninput="applyFilters()" style="min-width:240px;">
    <span id="auditRptMatchCount" style="font-size:12px; color:var(--txt-sub); margin-left:auto; font-weight:700;"></span>
  </div>
  <div class="card">
    <div style="overflow-x:auto; max-height:68vh;">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align:left;">${_t('Group / Kiện')}</th>
            <th style="text-align:left;">${_t('Mã Mục Tiêu (Target ID)')}</th>
            <th>${_t('Trạng Thái')}</th>
            <th>${_t('Số Lần Quét')}</th>
            <th>${_t('Lần Quét Đầu')}</th>
            <th>${_t('Lần Quét Cuối')}</th>
            <th>Klippel QC</th>
            <th>${_t('Trạm Đo')}</th>
          </tr>
        </thead>
        <tbody id="auditTbody"></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  const items = ${itemsJson};
  function applyFilters() {
    const grp = document.getElementById('groupSelect').value;
    const filter = document.getElementById('auditRptFilterSelect').value;
    const q = document.getElementById('auditRptSearchInput').value.trim().toUpperCase();
    let matches = 0, html = '';
    items.forEach(item => {
      if (grp !== 'ALL' && item.groupId !== grp) return;
      if (filter === 'SCANNED' && !item.scanned) return;
      if (filter === 'MISSING' && item.scanned) return;
      if (q && !item.rawId.toUpperCase().includes(q) && !item.groupName.toUpperCase().includes(q)) return;
      matches++;
      const statusBadge = item.scanned ? ('<span class="badge badge-pass">' + '${_t('✓ ĐÃ QUÉT')}' + '</span>') : ('<span class="badge badge-fail">' + '${_t('✕ CHƯA QUÉT')}' + '</span>');
      const klBadge = item.klippelQC === 'PASS' ? '<span class="badge badge-pass">✓ PASS</span>' : (item.klippelQC === 'FAIL' ? '<span class="badge badge-fail">✕ FAIL</span>' : item.klippelQC);
      html += '<tr><td>' + item.index + '</td><td style="text-align:left;color:var(--cyan);font-weight:700;">' + item.groupName + '</td><td style="text-align:left;font-family:monospace;font-weight:700;">' + item.rawId + '</td><td>' + statusBadge + '</td><td>' + item.scanCount + '</td><td>' + item.firstScanTime + '</td><td>' + item.lastScanTime + '</td><td>' + klBadge + '</td><td>' + item.station + '</td></tr>';
    });
    document.getElementById('auditTbody').innerHTML = html || ('<tr><td colspan="9" style="padding:24px;color:var(--txt-sub);">' + '${_t('Không có mã phù hợp.')}' + '</td></tr>');
    document.getElementById('auditRptMatchCount').innerHTML = '${_t('Hiển thị')}: <strong style="color:var(--cyan);">' + matches + '</strong> ${_t('mã')}';
  }
  applyFilters();
<\/script>
</body>
</html>`;

    downloadBlobFile(htmlContent, `QIT_MultiGroup_Audit_Report_${toLocalDateStr(new Date())}.html`, 'text/html;charset=utf-8');
    showToast(_t('✅ Đã xuất Báo Cáo Đối Soát Đa Group HTML thành công!'), 'success');
}

/* ════════════ CAMERA 2D AUDIT SCANNER (DATAMATRIX / QR / BARCODE) ════════════ */

let cameraStream = null;
let cameraAnimationId = null;
let cameraTrack = null;
let cameraZoomLevel = 2.0;
let cameraTorchActive = false;
let cameraInvertActive = false;
let cameraFpsCounter = 0;
let cameraFpsLastTime = Date.now();
let lastCameraScannedCode = '';
let lastCameraScannedTime = 0;
let cameraBarcodeDetector = null;

async function toggleAuditCameraDock() {
    const dock = document.getElementById('audit-camera-dock');
    if (!dock) return;
    if (dock.classList.contains('hidden')) {
        await initAuditCamera();
    } else {
        stopAuditCamera();
    }
}

async function initAuditCamera() {
    const dock = document.getElementById('audit-camera-dock');
    const video = document.getElementById('audit-camera-video');
    if (!dock || !video) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast(_t('⚠️ Trình duyệt hoặc thiết bị của bạn không hỗ trợ camera.'), 'error');
        return;
    }

    try {
        dock.classList.remove('hidden');
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = cameraStream;
        await video.play();

        const tracks = cameraStream.getVideoTracks();
        if (tracks.length > 0) {
            cameraTrack = tracks[0];
            await setCameraZoom(cameraZoomLevel);
        }

        // Initialize BarcodeDetector if available
        if ('BarcodeDetector' in window) {
            try {
                cameraBarcodeDetector = new window.BarcodeDetector({
                    formats: ['data_matrix', 'qr_code', 'code_128', 'code_39', 'code_93', 'ean_13', 'itf']
                });
            } catch (e) {
                try {
                    cameraBarcodeDetector = new window.BarcodeDetector();
                } catch (e2) {
                    cameraBarcodeDetector = null;
                }
            }
        }

        startCameraScanLoop();
        showToast(_t('📷 Camera 2D đã sẵn sàng. Hướng khung ngắm vào mã DataMatrix / QR / Barcode.'), 'info');
    } catch (err) {
        console.error('Lỗi khởi động camera:', err);
        dock.classList.add('hidden');
        showToast(_t('❌ Không thể mở camera: {0}', err.message || err.name), 'error');
    }
}

function stopAuditCamera() {
    if (cameraAnimationId) {
        cancelAnimationFrame(cameraAnimationId);
        cameraAnimationId = null;
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
        cameraTrack = null;
    }
    const video = document.getElementById('audit-camera-video');
    if (video) video.srcObject = null;

    const dock = document.getElementById('audit-camera-dock');
    if (dock) dock.classList.add('hidden');

    focusActiveScanInput();
}

async function setCameraZoom(val) {
    cameraZoomLevel = Number(val) || 1.0;
    ['1x', '2x', '3x'].forEach(z => {
        const btn = document.getElementById(`camera-zoom-${z}`);
        if (btn) {
            const btnVal = parseFloat(z);
            if (Math.abs(btnVal - cameraZoomLevel) < 0.1) {
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-outline');
            } else {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            }
        }
    });

    if (cameraTrack && typeof cameraTrack.getCapabilities === 'function') {
        const caps = cameraTrack.getCapabilities();
        if (caps.zoom) {
            const targetZoom = Math.max(caps.zoom.min || 1, Math.min(caps.zoom.max || 1, cameraZoomLevel));
            try {
                await cameraTrack.applyConstraints({
                    advanced: [{ zoom: targetZoom }]
                });
            } catch (e) {
                console.warn('Hardware zoom not accepted:', e);
            }
        }
    }
}

async function toggleCameraTorch() {
    if (!cameraTrack) return;
    cameraTorchActive = !cameraTorchActive;
    const btn = document.getElementById('camera-torch-btn');
    if (cameraTrack.getCapabilities) {
        const caps = cameraTrack.getCapabilities();
        if (caps.torch) {
            try {
                await cameraTrack.applyConstraints({
                    advanced: [{ torch: cameraTorchActive }]
                });
                if (btn) btn.classList.toggle('btn-primary', cameraTorchActive);
                return;
            } catch (e) {
                console.warn('Torch constraint failed:', e);
            }
        }
    }
    showToast(_t('⚠️ Thiết bị không hỗ trợ đèn trợ sáng Flash.'), 'warning');
}

function toggleCameraInvert() {
    cameraInvertActive = !cameraInvertActive;
    const btn = document.getElementById('camera-invert-btn');
    const video = document.getElementById('audit-camera-video');
    if (btn) btn.classList.toggle('btn-primary', cameraInvertActive);
    if (video) {
        video.style.filter = cameraInvertActive ? 'invert(1) contrast(1.4)' : 'none';
    }
    showToast(cameraInvertActive ? _t('◐ Đã bật chế độ đảo màu (Đọc tem laser đen)') : _t('◑ Đã tắt chế độ đảo màu'), 'info');
}

function startCameraScanLoop() {
    const video = document.getElementById('audit-camera-video');
    const canvas = document.getElementById('audit-camera-canvas');
    const fpsBadge = document.getElementById('camera-fps-badge');
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    async function scanFrame() {
        if (!cameraStream || video.readyState < 2) {
            cameraAnimationId = requestAnimationFrame(scanFrame);
            return;
        }

        // FPS counter calculation
        cameraFpsCounter++;
        const now = Date.now();
        if (now - cameraFpsLastTime >= 1000) {
            if (fpsBadge) fpsBadge.textContent = `${cameraFpsCounter} FPS`;
            cameraFpsCounter = 0;
            cameraFpsLastTime = now;
        }

        // Detect barcodes
        try {
            if (cameraBarcodeDetector) {
                let detected = [];
                if (cameraInvertActive) {
                    canvas.width = 320;
                    canvas.height = 320;
                    const cropSize = Math.min(video.videoWidth, video.videoHeight) * 0.7;
                    const sx = (video.videoWidth - cropSize) / 2;
                    const sy = (video.videoHeight - cropSize) / 2;
                    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 320, 320);

                    // Software pixel invert (iOS safe without ctx.filter)
                    const imgData = ctx.getImageData(0, 0, 320, 320);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        d[i] = 255 - d[i];
                        d[i + 1] = 255 - d[i + 1];
                        d[i + 2] = 255 - d[i + 2];
                    }
                    ctx.putImageData(imgData, 0, 0);
                    detected = await cameraBarcodeDetector.detect(canvas);
                } else {
                    detected = await cameraBarcodeDetector.detect(video);
                }

                if (detected && detected.length > 0) {
                    const rawValue = detected[0].rawValue;
                    if (rawValue) {
                        onCameraBarcodeDetected(rawValue);
                    }
                }
            }
        } catch (scanErr) {
            // Frame detection error, continue next frame
        }

        cameraAnimationId = requestAnimationFrame(scanFrame);
    }

    cameraAnimationId = requestAnimationFrame(scanFrame);
}

function onCameraBarcodeDetected(rawCode) {
    if (!rawCode) return;
    const cleanCode = String(rawCode).trim();
    if (!cleanCode) return;

    const now = Date.now();
    // 1800ms cooldown for identical codes, 0ms for new codes
    if (cleanCode === lastCameraScannedCode && (now - lastCameraScannedTime) < 1800) {
        return;
    }

    lastCameraScannedCode = cleanCode;
    lastCameraScannedTime = now;

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([40]); } catch (e) {}
    }

    handleAuditScan(cleanCode);
}
