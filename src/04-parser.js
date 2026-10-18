/* ════════════ BỘ BÓC TÁCH FILE LOG KLIPPEL QC (PARSER V2 PRO) ════════════ */

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
        } else if (upper.includes('TEST STRUCTURE:')) {
            const parts = line.split(/:\s*/);
            if (parts.length >= 2) metadata.testStructure = parts[1].trim();
        } else if (upper.includes('OPERATOR:')) {
            const parts = line.split(/:\s*/);
            if (parts.length >= 2) metadata.operator = parts[1].trim();
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
    else if (upper.includes('SPL_DELAY') || upper.includes('DELAY')) defaultUnit = 'ms';
    else if (upper.includes('SPL') || upper.includes('LEVEL') || upper.includes('SENS')) defaultUnit = 'dB';
    else if (upper.includes('THD') || upper.includes('RUB') || upper.includes('BUZZ') || upper.includes('RBZ') || upper.includes('RMSE')) defaultUnit = '%';
    else if (upper.includes('IMP') || upper.includes('ZMIN') || upper.includes('ZMAX')) defaultUnit = 'Ω';
    else if (upper.includes('TEMP')) defaultUnit = '°C';
    else if (upper.includes('HUMID')) defaultUnit = '%';

    return { metricName, condition, defaultUnit };
}

/**
 * Làm sạch đơn vị đo thực tế từ cột Unit-<Task> của Klippel
 */
function normalizeKlippelUnit(rawUnit, fallbackUnit) {
    if (!rawUnit || !String(rawUnit).trim()) return fallbackUnit || '';
    const u = String(rawUnit).trim();
    if (/^ohm$/i.test(u)) return 'Ω';
    if (/^degc$/i.test(u) || /^c$/i.test(u)) return '°C';
    return u;
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

    showSplash(_t('ĐANG NẠP DỮ LIỆU...'), _t('Đang xử lý {0} tệp log Klippel QC', fileList.length));
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
        showToast(_t('❌ Đã xảy ra lỗi khi đọc tệp: {0}', err.message), 'error');
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
        parseWarnings.push(_t('Tệp {0} không tìm thấy tiêu đề hợp lệ.', fileName));
        return;
    }

    // 3. Tự động khám phá lược đồ cột (Dynamic Schema Discovery)
    const schema = discoverFileSchema(headers);

    let stationName = metadata.stationName || 'Station_Unknown';
    const fileRecords = [];
    const stimulusSet = new Set();

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
        const userName = schema.userCol !== -1 ? cols[schema.userCol] : (metadata.operator || '');

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

        // Parse Task Grades (Grade-Task)
        const taskGrades = {};
        schema.gradeCols.forEach(gCol => {
            const rawVal = (cols[gCol.index] || '').trim();
            if (rawVal !== '') {
                taskGrades[gCol.name] = rawVal;
            }
        });

        // 100% Khai thác Giá trị Đo Liên tục & Dung sai (Parametric Measurements)
        const metricsData = {};
        schema.metricCols.forEach(mCol => {
            const valStr = cols[mCol.valueIndex];
            if (valStr !== undefined && valStr !== '' && valStr.toUpperCase() !== 'NAN') {
                const numVal = parseFloat(valStr);
                if (!isNaN(numVal)) {
                    const actualUnit = (mCol.unitIndex !== -1 && cols[mCol.unitIndex])
                        ? normalizeKlippelUnit(cols[mCol.unitIndex], mCol.unit)
                        : mCol.unit;

                    if (mCol.condition) stimulusSet.add(mCol.condition);

                    const minLimVal = mCol.minLimitIndex !== -1 ? parseFloat(cols[mCol.minLimitIndex]) : null;
                    const maxLimVal = mCol.maxLimitIndex !== -1 ? parseFloat(cols[mCol.maxLimitIndex]) : null;

                    metricsData[mCol.metricKey] = {
                        name: mCol.metricName,
                        condition: mCol.condition,
                        value: numVal,
                        unit: actualUnit,
                        minLimit: (minLimVal !== null && !isNaN(minLimVal)) ? minLimVal : null,
                        maxLimit: (maxLimVal !== null && !isNaN(maxLimVal)) ? maxLimVal : null
                    };

                    // Đăng ký thông số vào danh mục toàn hệ thống
                    if (!allKnownMetrics.has(mCol.metricKey)) {
                        allKnownMetrics.set(mCol.metricKey, {
                            metricName: mCol.metricName,
                            condition: mCol.condition,
                            unit: actualUnit,
                            minLimit: metricsData[mCol.metricKey].minLimit,
                            maxLimit: metricsData[mCol.metricKey].maxLimit,
                            sampleCount: 0
                        });
                    }
                    const metaObj = allKnownMetrics.get(mCol.metricKey);
                    if (!metaObj.unit && actualUnit) metaObj.unit = actualUnit;
                    metaObj.sampleCount++;
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
            taskGrades,
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
        modelName: fileRecords[0] ? fileRecords[0].modelName : extractModelFromDbOrFile('', fileName),
        stimulusInfo: Array.from(stimulusSet).slice(0, 3).join(' · ') || 'Standard QC',
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
    let candidate = sanitizeIdentifier(rawSN || '');

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

    if (/^summary/i.test(cleanFn)) {
        const afterSum = cleanFn.replace(/^summary[\s_:-]*/i, '').trim();
        const match = afterSum.match(/^(.+?)(?:\s+\d{4}-\d{2}-\d{2}|\s+\d{2}-\d{2}-\d{4}|$)/);
        if (match && match[1] && match[1].trim()) {
            return match[1].trim();
        }
        return afterSum || cleanFn;
    }

    return cleanFn;
}

function extractModelFromFileName(fileName) {
    return extractModelFromDbOrFile('', fileName);
}
if (typeof window !== 'undefined') {
    window.extractModelFromFileName = extractModelFromFileName;
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
        showToast(_t('❌ Không đọc được bản ghi nào. Kiểm tra lại định dạng tệp.'), 'error');
        return;
    }

    setProcessingButtonState(false, _t('TIẾN HÀNH XỬ LÝ DỮ LIỆU'));

    const setupScr = document.getElementById('setup-screen');
    const mainScr = document.getElementById('main-app-screen');
    if (setupScr) setupScr.classList.add('hidden');
    if (mainScr) mainScr.classList.remove('hidden');

    applyFileFiltersAndRecalculate();
    if (typeof syncAuditWithKlippelLogs === 'function') {
        syncAuditWithKlippelLogs();
    }
    showToast(_t('✅ Đã nạp thành công {0} tệp ({1} bản ghi đo)!', loadedFilesMap.size, timelineData.length.toLocaleString()), 'success');
}

/**
 * 🧪 BỘ SINH DỮ LIỆU MẪU ĐA TRẠM CHUẨN KLIPPEL QC (3 TRẠM · 150 BẢN GHI THỰC TẾ)
 * Giúp kỹ sư và người vận hành trải nghiệm tức thì toàn bộ 5 không gian làm việc.
 */
function loadBuiltInDemoKlippelLogs(silent = false) {
    resetAllData();

    const stations = [
        { id: 'DEMO_ST1', fileName: 'Summary 659841_SAS208-01 2026-10-16 08-00-00.log', station: 'SAS208-01', model: 'P2001315-10-B', stim: '4V 1/12', count: 65, baseFailRate: 0.11 },
        { id: 'DEMO_ST2', fileName: 'Summary 659841_SAS208-02 2026-10-16 14-00-00.log', station: 'SAS208-02', model: 'P2001315-10-B', stim: '16V 1/12', count: 55, baseFailRate: 0.15 },
        { id: 'DEMO_ST3', fileName: 'Summary 655983_SFS203-01 2026-10-16 20-00-00.log', station: 'SFS203-01', model: '655983-WOOFER', stim: '32W 1/12', count: 40, baseFailRate: 0.08 }
    ];

    const headerCols = [
        'Date', 'Time', 'UTC-Offset', 'SerialNumber', 'UserName', 'Database',
        'Verdict-Overal',
        'Verdict-resp - 4V 1/12', 'Verdict-thd - 4V 1/12', 'Verdict-rbz - 16V 1/12', 'Verdict-pol - 4V 1/12', 'Verdict-imp - 4V 1/12',
        'Grade-level - 4V 1/12',
        'level - 4V 1/12', 'MinLimit-level - 4V 1/12', 'MaxLimit-level - 4V 1/12', 'Unit-level - 4V 1/12',
        're - 4V 1/12', 'MinLimit-re - 4V 1/12', 'MaxLimit-re - 4V 1/12', 'Unit-re - 4V 1/12',
        'fs - 4V 1/12', 'MinLimit-fs - 4V 1/12', 'MaxLimit-fs - 4V 1/12', 'Unit-fs - 4V 1/12',
        'qts - 4V 1/12', 'MinLimit-qts - 4V 1/12', 'MaxLimit-qts - 4V 1/12', 'Unit-qts - 4V 1/12',
        'impPt - 4V 1/12', 'MinLimit-impPt - 4V 1/12', 'MaxLimit-impPt - 4V 1/12', 'Unit-impPt - 4V 1/12',
        'rmseZ - 4V 1/12', 'MinLimit-rmseZ - 4V 1/12', 'MaxLimit-rmseZ - 4V 1/12', 'Unit-rmseZ - 4V 1/12'
    ].join('\t');

    // Deterministic pseudo-random helper
    function prnd(seed) {
        const x = Math.sin(seed * 9301 + 49297) * 233280;
        return x - Math.floor(x);
    }
    function gaussRnd(seed) {
        const u1 = Math.max(0.0001, prnd(seed));
        const u2 = Math.max(0.0001, prnd(seed + 17.3));
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }

    stations.forEach((st, stIdx) => {
        const lines = [
            `KLIPPEL QC - Summary Log File`,
            `Station Name: ${st.station}`,
            `Operator: OP_LINE_${stIdx + 1}`,
            headerCols
        ];

        const baseHour = stIdx === 0 ? 7 : (stIdx === 1 ? 14 : 21);

        for (let i = 1; i <= st.count; i++) {
            const seed = (stIdx + 1) * 1000 + i * 13;
            // Share some serials across stations to demonstrate Multi-Run Matrix & Retest!
            const serialNum = (stIdx === 1 && i <= 25)
                ? `SIEV261531B${String(1000 + i).padStart(4, '0')}`
                : (stIdx === 0
                    ? `SIEV261531B${String(1000 + i).padStart(4, '0')}`
                    : `WFR261016C${String(2000 + i).padStart(4, '0')}`);

            const fullSN = `${st.model}_${serialNum}`;
            const minOffset = i * 4;
            const hh = (baseHour + Math.floor(minOffset / 60)) % 24;
            const mm = minOffset % 60;
            const ss = (i * 7) % 60;
            const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:0`;

            const rFail = prnd(seed + 3);
            const isFail = rFail < st.baseFailRate;

            let vResp = 1, vThd = 1, vRbz = 1, vPol = 1, vImp = 1;
            if (isFail) {
                const errType = i % 5;
                if (errType === 0) { vRbz = 0; }
                else if (errType === 1) { vResp = 0; vThd = 0; }
                else if (errType === 2) { vThd = 0; }
                else if (errType === 3) { vImp = 0; }
                else { vPol = 0; }
            }
            const vOverall = (vResp && vThd && vRbz && vPol && vImp) ? 1 : 0;

            const g = gaussRnd(seed + 9);
            const spl = isFail && !vResp ? (103.10 - Math.abs(g) * 0.6) : (104.82 + g * 0.24);
            const re  = isFail && !vImp  ? (18.65 + Math.abs(g) * 0.3)  : (16.62 + gaussRnd(seed + 21) * 0.36);
            const fs  = 110.2 + gaussRnd(seed + 33) * 3.8;
            const qts = 0.685 + gaussRnd(seed + 45) * 0.024;
            const imp = 19.40 + gaussRnd(seed + 57) * 0.42;
            const rmse= Math.abs(1.15 + gaussRnd(seed + 69) * 0.28);
            const grade = vOverall === 1 ? (Math.abs(g) < 1.0 ? '1' : '2') : '3';

            const dbPath = `D:\\${st.station}\\2026\\${st.model}\\${vOverall ? 'pass' : 'fail'}\\DUT ${fullSN}.kdbx`;

            lines.push([
                '2026-10-16', timeStr, 'UTC+07:00', fullSN, `OP_${stIdx + 1}`, dbPath,
                vOverall, vResp, vThd, vRbz, vPol, vImp, grade,
                spl.toFixed(3), '103.79', '105.79', 'dB',
                re.toFixed(3),  '14.90',  '18.30',  'Ohm',
                fs.toFixed(2),  '93.50',  '126.50', 'Hz',
                qts.toFixed(3), '0.58',   '0.80',   '',
                imp.toFixed(2), '17.50',  '21.50',  'Ohm',
                rmse.toFixed(2),'0.00',   '2.50',   '%'
            ].join('\t'));

            // Add retest record for failed units on station 1
            if (isFail && stIdx === 0 && (i % 2 === 0)) {
                const rtTime = `${String(hh).padStart(2, '0')}:${String((mm + 2) % 60).padStart(2, '0')}:${String((ss + 15) % 60).padStart(2, '0')}:0`;
                lines.push([
                    '2026-10-16', rtTime, 'UTC+07:00', fullSN, `OP_${stIdx + 1}`, dbPath.replace('\\fail\\', '\\pass\\'),
                    1, 1, 1, 1, 1, 1, '1',
                    (104.78 + gaussRnd(seed + 99) * 0.18).toFixed(3), '103.79', '105.79', 'dB',
                    (16.58 + gaussRnd(seed + 105) * 0.25).toFixed(3), '14.90',  '18.30',  'Ohm',
                    (109.8 + gaussRnd(seed + 111) * 2.5).toFixed(2),  '93.50',  '126.50', 'Hz',
                    (0.682 + gaussRnd(seed + 117) * 0.018).toFixed(3),'0.58',   '0.80',   '',
                    (19.35 + gaussRnd(seed + 123) * 0.30).toFixed(2), '17.50',  '21.50',  'Ohm',
                    '1.04', '0.00', '2.50', '%'
                ].join('\t'));
            }
        }

        processSingleLogFile(lines.join('\n'), st.fileName, st.id);
    });

    const setupScr = document.getElementById('setup-screen');
    const mainScr = document.getElementById('main-app-screen');
    if (setupScr) setupScr.classList.add('hidden');
    if (mainScr) mainScr.classList.remove('hidden');

    applyFileFiltersAndRecalculate();

    // Seed sample Multi-Group Audit list if empty so user can test Multi-Group Audit immediately
    if (typeof loadDemoMultiGroupAudit === 'function' && (!auditState.groups || auditState.groups.length === 0)) {
        loadDemoMultiGroupAudit(true);
    } else if (typeof syncAuditWithKlippelLogs === 'function') {
        syncAuditWithKlippelLogs();
    }

    if (!silent) {
        showToast(_t('🧪 Đã nạp Bộ Dữ Liệu Mẫu Klippel QC (3 Trạm · 3 Ca · Đầy đủ Cpk & Multi-Group Audit)!'), 'success');
    }
}
