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
    let currentGroup = (defaultGroupName || '').trim() || 'Group #01 · Danh Sách Chính';

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
        showToast('⚠️ Vui lòng dán danh sách mã cần kiểm tra vào ô nhập liệu.', 'warning');
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
    showToast(`✅ Đã nạp ${addedItemsCount} mã mục tiêu vào ${specs.length} Group kiểm soát!`, 'success');
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
        showToast(`⏳ Đang nạp tệp danh sách: ${fileName}...`, 'info');
        let structuredLines = [];

        if (ext === '.xlsx' || ext === '.xls') {
            if (typeof ExcelJS === 'undefined') {
                showToast('⚠️ Thư viện ExcelJS chưa tải xong. Vui lòng thử lại sau giây lát.', 'warning');
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
            showToast('⚠️ Không tìm thấy mã hợp lệ trong tệp đã chọn.', 'warning');
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
        showToast(`❌ Lỗi khi đọc tệp: ${err.message}`, 'error');
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
        showToast('⚠️ Chưa có danh sách mục tiêu để tách Group. Hãy nạp danh sách hoặc bấm [Nạp Mẫu 4 Group].', 'warning');
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
            const gName = `Thùng #${String(b + 1).padStart(2, '0')} (${startNum}–${endNum})`;
            newGroups.push(createAuditGroupObject(gName, null, `Quy cách ${batchSize} PCS/thùng`, slice));
        }

        auditState.groups = newGroups;
        auditState.activeGroupId = 'ALL';
        syncAuditFlatState();
        renderAuditDashboard();
        showToast(`📦 Đã chia tách ${allItems.length} mã thành ${newGroups.length} Thùng/Group (${batchSize} PCS/Group)!`, 'success');
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
                else if (item.rawId.includes('-')) groupKey = 'Lô ' + item.rawId.split('-').slice(0, 2).join('-');
                else groupKey = 'Prefix ' + item.rawId.slice(0, 6).toUpperCase();
            }
            if (!map.has(groupKey)) map.set(groupKey, []);
            map.get(groupKey).push(item);
        });

        const newGroups = [];
        map.forEach((list, key) => {
            newGroups.push(createAuditGroupObject(key, null, `${list.length} sản phẩm`, list));
        });

        auditState.groups = newGroups;
        auditState.activeGroupId = 'ALL';
        syncAuditFlatState();
        renderAuditDashboard();
        showToast(`🏷️ Đã tự động phân loại thành ${newGroups.length} Group theo Model / Tiền tố!`, 'success');
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
        if (passList.length > 0) newGroups.push(createAuditGroupObject('✓ Group Đạt Chuẩn Klippel (PASS)', null, 'Đủ điều kiện đóng gói xuất kho', passList));
        if (failList.length > 0) newGroups.push(createAuditGroupObject('✕ Group Hàng Lỗi Klippel (FAIL/NG)', null, 'Cần cách ly / Không được xuất kho', failList));
        if (noLogList.length > 0) newGroups.push(createAuditGroupObject('❓ Group Chưa Có Log Đo', null, 'Cần kiểm tra lại trên trạm Klippel', noLogList));

        auditState.groups = newGroups;
        auditState.activeGroupId = 'ALL';
        syncAuditFlatState();
        renderAuditDashboard();
        showToast(`🔬 Đã tách thành ${newGroups.length} Group theo phán định chất lượng Klippel QC!`, 'success');
    }
}

/**
 * Nạp bộ dữ liệu mẫu 4 Group Kiểm Tra Danh Sách (liên kết trực tiếp với dữ liệu Klippel Log)
 */
function loadDemoMultiGroupAudit(silent = false) {
    const demoText = [
        '# Kiện #01 · Pallet A (Chuyền SAS208-01)',
        'P2001315-10-B_SIEV261531B1001',
        'P2001315-10-B_SIEV261531B1002',
        'P2001315-10-B_SIEV261531B1003',
        'P2001315-10-B_SIEV261531B1004',
        'P2001315-10-B_SIEV261531B1005',
        'P2001315-10-B_SIEV261531B1006',
        '# Kiện #02 · Pallet B (Chuyền SAS208-02)',
        'P2001315-10-B_SIEV261531B1007',
        'P2001315-10-B_SIEV261531B1008',
        'P2001315-10-B_SIEV261531B1009',
        'P2001315-10-B_SIEV261531B1010',
        'P2001315-10-B_SIEV261531B1011',
        'P2001315-10-B_SIEV261531B1012',
        '# Kiện #03 · Lô Loa Woofer (Chuyền SFS203-01)',
        '655983-WOOFER_WFR261016C2001',
        '655983-WOOFER_WFR261016C2002',
        '655983-WOOFER_WFR261016C2003',
        '655983-WOOFER_WFR261016C2004',
        '655983-WOOFER_WFR261016C2005'
    ].join('\n');

    const textarea = document.getElementById('audit-target-input');
    if (textarea) textarea.value = demoText;

    const specs = parseRawTextIntoGroupSpecs(demoText, 'Kiện #01');
    auditState.groups = specs.map((sp, i) => createAuditGroupObject(sp.name, sp.items, `Lô xuất kho #0${i + 1}`));
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
        showToast('🎯 Đã khởi tạo 3 Group Kiểm Soát Kiện Hàng Mẫu!', 'success');
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
            ? '🎯 Đã bật [Khóa Phạm Vi Group]: Chỉ cho phép quét mã thuộc Group đang chọn (Chống đóng nhầm thùng)!'
            : '🌐 Đã bật [Quét Tự Động Toàn Cục]: Tự động nhận diện và phân bổ mã quét vào đúng Group!',
        'info'
    );
    focusActiveScanInput();
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
    showToast(grp.locked ? `🔒 Đã khóa bảo vệ [${grp.name}]` : `🔓 Đã mở khóa [${grp.name}]`, 'info');
}

/**
 * Đổi tên & ghi chú của một Group
 */
function renameAuditGroup(groupId, evt) {
    if (evt) evt.stopPropagation();
    const grp = auditState.groups.find(g => g.id === groupId);
    if (!grp) return;

    openAppDialog({
        title: '✏️ Đổi Tên Group Kiểm Soát',
        message: `Nhập tên mới cho Group <strong>${escapeHtml(grp.name)}</strong> (${grp.targetList.length} mã):`,
        showInput: true,
        inputPlaceholder: 'VD: Thùng #01 - Pallet A',
        inputDefault: grp.name,
        confirmText: 'Lưu Tên Mới',
        onConfirm: (newName) => {
            if (newName && String(newName).trim()) {
                grp.name = String(newName).trim();
                syncAuditFlatState();
                renderAuditDashboard();
                showToast(`✓ Đã đổi tên Group thành: ${grp.name}`, 'success');
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
        title: '🔄 Đặt Lại Tiến Độ Riêng Group Này',
        message: `Bạn có chắc muốn đặt lại số lần quét của riêng <strong>${escapeHtml(grp.name)}</strong> về 0? Các Group khác vẫn giữ nguyên 100% dữ liệu.`,
        confirmText: 'Đặt Lại Group Này',
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
            showToast(`✓ Đã đặt lại tiến độ của [${grp.name}]`, 'info');
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
        title: '🗑️ Xóa Group Kiểm Soát',
        message: `Xóa <strong>${escapeHtml(grp.name)}</strong> (${grp.targetList.length} mã) khỏi danh sách đối soát?`,
        confirmText: 'Xóa Group',
        danger: true,
        onConfirm: () => {
            auditState.groups.splice(idx, 1);
            if (auditState.activeGroupId === groupId) {
                auditState.activeGroupId = 'ALL';
            }
            syncAuditFlatState();
            renderAuditDashboard();
            showToast(`🗑️ Đã xóa [${grp.name}]`, 'info');
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
        showToast('⚠️ Chưa có danh sách mục tiêu. Vui lòng nạp danh sách trước.', 'warning');
        return;
    }

    // Nếu người dùng truyền trực tiếp auditState.targetList mà chưa có auditState.groups (tương thích ngược)
    if (!auditState.groups || auditState.groups.length === 0) {
        const fallbackGrp = createAuditGroupObject('Group #01 · Mặc Định', null, '', auditState.targetList);
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
        groupName: activeGrp ? activeGrp.name : 'Toàn bộ',
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
            renderAuditDashboard();
            showToast(`🔒 TỪ CHỐI: [${owningGroup.name}] đã khóa hoàn tất, không nhận thêm mã quét!`, 'error');
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
            showToast(`🚨 CẢNH BÁO NG: Mã [${item.rawId}] khớp tại [${logEntry.groupName}] nhưng bị LỖI (FAIL) trong Klippel QC!`, 'error');
        } else if (isFirstScan) {
            playScanSound('PASS');
            // Kiểm tra nếu Group vừa hoàn thành 100%
            if (owningGroup && owningGroup.scannedCount === owningGroup.targetList.length) {
                if (typeof triggerConfetti === 'function') triggerConfetti();
                showToast(`🎉 HOÀN TẤT 100% [${owningGroup.name}] (${owningGroup.scannedCount}/${owningGroup.targetList.length} mã)!`, 'success');
            } else {
                showToast(`✓ Khớp [${logEntry.groupName}]: ${item.rawId} (#${item.index})`, 'success');
            }
        } else {
            playScanSound('DUPLICATE');
            logEntry.result = 'DUPLICATE';
            showToast(`⚠️ Quét lặp lần ${item.scanCount} tại [${logEntry.groupName}]: ${item.rawId}`, 'warning');
        }
    } else if (matchRes.result === 'AMBIGUOUS') {
        playScanSound('NOT_FOUND');
        showToast(`⚠️ Nhập nhằng (${matchRes.candidates.length} mã trùng độ khớp)`, 'warning');
    } else {
        // Nếu đang khóa trong Group hiện tại (ACTIVE), kiểm tra xem mã này có nằm ở Group KHÁC không!
        if (isStrictActiveScope) {
            const globalCheck = matchScanToTargets(rawBarcode, auditState.targetList, CFG.SCAN_MATCH_MODE || 'flex');
            if (globalCheck.result === 'MATCH' && globalCheck.best) {
                const otherItem = globalCheck.best;
                const otherGroup = auditState.groups.find(g => g.id === otherItem.groupId);
                playScanSound('FAIL');
                logEntry.result = 'WRONG_GROUP';
                logEntry.groupName = otherGroup ? otherGroup.name : 'Group khác';
                logEntry.targetItem = otherItem;
                auditState.scanLog.unshift(logEntry);
                saveAuditStateToStorage();
                renderAuditDashboard();
                showToast(`🚨 NHẦM KIỆN HÀNG: Mã [${otherItem.rawId}] thuộc [${logEntry.groupName}], KHÔNG thuộc [${activeGrp.name}]!`, 'error');
                return;
            }
        }

        playScanSound('NOT_FOUND');
        auditState.strangerList.unshift({
            time: nowStr,
            rawScan: rawBarcode,
            cleanScan: getAlphaNum(rawBarcode),
            activeGroupName: activeGrp ? activeGrp.name : 'Toàn bộ'
        });
        showToast(`✕ MÃ LẠ: [${rawBarcode}] không có trong danh sách mục tiêu!`, 'error');
    }

    auditState.scanLog.unshift(logEntry);
    if (auditState.scanLog.length > 200) auditState.scanLog.pop();

    saveAuditStateToStorage();
    renderAuditDashboard();
}

/**
 * Đánh dấu thủ công / Bỏ đánh dấu 1 mục tiêu trong bảng (dành cho kiểm tra viên có quyền điều chỉnh)
 */
function toggleManualAuditItemScan(groupId, itemIndex) {
    const grp = auditState.groups.find(g => g.id === groupId);
    if (!grp) return;
    if (grp.locked) {
        showToast(`🔒 [${grp.name}] đang khóa. Hãy mở khóa trước khi chỉnh sửa.`, 'warning');
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
        showToast('🎉 Đã quét đủ 100%, không còn mã nào bị thiếu!', 'success');
        return;
    }
    copyTextSafe(missing.join('\n'), `📋 Đã sao chép ${missing.length} mã còn thiếu vào Clipboard!`);
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
        auditState.groups = [createAuditGroupObject('Group #01 · Danh Sách Chính', null, '', auditState.targetList)];
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
            scopeLabelEl.innerHTML = `📦 ĐANG KIỂM SOÁT GROUP: <strong style="color:var(--accent-cyan);">${escapeHtml(activeGrp.name)}</strong> (${scanned}/${total} mã · ${activeGrp.locked ? '🔒 Đã Khóa' : '🔓 Đang Mở'})`;
        } else {
            scopeLabelEl.innerHTML = `🌐 TỔNG HỢP TOÀN BỘ <strong>${auditState.groups.length} GROUP</strong> (${auditState.scannedCount}/${auditState.targetList.length} mã đã đối soát)`;
        }
    }

    // Render danh sách thẻ Group (Group Control Cards)
    renderAuditGroupsPanel();

    // Render Chip Lịch Sử Quét Trực Tiếp (Live Scan Chips)
    const chipsContainer = document.getElementById('audit-chips-container');
    if (chipsContainer) {
        if (auditState.scanLog.length === 0) {
            chipsContainer.innerHTML = `<span style="font-size:11.5px; color:var(--text-muted); padding:6px 0;">(Chưa có lượt quét nào — Kết quả quét từng mã &amp; Group tương ứng sẽ hiển thị tức thì tại đây)</span>`;
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
                        icon = `⚠️ Lặp ×${log.targetItem ? log.targetItem.scanCount : 2}:`;
                    }
                } else if (log.result === 'WRONG_GROUP') {
                    badgeStyle = 'background:rgba(239,68,68,0.22); border:1px solid rgba(239,68,68,0.6); color:#fca5a5;';
                    icon = `🚨 Sai Group (Thuộc ${log.groupName}):`;
                    subTag = '';
                } else if (log.result === 'GROUP_LOCKED') {
                    badgeStyle = 'background:rgba(245,158,11,0.2); border:1px solid rgba(245,158,11,0.5); color:#fbbf24;';
                    icon = `🔒 Đã khóa:`;
                } else if (log.result === 'AMBIGUOUS') {
                    badgeStyle = 'background:rgba(245,158,11,0.16); border:1px solid rgba(245,158,11,0.4); color:#fbbf24;';
                    icon = '⚠️ Nhập nhằng:';
                } else {
                    badgeStyle = 'background:rgba(239,68,68,0.16); border:1px solid rgba(239,68,68,0.4); color:#f87171;';
                    icon = '✕ Mã lạ:';
                    subTag = '';
                }
                return `<span class="badge-pill" style="${badgeStyle} font-size:11px; padding:4px 9px; font-family:var(--font-mono);" title="Quét lúc ${log.time}">
                    ${icon} <strong>${escapeHtml(label)}</strong> ${subTag ? `<span style="color:var(--accent-cyan);">${escapeHtml(subTag)}</span>` : ''} <span style="font-size:9.5px; opacity:0.75;">(${log.time})</span>
                </span>`;
            }).join('');
        }
    }

    // Badge thông báo trạng thái liên kết Klippel Log
    const badgeEl = document.getElementById('audit-log-reference-badge');
    if (badgeEl) {
        if (loadedFilesMap.size > 0) {
            badgeEl.innerHTML = `<span class="badge-pill badge-pass" style="font-size:11px;">🔗 Đang liên kết Chốt Chặn Chất Lượng với ${loadedFilesMap.size} tệp Klippel Log (${dictLookupClean.size.toLocaleString()} DUT)</span>`;
        } else {
            badgeEl.innerHTML = `<span class="meta-chip">ℹ️ Chế độ Kiểm Tra Danh Sách Độc Lập (Zero-Log Mode)</span>`;
        }
    }

    renderAuditTable();
}

/**
 * Render Bảng Điều Khiển Các Group Độc Lập (Multi-Group Control Deck)
 */
function renderAuditGroupsPanel() {
    const container = document.getElementById('audit-groups-deck');
    if (!container) return;

    const groups = auditState.groups || [];
    if (groups.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:18px; color:var(--text-muted); border:1px dashed var(--border-color); border-radius:12px;">
                Chưa có Group kiểm soát nào. Hãy dán danh sách mã bên dưới hoặc bấm <strong>[🧪 Nạp Mẫu 3 Group Kiện Hàng]</strong> để bắt đầu.
            </div>
        `;
        return;
    }

    const totalAll = auditState.targetList.length;
    const scannedAll = auditState.scannedCount;
    const pctAll = totalAll > 0 ? ((scannedAll / totalAll) * 100).toFixed(1) : '0.0';
    const isAllActive = auditState.activeGroupId === 'ALL';

    let html = `
        <div class="audit-groups-grid">
            <!-- Thẻ Tổng Hợp Tất Cả Các Group -->
            <div class="audit-group-card ${isAllActive ? 'active-group-card' : ''}" onclick="selectAuditGroup('ALL')">
                <div class="agc-header">
                    <div>
                        <div class="agc-title">🌐 TẤT CẢ CÁC GROUP (${groups.length})</div>
                        <div class="agc-sub">Xem tổng hợp toàn bộ lô đối soát</div>
                    </div>
                    <span class="agc-pct" style="color:var(--accent-cyan);">${pctAll}%</span>
                </div>
                <div class="agc-progress-track">
                    <div class="agc-progress-fill" style="width:${pctAll}%;"></div>
                </div>
                <div class="agc-stats-row">
                    <span>Tổng: <strong>${totalAll}</strong></span>
                    <span style="color:#10b981;">Đã quét: <strong>${scannedAll}</strong></span>
                    <span style="color:#f87171;">Thiếu: <strong>${Math.max(0, totalAll - scannedAll)}</strong></span>
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
            <div class="audit-group-card ${isSelected ? 'active-group-card' : ''} ${isDone ? 'done-group-card' : ''} ${g.locked ? 'locked-group-card' : ''}" onclick="selectAuditGroup('${escapeHtml(g.id)}')">
                <div class="agc-header">
                    <div style="min-width:0; flex:1;">
                        <div class="agc-title" title="${escapeHtml(g.name)}">
                            ${g.locked ? '🔒' : (isDone ? '✅' : '📦')} ${escapeHtml(g.name)}
                        </div>
                        <div class="agc-sub">${escapeHtml(g.note || `Group #${idx + 1} · Tạo lúc ${g.createdAt}`)}</div>
                    </div>
                    <span class="agc-pct" style="color:${isDone ? '#10b981' : 'var(--accent-blue)'};">${gPct.toFixed(0)}%</span>
                </div>
                <div class="agc-progress-track">
                    <div class="agc-progress-fill ${isDone ? 'fill-done' : ''}" style="width:${gPct.toFixed(1)}%;"></div>
                </div>
                <div class="agc-stats-row">
                    <span>Mục tiêu: <strong>${gTotal}</strong></span>
                    <span style="color:#10b981;">Đạt: <strong>${gScanned}</strong></span>
                    <span style="color:${gRem > 0 ? '#f87171' : 'var(--text-muted)'};">Thiếu: <strong>${gRem}</strong></span>
                    ${qcNgCount > 0 ? `<span style="color:#ef4444; font-weight:800;" title="Có ${qcNgCount} sản phẩm trong Group này bị FAIL trong Klippel Log">🚨 ${qcNgCount} NG</span>` : ''}
                </div>
                <div class="agc-actions" onclick="event.stopPropagation();">
                    <button class="agc-btn" onclick="toggleLockAuditGroup('${escapeHtml(g.id)}', event)" title="${g.locked ? 'Mở khóa Group này' : 'Khóa bảo vệ Group này'}">
                        ${g.locked ? '🔓 Mở' : '🔒 Khóa'}
                    </button>
                    <button class="agc-btn" onclick="renameAuditGroup('${escapeHtml(g.id)}', event)" title="Đổi tên Group">✏️ Tên</button>
                    <button class="agc-btn" onclick="exportAuditReport('${escapeHtml(g.id)}')" title="Xuất Excel riêng Group này">📥 Excel</button>
                    <button class="agc-btn" onclick="resetSingleAuditGroup('${escapeHtml(g.id)}', event)" title="Đặt lại riêng tiến độ của Group này">🔄 Reset</button>
                    <button class="agc-btn agc-btn-danger" onclick="deleteSingleAuditGroup('${escapeHtml(g.id)}', event)" title="Xóa Group này">✕</button>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * Render Bảng Chi Tiết Từng Mã Mục Tiêu (9 Cột đầy đủ thông tin đối soát & thông số Klippel QC)
 */
function renderAuditTable() {
    const tbody = document.getElementById('audit-table-tbody');
    const countBadge = document.getElementById('audit-filtered-count-label');
    if (!tbody) return;

    const viewItems = getActiveAuditViewItems();
    if (viewItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:28px;">Chưa nạp danh sách mục tiêu. Hãy dán danh sách mã vạch, nạp tệp Excel/CSV hoặc bấm <strong>[🧪 Nạp Mẫu 3 Group Kiện Hàng]</strong>.</td></tr>`;
        if (countBadge) countBadge.textContent = '0 mã';
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
        countBadge.textContent = `Hiển thị ${filtered.length} / ${viewItems.length} mã`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:24px;">Không có mã mục tiêu nào khớp với bộ lọc hiện tại.</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(item => {
        const isDone = (item.scanCount || 0) > 0;
        const isDup = (item.scanCount || 0) > 1;
        const statusBadge = isDone
            ? `<span class="badge-pill badge-pass">✓ ĐÃ QUÉT ${isDup ? `(×${item.scanCount})` : ''}</span>`
            : `<span class="badge-pill badge-notfound">⏳ CHƯA QUÉT</span>`;

        let klippelCol = `<td style="text-align:center; color:var(--text-muted); font-size:11px;">—</td>`;
        let metricsCol = `<td style="font-size:11px; color:var(--text-muted);">—</td>`;

        if (loadedFilesMap.size > 0) {
            const matchRec = findRecordByBarcode(item.rawId);
            if (matchRec && matchRec.record) {
                const rec = matchRec.record;
                const isPass = isRecordPass(rec);
                klippelCol = `
                    <td style="text-align:center;">
                        <span class="badge-pill ${isPass ? 'badge-pass' : 'badge-fail'}" style="font-size:10.5px; font-weight:700; cursor:pointer;" onclick="inspectRecordInModal('${escapeHtml(rec.id)}')">
                            ${isPass ? '✓ PASS' : '✕ FAIL'} 🔍
                        </span>
                    </td>
                `;

                let reStr = '', fsStr = '', splStr = '';
                if (rec.metrics) {
                    for (let mk in rec.metrics) {
                        const low = mk.toLowerCase();
                        if (low.startsWith('re')) reStr = `Re:${rec.metrics[mk].value.toFixed(2)}Ω`;
                        else if (low.startsWith('fs')) fsStr = `fs:${rec.metrics[mk].value.toFixed(1)}Hz`;
                        else if (low.includes('level') || low.includes('spl')) splStr = `SPL:${rec.metrics[mk].value.toFixed(1)}dB`;
                    }
                }
                const errs = !isPass ? activeErrors(rec.errors).map(getMappedName).join(', ') : '';
                metricsCol = `
                    <td style="font-family:var(--font-mono); font-size:11px;">
                        <span style="color:var(--accent-blue); font-weight:700;">${escapeHtml(rec.stationName)}</span>
                        ${reStr || fsStr || splStr ? ` · <span>${[reStr, fsStr, splStr].filter(Boolean).join(' · ')}</span>` : ''}
                        ${errs ? `<div style="color:#f87171; font-size:10px; font-weight:700;">⚠️ Lỗi: ${escapeHtml(errs)}</div>` : ''}
                    </td>
                `;
            } else {
                klippelCol = `<td style="text-align:center;"><span class="badge-pill badge-warn" style="font-size:10px;">❓ Chưa đo</span></td>`;
                metricsCol = `<td style="font-size:11px; color:var(--text-muted);">Chưa có bản ghi trong Log</td>`;
            }
        }

        html += `
            <tr class="${isDone ? 'row-scanned' : ''}">
                <td style="text-align:center; color:var(--text-muted); font-weight:700; font-family:var(--font-mono);">#${item.index}</td>
                <td>
                    <span class="meta-chip meta-chip-cyan" style="cursor:pointer;" onclick="selectAuditGroup('${escapeHtml(item.groupId)}')">
                        📦 ${escapeHtml(item.groupName || 'Group #1')}
                    </span>
                </td>
                <td style="font-weight:700; font-family:var(--font-mono); color:var(--text-main);">
                    ${escapeHtml(item.rawId)}
                </td>
                <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
                    ${item.modelHint ? `<strong style="color:var(--text-main);">${escapeHtml(item.modelHint)}</strong> · ` : ''}${escapeHtml(item.serialOnly || item.cleanId)}
                </td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center; font-family:var(--font-mono); font-weight:700;">${item.scanCount || 0}</td>
                <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
                    ${item.firstScanTime ? `${item.firstScanTime}${item.lastScanTime && item.lastScanTime !== item.firstScanTime ? ' → ' + item.lastScanTime : ''}` : '—'}
                </td>
                ${klippelCol}
                ${metricsCol}
                <td style="text-align:center;">
                    <button class="btn btn-sm ${isDone ? 'btn-secondary' : 'btn-outline'}" style="padding:3px 8px; font-size:10.5px;" onclick="toggleManualAuditItemScan('${escapeHtml(item.groupId)}', ${item.index})" title="Đánh dấu hoặc hoàn tác trạng thái quét của mã này">
                        ${isDone ? '↩ Hoàn tác' : '✓ Đánh dấu'}
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function resetAuditList() {
    openAppDialog({
        title: '🗑️ Xóa Toàn Bộ Các Group Đối Soát',
        message: 'Bạn có chắc muốn xóa toàn bộ các Group và danh sách đối soát hiện tại? (Nếu chỉ muốn đặt lại 1 Group, hãy bấm nút [🔄 Reset] trên thẻ Group đó).',
        confirmText: 'Xóa Tất Cả Group',
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
            showToast('Đã làm mới toàn bộ danh sách đối soát', 'info');
        }
    });
}

/**
 * Xuất Báo Cáo Đối Soát ra Excel (.xlsx) — Hỗ trợ xuất riêng 1 Group hoặc xuất Đa Sheet cho toàn bộ các Group
 */
async function exportAuditReport(targetGroupId = null) {
    if (typeof ExcelJS === 'undefined') {
        showToast('⚠️ Thư viện ExcelJS chưa sẵn sàng', 'warning');
        return;
    }
    if (!auditState.targetList || auditState.targetList.length === 0) {
        showToast('⚠️ Không có dữ liệu đối soát để xuất', 'warning');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QIT Scanner v2 Pro';

    const groupsToExport = targetGroupId
        ? auditState.groups.filter(g => g.id === targetGroupId)
        : auditState.groups;

    // Sheet 1: Tổng hợp tất cả Group
    const wsSummary = workbook.addWorksheet('Audit Summary');
    wsSummary.addRow(['QIT SCANNER V2 PRO — BÁO CÁO ĐỐI SOÁT DANH SÁCH MÃ VẠCH THEO GROUP']);
    wsSummary.addRow(['Thời gian xuất:', new Date().toLocaleString()]);
    wsSummary.addRow(['Tổng số Group:', groupsToExport.length]);
    wsSummary.addRow(['Tổng số mã mục tiêu:', auditState.targetList.length]);
    wsSummary.addRow(['Đã quét khớp:', auditState.scannedCount]);
    wsSummary.addRow(['Còn thiếu:', Math.max(0, auditState.targetList.length - auditState.scannedCount)]);
    wsSummary.addRow(['Mã lạ ngoài danh sách:', auditState.strangerList ? auditState.strangerList.length : 0]);
    wsSummary.addRow([]);
    wsSummary.addRow(['STT Group', 'Tên Group / Kiện Hàng', 'Ghi Chú', 'Tổng Số Mã', 'Đã Quét', 'Còn Thiếu', 'Tiến Độ (%)', 'Trạng Thái Khóa']);

    groupsToExport.forEach((g, idx) => {
        const gTot = g.targetList.length;
        const gSc = g.scannedCount || 0;
        const gPct = gTot > 0 ? ((gSc / gTot) * 100).toFixed(1) + '%' : '0%';
        wsSummary.addRow([idx + 1, g.name, g.note || '', gTot, gSc, Math.max(0, gTot - gSc), gPct, g.locked ? 'ĐÃ KHÓA' : 'ĐANG MỞ']);
    });

    wsSummary.addRow([]);
    wsSummary.addRow(['STT', 'Group / Kiện Hàng', 'Mã Mục Tiêu (Target ID)', 'Model', 'Serial Tách', 'Trạng Thái Đối Soát', 'Số Lần Quét', 'Lần Quét Đầu', 'Lần Quét Cuối', 'Klippel QC', 'Trạm Đo', 'Lỗi Klippel']);

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
                klStatus = 'Chưa đo';
            }
        }
        wsSummary.addRow([
            idx + 1,
            item.groupName || 'Group #1',
            item.rawId,
            item.modelHint || '',
            item.serialOnly || item.cleanId,
            item.scanCount > 0 ? 'ĐÃ QUÉT' : 'CHƯA QUÉT',
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
    showToast('✅ Đã xuất báo cáo Excel Đối Soát Đa Group thành công!', 'success');
}

/**
 * Xuất Báo Cáo Đối Soát Đa Group ra tệp HTML độc lập tương tác
 */
function exportAuditHTML() {
    if (!auditState.targetList || auditState.targetList.length === 0) {
        showToast('⚠️ Không có dữ liệu đối soát để xuất.', 'warning');
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
                kl = 'Chưa đo';
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
<title>QIT Scanner v2 Pro - Báo Cáo Đối Soát Danh Sách Đa Group</title>
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
      <h1 style="font-size:19px; font-weight:900; color:var(--cyan);">🎯 BÁO CÁO ĐỐI SOÁT DANH SÁCH MÃ VẠCH ĐA GROUP</h1>
      <p style="font-size:11px; color:var(--txt-sub); font-family:monospace; margin-top:3px;">QIT SCANNER V2 PRO · MULTI-GROUP AUDIT RECONCILIATION</p>
    </div>
    <div style="font-size:11.5px; color:var(--txt-sub); font-family:monospace;">Xuất lúc: <strong>${new Date().toLocaleString()}</strong></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">TỔNG SỐ GROUP</div><div class="kpi-val" style="color:var(--blue);">${groupsMeta.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">TỔNG MÃ MỤC TIÊU</div><div class="kpi-val">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">ĐÃ QUÉT ĐỐI SOÁT</div><div class="kpi-val" style="color:var(--pass);">${scanned}</div></div>
    <div class="kpi-card"><div class="kpi-label">CÒN THIẾU</div><div class="kpi-val" style="color:var(--fail);">${missing}</div></div>
    <div class="kpi-card"><div class="kpi-label">TIẾN ĐỘ HOÀN THÀNH</div><div class="kpi-val" style="color:var(--cyan);">${pct}%</div></div>
  </div>
  <div class="controls">
    <select id="groupSelect" onchange="applyFilters()">
      <option value="ALL">🌐 Tất cả các Group (${groupsMeta.length})</option>
      ${groupOptsHtml}
    </select>
    <select id="auditRptFilterSelect" onchange="applyFilters()">
      <option value="ALL">Tất cả trạng thái (${total})</option>
      <option value="SCANNED">Chỉ mã ĐÃ QUÉT (${scanned})</option>
      <option value="MISSING">Chỉ mã CÒN THIẾU (${missing})</option>
    </select>
    <input type="text" id="auditRptSearchInput" placeholder="🔍 Tìm kiếm mã mục tiêu..." oninput="applyFilters()" style="min-width:240px;">
    <span id="auditRptMatchCount" style="font-size:12px; color:var(--txt-sub); margin-left:auto; font-weight:700;"></span>
  </div>
  <div class="card">
    <div style="overflow-x:auto; max-height:68vh;">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align:left;">Group / Kiện</th>
            <th style="text-align:left;">Mã Mục Tiêu (Target ID)</th>
            <th>Trạng Thái</th>
            <th>Số Lần Quét</th>
            <th>Lần Quét Đầu</th>
            <th>Lần Quét Cuối</th>
            <th>Klippel QC</th>
            <th>Trạm Đo</th>
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
      const statusBadge = item.scanned ? '<span class="badge badge-pass">✓ ĐÃ QUÉT</span>' : '<span class="badge badge-fail">✕ CHƯA QUÉT</span>';
      const klBadge = item.klippelQC === 'PASS' ? '<span class="badge badge-pass">✓ PASS</span>' : (item.klippelQC === 'FAIL' ? '<span class="badge badge-fail">✕ FAIL</span>' : item.klippelQC);
      html += '<tr><td>' + item.index + '</td><td style="text-align:left;color:var(--cyan);font-weight:700;">' + item.groupName + '</td><td style="text-align:left;font-family:monospace;font-weight:700;">' + item.rawId + '</td><td>' + statusBadge + '</td><td>' + item.scanCount + '</td><td>' + item.firstScanTime + '</td><td>' + item.lastScanTime + '</td><td>' + klBadge + '</td><td>' + item.station + '</td></tr>';
    });
    document.getElementById('auditTbody').innerHTML = html || '<tr><td colspan="9" style="padding:24px;color:var(--txt-sub);">Không có mã phù hợp.</td></tr>';
    document.getElementById('auditRptMatchCount').innerHTML = 'Hiển thị: <strong style="color:var(--cyan);">' + matches + '</strong> mã';
  }
  applyFilters();
<\/script>
</body>
</html>`;

    downloadBlobFile(htmlContent, `QIT_MultiGroup_Audit_Report_${toLocalDateStr(new Date())}.html`, 'text/html;charset=utf-8');
    showToast('✅ Đã xuất Báo Cáo Đối Soát Đa Group HTML thành công!', 'success');
}
