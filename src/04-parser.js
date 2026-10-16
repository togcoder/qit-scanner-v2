/* ════════════ BỘ BÓC TÁCH FILE LOG KLIPPEL QC (PARSER V2) ════════════ */

/**
 * Tự động phát hiện ký tự phân tách (Delimiter Auto-detection)
 */
function detectDelimiter(sampleLines) {
    if (!sampleLines || sampleLines.length === 0) return '\t';

    const candidates = ['\t', ',', ';', '|'];
    const scores = { '\t': 0, ',': 0, ';': 0, '|': 0 };

    sampleLines.forEach(line => {
        candidates.forEach(delim => {
            const count = (line.match(new RegExp(delim === '\t' ? '\\t' : (delim === '|' ? '\\|' : delim), 'g')) || []).length;
            scores[delim] += count;
        });
    });

    let bestDelim = '\t';
    let maxScore = -1;

    candidates.forEach(d => {
        if (scores[d] > maxScore) {
            maxScore = scores[d];
            bestDelim = d;
        }
    });

    return maxScore > 0 ? bestDelim : '\t';
}

/**
 * Tách một dòng dữ liệu theo delimiter, hỗ trợ chuỗi trong dấu ngoặc kép "..."
 */
function splitDelimitedLine(line, delimiter) {
    const cleanLine = line.replace(/\r$/, '');
    if (delimiter === '\t') {
        return cleanLine.split('\t').map(c => c.trim());
    }

    const regex = new RegExp(`(?:^|${delimiter === '|' ? '\\|' : delimiter})(?:"([^"]*)"|([^"${delimiter === '|' ? '\\|' : delimiter}]*))`, 'g');
    const cols = [];
    let match;

    while ((match = regex.exec(cleanLine)) !== null) {
        let val = match[1] !== undefined ? match[1] : match[2];
        cols.push((val || '').trim());
    }

    return cols.length > 0 ? cols : cleanLine.split(delimiter).map(c => c.trim());
}

/**
 * Trích xuất Metadata Header và tìm dòng chứa Tiêu Đề Cột
 */
function extractHeaderAndMetadata(lines, delimiter) {
    let headerRowIndex = -1;
    let headers = [];
    const metadata = {};

    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const line = lines[i];
        const upper = line.toUpperCase();

        if (upper.includes('STATION:') || upper.includes('STATION NAME:')) {
            const parts = line.split(/:\s*/);
            if (parts.length >= 2) metadata.stationName = parts[1].trim();
        }

        if (upper.includes('DATE') || upper.includes('SERIALNUMBER') || upper.includes('SERIAL NUMBER') || upper.includes('VERDICT-') || upper.includes('RESULT') || upper.includes('DUT')) {
            headerRowIndex = i;
            headers = splitDelimitedLine(line, delimiter);
            break;
        }
    }

    if (headerRowIndex === -1 && lines.length > 0) {
        headerRowIndex = 0;
        headers = splitDelimitedLine(lines[0], delimiter);
    }

    return { headerRowIndex, headers, metadata };
}

/**
 * Phân giải chuỗi thời gian Klippel (Date + Time + UTC Offset)
 */
function parseDateTime(dateStr, timeStr, utcStr) {
    return parseLogTimestamp(dateStr, timeStr, utcStr);
}

/**
 * Bóc tách tên thông số, điều kiện đo và đơn vị từ tiêu đề cột
 */
function parseMetricHeader(cleanName) {
    let metricName = cleanName;
    let condition = '';
    let defaultUnit = '';

    if (cleanName.includes('-')) {
        const parts = cleanName.split('-');
        metricName = parts[0].trim();
        condition = parts.slice(1).join('-').trim();
    }

    const upper = metricName.toUpperCase();
    if (upper === 'RE' || upper.startsWith('RE ')) defaultUnit = 'Ω';
    else if (upper === 'FS' || upper.startsWith('FS ')) defaultUnit = 'Hz';
    else if (upper.includes('SPL') || upper.includes('LEVEL') || upper.includes('SENS')) defaultUnit = 'dB';
    else if (upper.includes('THD') || upper.includes('RUB') || upper.includes('BUZZ') || upper.includes('RMSE')) defaultUnit = '%';
    else if (upper.includes('IMP') || upper.includes('ZMIN') || upper.includes('ZMAX')) defaultUnit = 'Ω';

    return { metricName, condition, defaultUnit };
}

/**
 * Trích xuất tên trạm từ tên tệp (Fallback)
 */
function extractStationFromFileName(fileName) {
    if (!fileName) return 'Station_Unknown';
    const base = fileName.replace(/\.[^/.]+$/, '').trim();
    const match = base.match(/(SAS\d+-\d+|SFS\d+-\d+|LINE\d+|STATION\d+|CHECK\s*\d+%?)/i);
    if (match) return match[1].toUpperCase();
    return base;
}

/**
 * Hiển thị màn hình chờ Splash Screen với hoạt ảnh quét laser
 */
function showSplash(title, sub) {
    const splash = document.getElementById('qit-splash');
    if (!splash) return;
    const tEl = splash.querySelector('.qit-splash-title');
    const sEl = splash.querySelector('.qit-splash-sub');
    if (tEl && title) tEl.textContent = title;
    if (sEl && sub) sEl.textContent = sub;
    splash.setAttribute('data-qit-open', 'true');
}

function hideSplash() {
    const splash = document.getElementById('qit-splash');
    if (!splash) return;
    splash.removeAttribute('data-qit-open');
}

/**
 * Hàm kích hoạt xử lý tệp từ nút bấm trên màn hình setup
 */
function processFiles() {
    processMultipleLogFiles(filesToLoad);
}

/**
 * Xử lý danh sách nhiều file log đầu vào
 */
async function processMultipleLogFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    showSplash('ĐANG NẠP DỮ LIỆU...', `Đang xử lý ${fileList.length} tệp log Klippel QC`);
    setProcessingButtonState(true, _t('ĐANG ĐỌC & PHÂN TÍCH TỆP...'));

    await new Promise(r => setTimeout(r, 60));

    try {
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const fileId = `FILE_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`;
            const textContent = await readFileAsText(file);
            processSingleLogFile(textContent, file.name, fileId);
        }

        completeImport();
    } catch (err) {
        console.error('File parsing error:', err);
        showToast('❌ Đã xảy ra lỗi khi đọc tệp: ' + err.message, 'error');
        setProcessingButtonState(false, _t('TIẾN HÀNH XỬ LÝ DỮ LIỆU'));
    } finally {
        setTimeout(() => hideSplash(), 400);
    }
}

/**
 * Đọc file dạng Text tương thích trình duyệt
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file, 'utf-8');
    });
}

/**
 * Phân tích cấu trúc của một tệp log Klippel QC duy nhất
 */
function processSingleLogFile(rawContent, fileName, fileId) {
    if (!rawContent || !rawContent.trim()) return;

    const lines = rawContent.split(/\r?\n/).map(l => l.replace(/\r$/, '')).filter(line => line.trim().length > 0);
    if (lines.length < 2) return;

    // Dọn dẹp bản ghi cũ nếu tệp này từng được nạp trước đó để tránh nhân bản dữ liệu
    for (let [fId, fInfo] of loadedFilesMap.entries()) {
        if (fInfo.fileName === fileName) {
            timelineData = timelineData.filter(r => r.fileId !== fId);
            loadedFilesMap.delete(fId);
            break;
        }
    }

    // 1. Tự động nhận diện ký tự phân tách (Delimiter Detection)
    const delimiter = detectDelimiter(lines.slice(0, 15));

    // 2. Tự động trích xuất Metadata Header và dòng Tiêu đề Cột
    const { headerRowIndex, headers, metadata } = extractHeaderAndMetadata(lines, delimiter);
    if (headers.length === 0) {
        parseWarnings.push(`Tệp ${fileName} không tìm thấy tiêu đề hợp lệ.`);
        return;
    }

    // 3. Tự động khám phá lược đồ cột (Dynamic Schema Discovery)
    const schema = discoverFileSchema(headers);

    let stationName = metadata.stationName || 'Station_Unknown';
    const fileRecords = [];

    // 4. Bóc tách từng bản ghi đo kiểm
    for (let rowIdx = headerRowIndex + 1; rowIdx < lines.length; rowIdx++) {
        const line = lines[rowIdx];
        const cols = splitDelimitedLine(line, delimiter);
        if (cols.length < 2) continue;

        totalLinesParsed++;

        // Bóc tách Thời gian (Date, Time, UTC)
        const dateStr = schema.dateCol !== -1 ? cols[schema.dateCol] : '';
        const timeStr = schema.timeCol !== -1 ? cols[schema.timeCol] : '';
        const utcStr = schema.utcCol !== -1 ? cols[schema.utcCol] : '';
        const timestamp = parseDateTime(dateStr, timeStr, utcStr);

        const rawSNCandidate = schema.snCol !== -1 ? cols[schema.snCol] : '';
        const rawDbPath = schema.dbCol !== -1 ? cols[schema.dbCol] : '';
        const userName = schema.userCol !== -1 ? cols[schema.userCol] : '';

        // Trích xuất tên trạm từ đường dẫn Database (VD: SAS208-01 hoặc SFS203-01)
        if (rawDbPath && stationName === 'Station_Unknown') {
            stationName = extractStationFromDbPath(rawDbPath, fileName);
        }

        // Bóc tách Định danh 3 tầng (Model, Serial, Full ID)
        const idInfo = parseIdentifier(rawSNCandidate, rawDbPath, timestamp, totalLinesParsed, fileName);

        // Overall Verdict
        let verdictOverall = 1;
        if (schema.overallCol !== -1) {
            const val = (cols[schema.overallCol] || '').toUpperCase();
            verdictOverall = (val === '1' || val === 'PASS' || val === 'PASSED' || val === 'TRUE' || val === 'OK') ? 1 : 0;
        }

        // Parse Task Verdicts (3 trạng thái: 1 PASS, 0 FAIL, -1 NOT TESTED)
        const rawErrors = [];
        const notTestedTasks = [];
        const taskVerdicts = {};

        schema.verdictCols.forEach(vCol => {
            const rawVal = (cols[vCol.index] || '').toUpperCase();
            if (rawVal === '-1' || rawVal === '' || rawVal === 'NA' || rawVal === 'N/A' || rawVal === 'SKIP') {
                notTestedTasks.push(vCol.name);
                taskVerdicts[vCol.name] = -1;
            } else if (rawVal === '0' || rawVal === 'FAIL' || rawVal === 'FAILED' || rawVal === 'NG' || rawVal === 'FALSE') {
                rawErrors.push(vCol.name);
                taskVerdicts[vCol.name] = 0;
            } else {
                taskVerdicts[vCol.name] = 1;
            }
        });

        // 100% Khai thác Giá trị Đo Liên tục & Dung sai (Parametric Measurements)
        const metricsData = {};
        schema.metricCols.forEach(mCol => {
            const valStr = cols[mCol.valueIndex];
            if (valStr !== undefined && valStr !== '' && valStr.toUpperCase() !== 'NAN') {
                const numVal = parseFloat(valStr);
                if (!isNaN(numVal)) {
                    metricsData[mCol.metricKey] = {
                        name: mCol.metricName,
                        condition: mCol.condition,
                        value: numVal,
                        unit: mCol.unit,
                        minLimit: mCol.minLimitIndex !== -1 ? parseFloat(cols[mCol.minLimitIndex]) : null,
                        maxLimit: mCol.maxLimitIndex !== -1 ? parseFloat(cols[mCol.maxLimitIndex]) : null
                    };

                    // Đăng ký thông số vào danh mục toàn hệ thống
                    if (!allKnownMetrics.has(mCol.metricKey)) {
                        allKnownMetrics.set(mCol.metricKey, {
                            metricName: mCol.metricName,
                            condition: mCol.condition,
                            unit: mCol.unit,
                            minLimit: metricsData[mCol.metricKey].minLimit,
                            maxLimit: metricsData[mCol.metricKey].maxLimit,
                            sampleCount: 0
                        });
                    }
                    allKnownMetrics.get(mCol.metricKey).sampleCount++;
                }
            }
        });

        rawErrors.forEach(err => {
            uniqueErrorsInFile.add(err);
            allKnownErrors.add(err);
        });

        if (stationName === 'Station_Unknown') {
            stationName = extractStationFromFileName(fileName);
        }

        const record = {
            id: `${fileId}_${rowIdx}`,
            fileId,
            fileName,
            stationName,
            rawSN: rawSNCandidate,
            displayID: idInfo.displayID,
            cleanSN: idInfo.cleanSN,
            cleanSeri: idInfo.cleanSeri,
            modelName: idInfo.modelName,
            serialNo: idInfo.serialNo,
            isNoSeri: idInfo.isNoSeri,
            timestamp,
            dateStr,
            timeStr,
            userName,
            dbPath: rawDbPath,
            verdictOverall,
            errors: rawErrors,
            notTested: notTestedTasks,
            taskVerdicts,
            metrics: metricsData
        };

        fileRecords.push(record);
        timelineData.push(record);

        // Lưu vào các bảng tra cứu nhanh Multi-Index
        if (idInfo.cleanSN) {
            const existing = dictLookupClean.get(idInfo.cleanSN);
            if (!existing || !existing.timestamp || !timestamp || timestamp >= existing.timestamp) {
                dictLookupClean.set(idInfo.cleanSN, record);
            }
        }
        if (idInfo.cleanSeri && idInfo.cleanSeri !== idInfo.cleanSN) {
            const existing = dictLookupSeri.get(idInfo.cleanSeri);
            if (!existing || !existing.timestamp || !timestamp || timestamp >= existing.timestamp) {
                dictLookupSeri.set(idInfo.cleanSeri, record);
            }
        }
        if (idInfo.modelName) {
            if (!dictLookupModel.has(idInfo.modelName)) {
                dictLookupModel.set(idInfo.modelName, []);
            }
            dictLookupModel.get(idInfo.modelName).push(record);
        }
    }

    // Đăng ký tệp vào kho quản lý đa tệp loadedFilesMap
    loadedFilesMap.set(fileId, {
        fileId,
        fileName,
        stationName,
        recordCount: fileRecords.length,
        active: true,
        schema,
        records: fileRecords
    });
}

/**
 * Tự động phân tích Lược đồ cột của tệp log Klippel (Dynamic Schema Discovery)
 */
function discoverFileSchema(headers) {
    const schema = {
        dateCol: -1,
        timeCol: -1,
        utcCol: -1,
        snCol: -1,
        userCol: -1,
        dbCol: -1,
        overallCol: -1,
        verdictCols: [],
        gradeCols: [],
        metricCols: []
    };

    const headerMap = new Map();
    headers.forEach((h, i) => headerMap.set(h.toUpperCase().trim(), i));

    const nonMetricSet = new Set(['DATE', 'TIME', 'UTC-OFFSET', 'SERIALNUMBER', 'SERIAL NUMBER', 'SERIAL_NUMBER', 'SN', 'S/N', 'USERNAME', 'USER', 'OPERATOR', 'DATABASE', 'DB', 'PATH', 'STATUS', 'VERDICT-OVERAL', 'VERDICT-OVERALL', 'RESULT']);

    // First pass for primary columns
    headers.forEach((h, i) => {
        const upperH = h.toUpperCase().trim();

        if (upperH === 'DATE' && schema.dateCol === -1) schema.dateCol = i;
        else if (upperH === 'TIME' && schema.timeCol === -1) schema.timeCol = i;
        else if (upperH.includes('UTC') && schema.utcCol === -1) schema.utcCol = i;
        else if ((upperH.includes('SERIALNUMBER') || upperH.includes('SERIAL NUMBER') || upperH.includes('SERIAL_NUMBER') || upperH === 'SN' || upperH === 'S/N') && schema.snCol === -1) {
            schema.snCol = i;
        } else if ((upperH === 'USERNAME' || upperH === 'USER' || upperH === 'OPERATOR') && schema.userCol === -1) {
            schema.userCol = i;
        } else if ((upperH === 'DATABASE' || upperH === 'DB' || upperH === 'PATH') && schema.dbCol === -1) {
            schema.dbCol = i;
        } else if ((upperH === 'VERDICT-OVERAL' || upperH === 'VERDICT-OVERALL' || upperH === 'RESULT') && schema.overallCol === -1) {
            schema.overallCol = i;
        }
    });

    if (schema.overallCol === -1) {
        headers.forEach((h, i) => {
            const upperH = h.toUpperCase().trim();
            if (upperH === 'STATUS' && schema.overallCol === -1) schema.overallCol = i;
        });
    }

    // Second pass for tasks and metrics
    headers.forEach((h, i) => {
        const cleanH = h.trim();
        const upperH = cleanH.toUpperCase();

        if (upperH === 'VERDICT-OVERAL' || upperH === 'VERDICT-OVERALL') return;

        if (upperH.startsWith('VERDICT-')) {
            const taskName = cleanH.replace(/^Verdict-/i, '').trim();
            schema.verdictCols.push({ name: taskName, index: i });
        } else if (upperH.startsWith('GRADE-')) {
            const gradeName = cleanH.replace(/^Grade-/i, '').trim();
            schema.gradeCols.push({ name: gradeName, index: i });
        } else if (!nonMetricSet.has(upperH) && !upperH.startsWith('MINLIMIT-') && !upperH.startsWith('MAXLIMIT-') && !upperH.startsWith('UNIT-')) {
            const cleanName = cleanH.replace(/^Value-/i, '').trim();
            const minIdx = headerMap.has(`MINLIMIT-${cleanName.toUpperCase()}`) ? headerMap.get(`MINLIMIT-${cleanName.toUpperCase()}`) : -1;
            const maxIdx = headerMap.has(`MAXLIMIT-${cleanName.toUpperCase()}`) ? headerMap.get(`MAXLIMIT-${cleanName.toUpperCase()}`) : -1;
            const unitIdx = headerMap.has(`UNIT-${cleanName.toUpperCase()}`) ? headerMap.get(`UNIT-${cleanName.toUpperCase()}`) : -1;

            const { metricName, condition, defaultUnit } = parseMetricHeader(cleanName);

            schema.metricCols.push({
                metricKey: cleanName,
                metricName: metricName,
                condition: condition,
                valueIndex: i,
                minLimitIndex: minIdx,
                maxLimitIndex: maxIdx,
                unitIndex: unitIdx,
                unit: defaultUnit
            });
        }
    });

    return schema;
}

/**
 * Thuật toán bóc tách Định danh chuẩn xác (Lossless ID, Model & Serial Decomposition)
 */
function parseIdentifier(rawSN, dbPath, timestamp, lineIdx, fileName) {
    let candidate = (rawSN || '').trim();

    // Fallback 1: Trích xuất từ đường dẫn cơ sở dữ liệu dB-Lab (.kdbx)
    if (!candidate || candidate.toUpperCase() === 'UNKNOWN' || candidate === '0') {
        if (dbPath) {
            const match = dbPath.match(/DUT\s+([^\\]+?)(?:\s+\d{4}-\d{2}-\d{2}|\.kdbx|$)/i);
            if (match && match[1]) {
                candidate = match[1].trim();
            } else {
                const fileNameMatch = dbPath.match(/([^\\/]+)\.kdbx$/i);
                if (fileNameMatch && fileNameMatch[1]) {
                    candidate = fileNameMatch[1].replace(/^DUT\s+/i, '').trim();
                }
            }
        }
    }

    // Fallback 2: Nếu hoàn toàn không có định danh => Tạo định danh ẩn theo timestamp/dòng
    if (!candidate || candidate.toUpperCase() === 'UNKNOWN' || candidate === '0') {
        const timeKey = timestamp ? timestamp.toISOString().replace(/[:.]/g, '-') : `LINE_${lineIdx}`;
        const fallbackModel = extractModelFromDbOrFile(dbPath, fileName);
        return {
            displayID: `DUT_${timeKey}`,
            cleanSN: `DUT_${timeKey}`,
            cleanSeri: `DUT_${timeKey}`,
            modelName: fallbackModel,
            serialNo: `DUT_${timeKey}`,
            isNoSeri: true
        };
    }

    // Bóc tách Serial Number và Model
    let serialNo = candidate;
    let cleanSeri = getAlphaNum(candidate);

    if (candidate.includes('_')) {
        const parts = candidate.split('_');
        if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1].trim();
            if (lastPart.length >= CFG.MIN_SCAN_LEN) {
                serialNo = lastPart;
                cleanSeri = getAlphaNum(lastPart);
            }
        }
    } else if (candidate.includes('/') && !candidate.startsWith('http')) {
        const parts = candidate.split('/');
        if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1].trim();
            if (lastPart.length >= CFG.MIN_SCAN_LEN) {
                serialNo = lastPart;
                cleanSeri = getAlphaNum(lastPart);
            }
        }
    }

    // Model Name: Ưu tiên mã Model / Job chuẩn hóa từ Database Path hoặc Tên File (VD: 659841 hoặc 655983)
    let modelName = extractModelFromDbOrFile(dbPath, fileName);
    if (!modelName || modelName === 'STANDARD_MODEL') {
        if (candidate.includes('_')) {
            modelName = candidate.split('_')[0].trim();
        } else if (candidate.includes('/')) {
            modelName = candidate.split('/')[0].trim();
        }
    }

    return {
        displayID: candidate,
        cleanSN: getAlphaNum(candidate),
        cleanSeri: cleanSeri,
        modelName: modelName,
        serialNo: serialNo,
        isNoSeri: false
    };
}

/**
 * Trích xuất Mã Model theo đúng quy tắc người dùng yêu cầu:
 * 1. Nếu có chữ Summary ở đầu tên file -> Lấy phần tên sau chữ Summary (VD: 'Summary 659841...' -> '659841')
 * 2. Nếu không có chữ Summary (file đổi tên, file trạm đo) -> Lấy cả tên file sạch (VD: '100%.log.txt' -> '100%')
 */
function extractModelFromDbOrFile(dbPath, fileName) {
    if (!fileName) return 'STANDARD_MODEL';
    const cleanFn = fileName.replace(/(\.log|\.txt|\.csv)+$/i, '').trim();

    // 1. Nếu có chữ Summary ở đầu: lấy phần tên sau chữ Summary
    if (/^summary/i.test(cleanFn)) {
        const afterSum = cleanFn.replace(/^summary[\s_:-]*/i, '').trim();
        const match = afterSum.match(/^(.+?)(?:\s+\d{4}-\d{2}-\d{2}|\s+\d{2}-\d{2}-\d{4}|$)/);
        if (match && match[1] && match[1].trim()) {
            return match[1].trim();
        }
        return afterSum || cleanFn;
    }

    // 2. Nếu không có chữ Summary (hoặc file bị đổi tên): lấy cả tên file (VD: '100%', '200%')
    return cleanFn;
}

/**
 * Trích xuất tên trạm đo từ đường dẫn Database (VD: "SAS208-01" từ D:\SAS208-01\...)
 */
function extractStationFromDbPath(dbPath, fileName) {
    if (!dbPath) return fileName.replace(/\.[^/.]+$/, '');
    try {
        const normalized = dbPath.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(p => p && p !== 'D:' && p !== 'C:' && !p.includes(':'));
        if (parts.length >= 1) {
            return parts[0];
        }
    } catch(e) {}
    return fileName.replace(/\.[^/.]+$/, '');
}

/**
 * Hoàn tất quá trình nạp tệp và chuyển sang màn hình chính
 */
function completeImport() {
    if (dictLookupClean.size === 0 && timelineData.length === 0) {
        setProcessingButtonState(false, _t('TIẾN HÀNH XỬ LÝ DỮ LIỆU'));
        showToast('❌ Không đọc được bản ghi nào. Kiểm tra lại định dạng tệp.', 'error');
        return;
    }

    setProcessingButtonState(false, _t('TIẾN HÀNH XỬ LÝ DỮ LIỆU'));

    // Chuyển màn hình và hiển thị toàn bộ phân tích
    const setupScr = document.getElementById('setup-screen');
    const mainScr = document.getElementById('main-app-screen');
    if (setupScr) setupScr.classList.add('hidden');
    if (mainScr) mainScr.classList.remove('hidden');

    applyFileFiltersAndRecalculate();
    showToast(`✅ Đã nạp thành công ${loadedFilesMap.size} tệp (${timelineData.length.toLocaleString()} bản ghi đo)!`, 'success');
}
