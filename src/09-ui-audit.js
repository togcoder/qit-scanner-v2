/* ════════════ GIAO DIỆN KIỂM TRA ĐỐI SOÁT DANH SÁCH (AUDIT UI) V2 ════════════ */

/**
 * Nạp tệp danh sách mã mục tiêu từ file (.xlsx, .xls, .csv, .txt)
 */
async function handleAuditFileUpload(fileInput) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const fileName = file.name;
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

    try {
        showToast(`⏳ Đang nạp tệp danh sách: ${fileName}...`, 'info');
        let lines = [];

        if (ext === '.xlsx' || ext === '.xls') {
            if (typeof ExcelJS === 'undefined') {
                showToast('⚠️ Thư viện ExcelJS chưa tải xong. Vui lòng thử lại sau giây lát.', 'warning');
                return;
            }
            const arrayBuffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                showToast('⚠️ Không tìm thấy bảng tính trong tệp Excel.', 'warning');
                return;
            }

            worksheet.eachRow((row, rowNumber) => {
                let cellVal = '';
                row.eachCell((cell) => {
                    if (!cellVal && cell.value) {
                        const str = String(cell.value).trim();
                        if (str && !str.toLowerCase().includes('serial') && !str.toLowerCase().includes('mã') && !str.toLowerCase().includes('stt')) {
                            cellVal = str;
                        }
                    }
                });
                if (!cellVal) {
                    const c1 = row.getCell(1);
                    if (c1 && c1.value) cellVal = String(c1.value).trim();
                }
                if (cellVal && cellVal.length >= 2) {
                    lines.push(cellVal);
                }
            });
        } else {
            const text = await file.text();
            lines = text.split(/\r?\n/)
                .map(l => {
                    if (l.includes(',')) return l.split(',')[0].trim().replace(/^["']|["']$/g, '');
                    if (l.includes('\t')) return l.split('\t')[0].trim();
                    return l.trim();
                })
                .filter(l => l.length > 0 && !l.toLowerCase().startsWith('serial') && !l.toLowerCase().startsWith('stt') && !l.toLowerCase().startsWith('target'));
        }

        if (lines.length === 0) {
            showToast('⚠️ Không tìm thấy mã hợp lệ trong tệp đã chọn.', 'warning');
            return;
        }

        const textarea = document.getElementById('audit-target-input');
        if (textarea) {
            textarea.value = lines.join('\n');
        }

        loadAuditTargetList();
        showToast(`✅ Đã nạp ${lines.length} mã từ tệp [${fileName}] thành công!`, 'success');
    } catch (err) {
        console.error('Lỗi khi nạp tệp danh sách:', err);
        showToast(`❌ Lỗi khi đọc tệp: ${err.message}`, 'error');
    } finally {
        fileInput.value = '';
    }
}

function loadAuditTargetList() {
    const textarea = document.getElementById('audit-target-input');
    if (!textarea) return;

    const rawText = textarea.value.trim();
    if (!rawText) {
        showToast('⚠️ Vui lòng dán danh sách mã cần kiểm tra vào ô nhập liệu.', 'warning');
        return;
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    auditState.targetList = lines.map((line, idx) => ({
        index: idx + 1,
        rawId: line,
        cleanId: getAlphaNum(line),
        scanCount: 0,
        firstScanTime: null,
        lastScanTime: null,
        matchedLogRecord: null
    }));

    auditState.scannedCount = 0;
    auditState.scanLog = [];

    renderAuditDashboard();
    showToast(`✅ Đã nạp ${auditState.targetList.length} mã mục tiêu cần đối soát!`, 'success');
}

function onAuditScanKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = document.getElementById('audit-scanner-input');
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            handleAuditScan(val);
            input.value = '';
        }
    }
}

function handleAuditScan(rawBarcode) {
    if (auditState.targetList.length === 0) {
        showToast('⚠️ Chưa có danh sách mục tiêu. Vui lòng nạp danh sách trước.', 'warning');
        return;
    }

    const matchRes = matchScanToTargets(rawBarcode, auditState.targetList, 'flex');
    const logEntry = {
        time: new Date().toLocaleTimeString(),
        rawScan: rawBarcode,
        result: matchRes.result,
        targetItem: null
    };

    if (matchRes.result === 'MATCH' && matchRes.best) {
        const item = matchRes.best;
        const isFirstScan = (item.scanCount === 0);
        item.scanCount++;
        const nowStr = new Date().toLocaleTimeString();
        if (!item.firstScanTime) item.firstScanTime = nowStr;
        item.lastScanTime = nowStr;

        if (isFirstScan) {
            auditState.scannedCount++;
            playScanSound('PASS');
            showToast(`✓ Khớp: ${item.rawId} (#${item.index})`, 'success');
        } else {
            playScanSound('DUPLICATE');
            showToast(`ℹ️ Đã quét lặp lại: ${item.rawId} (${item.scanCount} lần)`, 'info');
        }
        logEntry.targetItem = item;
    } else if (matchRes.result === 'AMBIGUOUS') {
        playScanSound('NOT_FOUND');
        showToast(`⚠️ Nhập nhằng (${matchRes.candidates.length} mã trùng độ khớp)`, 'warning');
    } else {
        playScanSound('NOT_FOUND');
        showToast(`✕ Không khớp mã nào trong danh sách mục tiêu`, 'error');
    }

    auditState.scanLog.unshift(logEntry);
    if (auditState.scanLog.length > 200) auditState.scanLog.pop();

    renderAuditDashboard();
}

function renderAuditDashboard() {
    const totalEl = document.getElementById('audit-total-count');
    const scannedEl = document.getElementById('audit-scanned-count');
    const remainingEl = document.getElementById('audit-remaining-count');
    const progressEl = document.getElementById('audit-progress-bar');
    const pctTextEl = document.getElementById('audit-progress-pct');

    const total = auditState.targetList.length;
    const scanned = auditState.scannedCount;
    const remaining = Math.max(0, total - scanned);
    const pct = total > 0 ? (scanned / total) * 100 : 0;

    if (totalEl) totalEl.textContent = total;
    if (scannedEl) scannedEl.textContent = scanned;
    if (remainingEl) remainingEl.textContent = remaining;
    if (progressEl) progressEl.style.width = pct + '%';
    if (pctTextEl) pctTextEl.textContent = pct.toFixed(1) + '%';

    // 1. Render Chip Lịch Sử Quét Trực Tiếp (Live Scan Chips)
    const chipsContainer = document.getElementById('audit-chips-container');
    if (chipsContainer) {
        if (auditState.scanLog.length === 0) {
            chipsContainer.innerHTML = `<span style="font-size:11.5px; color:var(--text-muted); padding:6px 0;">(Chưa có lượt quét nào — Kết quả quét sẽ xuất hiện trực tiếp tại đây)</span>`;
        } else {
            chipsContainer.innerHTML = auditState.scanLog.slice(0, 15).map(log => {
                let badgeStyle = 'background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#10b981;';
                let icon = '✓';
                let label = log.rawScan;
                if (log.result === 'MATCH' && log.targetItem) {
                    if (log.targetItem.scanCount > 1) {
                        badgeStyle = 'background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.35); color:#f59e0b;';
                        icon = '⚠️ Lặp:';
                    } else {
                        badgeStyle = 'background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#10b981;';
                        icon = '✓';
                    }
                } else if (log.result === 'AMBIGUOUS') {
                    badgeStyle = 'background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.35); color:#f59e0b;';
                    icon = '⚠️ Trùng:';
                } else {
                    badgeStyle = 'background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.35); color:#ef4444;';
                    icon = '✕ Không có:';
                }
                return `<span class="badge-pill" style="${badgeStyle} font-size:11px; padding:3px 8px; font-family:var(--font-mono);" title="Quét lúc ${log.time}">
                    ${icon} <strong>${escapeHtml(label)}</strong> <span style="font-size:9.5px; opacity:0.8;">(${log.time})</span>
                </span>`;
            }).join('');
        }
    }

    // 2. Badge thông báo trạng thái liên kết Klippel Log
    const badgeEl = document.getElementById('audit-log-reference-badge');
    if (badgeEl) {
        if (loadedFilesMap.size > 0) {
            badgeEl.innerHTML = `<span style="color:#10b981; font-weight:700;">🔗 Đang đối chiếu cùng ${loadedFilesMap.size} file Klippel Log (${dictLookupClean.size.toLocaleString()} bản ghi)</span>`;
        } else {
            badgeEl.innerHTML = `<span style="color:var(--text-sub);">ℹ️ Đang chạy chế độ kiểm tra độc lập (Không cần file log)</span>`;
        }
    }

    renderAuditTable();
}

function renderAuditTable() {
    const tbody = document.getElementById('audit-table-tbody');
    if (!tbody) return;

    if (auditState.targetList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">Chưa nạp danh sách mục tiêu</td></tr>`;
        return;
    }

    let html = '';
    auditState.targetList.forEach(item => {
        const isDone = item.scanCount > 0;
        const statusBadge = isDone
            ? `<span class="badge-pill badge-pass">✓ ĐÃ QUÉT (${item.scanCount})</span>`
            : `<span class="badge-pill badge-notfound">⏳ CHƯA QUÉT</span>`;

        let klippelCol = `<td style="text-align:center; color:var(--text-muted); font-size:11.5px;">—</td>`;
        if (loadedFilesMap.size > 0) {
            const matchRec = findRecordByBarcode(item.rawId);
            if (matchRec && matchRec.record) {
                const isPass = isRecordPass(matchRec.record);
                klippelCol = `
                    <td style="text-align:center;">
                        <span class="badge-pill ${isPass ? 'badge-pass' : 'badge-fail'}" style="font-size:10.5px; font-weight:700;">
                            ${isPass ? '✓ PASS' : '✕ FAIL'}
                        </span>
                    </td>
                `;
            } else {
                klippelCol = `<td style="text-align:center; color:var(--text-muted); font-size:10.5px;">Chưa đo</td>`;
            }
        }

        html += `
            <tr class="${isDone ? 'row-scanned' : ''}">
                <td style="text-align:center; color:var(--text-muted); font-weight:700;">#${item.index}</td>
                <td style="font-weight:700; font-family:var(--font-mono);">${escapeHtml(item.rawId)}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center; font-family:var(--font-mono); font-weight:700;">${item.scanCount}</td>
                <td style="font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">${item.firstScanTime || '—'}</td>
                <td style="font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">${item.lastScanTime || '—'}</td>
                ${klippelCol}
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function resetAuditList() {
    if (confirm(_t('Bạn có chắc muốn xóa toàn bộ danh sách đối soát hiện tại?'))) {
        auditState.targetList = [];
        auditState.scannedCount = 0;
        auditState.scanLog = [];
        const textarea = document.getElementById('audit-target-input');
        if (textarea) textarea.value = '';
        renderAuditDashboard();
        showToast('Đã làm mới danh sách đối soát', 'info');
    }
}

async function exportAuditReport() {
    if (typeof ExcelJS === 'undefined') {
        showToast('⚠️ Thư viện ExcelJS chưa sẵn sàng', 'warning');
        return;
    }
    if (auditState.targetList.length === 0) {
        showToast('⚠️ Không có dữ liệu đối soát để xuất', 'warning');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Audit Reconciliation');

    ws.addRow(['QIT SCANNER V2 — BÁO CÁO ĐỐI SOÁT DANH SÁCH MÃ VẠCH']);
    ws.addRow(['Thời gian:', new Date().toLocaleString()]);
    ws.addRow(['Tổng số mã:', auditState.targetList.length]);
    ws.addRow(['Đã quét:', auditState.scannedCount]);
    ws.addRow(['Còn thiếu:', auditState.targetList.length - auditState.scannedCount]);
    ws.addRow(['Liên kết Klippel Log:', loadedFilesMap.size > 0 ? `${loadedFilesMap.size} tệp Klippel` : 'Không dùng']);
    ws.addRow([]);
    ws.addRow(['STT', 'Mã Mục Tiêu (Target ID)', 'Trạng Thái Đối Soát', 'Số Lần Quét', 'Lần Quét Đầu', 'Lần Quét Cuối', 'Klippel QC']);

    auditState.targetList.forEach(item => {
        let klStatus = '—';
        if (loadedFilesMap.size > 0) {
            const m = findRecordByBarcode(item.rawId);
            if (m && m.record) {
                klStatus = isRecordPass(m.record) ? 'PASS' : 'FAIL';
            } else {
                klStatus = 'Chưa đo';
            }
        }
        ws.addRow([
            item.index,
            item.rawId,
            item.scanCount > 0 ? 'ĐÃ QUÉT' : 'CHƯA QUÉT',
            item.scanCount,
            item.firstScanTime || '',
            item.lastScanTime || '',
            klStatus
        ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit_Report_${toLocalDateStr(new Date())}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('✅ Đã xuất báo cáo đối soát thành công!', 'success');
}

/**
 * Xuất Báo Cáo Đối Soát Danh Sách Mã Vạch ra tệp HTML độc lập
 */
function exportAuditHTML() {
    if (auditState.targetList.length === 0) {
        showToast('⚠️ Không có dữ liệu đối soát để xuất.', 'warning');
        return;
    }

    const total = auditState.targetList.length;
    const scanned = auditState.scannedCount;
    const missing = Math.max(0, total - scanned);
    const pct = total > 0 ? ((scanned / total) * 100).toFixed(1) : '0.0';

    const itemsJson = JSON.stringify(auditState.targetList.map(item => {
        let kl = '—';
        if (loadedFilesMap.size > 0) {
            const m = findRecordByBarcode(item.rawId);
            if (m && m.record) kl = isRecordPass(m.record) ? 'PASS' : 'FAIL';
            else kl = 'Chưa đo';
        }
        return {
            index: item.index,
            rawId: item.rawId,
            scanned: item.scanCount > 0,
            scanCount: item.scanCount,
            firstScanTime: item.firstScanTime || '—',
            lastScanTime: item.lastScanTime || '—',
            klippelQC: kl
        };
    }));

    const htmlContent = `<!DOCTYPE html>
<html lang="vi" data-theme="dark">
<head>
<meta charset="utf-8">
<title>QIT Scanner v2 - Báo Cáo Đối Soát Danh Sách Mã Vạch</title>
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
  
  .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: var(--bg-card); padding: 12px 18px; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); }
  .search-input, .filter-select { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--txt); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; outline: none; transition: border-color 0.2s; }
  .search-input:focus, .filter-select:focus { border-color: var(--cyan); }
  .search-input { min-width: 260px; font-family: monospace; }

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
          <linearGradient id="qGradExp4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f2fe"/><stop offset="100%" stop-color="#4facfe"/></linearGradient>
          <linearGradient id="b14" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0f2b5c"/><stop offset="100%" stop-color="#0ea5e9"/></linearGradient>
          <linearGradient id="b24" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#2d1363"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient>
          <linearGradient id="b34" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#093d5c"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>
          <linearGradient id="b44" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#3b0764"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>
        </defs>
        <line x1="175" y1="175" x2="230" y2="230" stroke="url(#qGradExp4)" stroke-width="26" stroke-linecap="round"/>
        <circle cx="140" cy="140" r="65" fill="none" stroke="url(#qGradExp4)" stroke-width="18"/>
        <rect x="90" y="145" width="14" height="40" fill="url(#b14)"/>
        <rect x="118" y="160" width="14" height="25" fill="url(#b24)"/>
        <rect x="146" y="125" width="14" height="60" fill="url(#b34)"/>
        <rect x="174" y="135" width="14" height="50" fill="url(#b44)"/>
        <polyline points="97,125 125,140 153,105 181,115" fill="none" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="97" cy="125" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="125" cy="140" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="153" cy="105" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
        <circle cx="181" cy="115" r="5" fill="#0b0f19" stroke="#00f2fe" stroke-width="3"/>
      </svg>
      <div class="brand-text">
        <h1>🎯 BÁO CÁO ĐỐI SOÁT DANH SÁCH MÃ VẠCH</h1>
        <p>QIT SCANNER V2 · BARCODE RECONCILIATION AUDIT</p>
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
    <div class="kpi-card"><div class="kpi-label">TỔNG MÃ MỤC TIÊU</div><div class="kpi-val">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">ĐÃ QUÉT ĐỐI SOÁT</div><div class="kpi-val" style="color:var(--pass);">${scanned}</div></div>
    <div class="kpi-card"><div class="kpi-label">CÒN THIẾU</div><div class="kpi-val" style="color:var(--fail);">${missing}</div></div>
    <div class="kpi-card"><div class="kpi-label">TIẾN ĐỘ HOÀN THÀNH</div><div class="kpi-val" style="color:var(--cyan);">${pct}%</div></div>
  </div>

  <div class="controls">
    <select id="filterSelect" class="filter-select" onchange="applyFilters()">
      <option value="ALL">Tất cả trạng thái (${total})</option>
      <option value="SCANNED">Chỉ mã ĐÃ QUÉT (${scanned})</option>
      <option value="MISSING">Chỉ mã CÒN THIẾU (${missing})</option>
    </select>
    <input type="text" id="searchInput" class="search-input" placeholder="🔍 Tìm kiếm mã mục tiêu..." oninput="applyFilters()">
    <span id="matchCount" style="font-size:12px; color:var(--txt-sub); margin-left:auto; font-weight:700;">Hiển thị: <strong style="color:var(--cyan);">${total}</strong> mã</span>
  </div>

  <div class="card" style="padding:0; overflow:hidden;">
    <div style="overflow-x:auto; max-height:65vh;">
      <table>
        <thead>
          <tr>
            <th style="width:50px;">#</th>
            <th style="text-align:left; min-width:200px;">Mã Mục Tiêu (Target ID)</th>
            <th>Trạng Thái</th>
            <th>Số Lần Quét</th>
            <th>Lần Quét Đầu</th>
            <th>Lần Quét Cuối</th>
            <th>Klippel QC</th>
          </tr>
        </thead>
        <tbody id="auditTbody"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
  const items = ${itemsJson};

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
    const tbody = document.getElementById('auditTbody');

    let matches = 0;
    let html = '';

    items.forEach((item, idx) => {
      if (filter === 'SCANNED' && !item.scanned) return;
      if (filter === 'MISSING' && item.scanned) return;
      if (q && !item.rawId.toUpperCase().includes(q)) return;

      matches++;
      const statusBadge = item.scanned ? '<span class="badge badge-pass">✓ ĐÃ QUÉT</span>' : '<span class="badge badge-fail">✕ CHƯA QUÉT</span>';
      let klBadge = '<span style="color:var(--txt-sub);">—</span>';
      if (item.klippelQC === 'PASS') klBadge = '<span class="badge badge-pass">✓ PASS</span>';
      else if (item.klippelQC === 'FAIL') klBadge = '<span class="badge badge-fail">✕ FAIL</span>';
      else if (item.klippelQC) klBadge = '<span style="color:var(--txt-sub); font-size:11px;">' + item.klippelQC + '</span>';
      
      html += '<tr>';
      html += '<td style="color:var(--txt-sub);">' + item.index + '</td>';
      html += '<td style="text-align:left; font-family:monospace; font-weight:700;">' + item.rawId + '</td>';
      html += '<td>' + statusBadge + '</td>';
      html += '<td style="font-family:monospace; font-weight:700;">' + item.scanCount + '</td>';
      html += '<td style="font-family:monospace; font-size:11px;">' + item.firstScanTime + '</td>';
      html += '<td style="font-family:monospace; font-size:11px;">' + item.lastScanTime + '</td>';
      html += '<td>' + klBadge + '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html || '<tr><td colspan="7" style="padding:24px; color:var(--txt-sub);">Không tìm thấy mã nào phù hợp.</td></tr>';
    document.getElementById('matchCount').innerHTML = 'Hiển thị: <strong style="color:var(--cyan);">' + matches + '</strong> mã';
  }

  initReportTheme();
  applyFilters();
</script>
</body>
</html>`;

    downloadBlobFile(htmlContent, `QIT_Audit_Reconciliation_Report_${toLocalDateStr(new Date())}.html`, 'text/html;charset=utf-8');
    showToast('✅ Đã xuất Báo Cáo Đối Soát HTML độc lập thành công!', 'success');
}
