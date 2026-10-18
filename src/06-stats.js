/* ════════════ ĐỘNG CƠ TÍNH TOÁN KPI, PARETO, MA TRẬN, TƯƠNG QUAN & CPK V2 ════════════ */

/**
 * Áp dụng bộ lọc tệp/trạm đo và tính toán lại toàn bộ KPI, Pareto, Ma trận, Tương quan, Cpk
 */
function applyFileFiltersAndRecalculate() {
    // 1. Lọc tập bản ghi dữ liệu theo tệp kích hoạt
    if (currentActiveFileFilter === 'ALL') {
        filteredTimelineData = timelineData.filter(r => {
            const fInfo = loadedFilesMap.get(r.fileId);
            return fInfo ? fInfo.active : true;
        });
    } else {
        filteredTimelineData = timelineData.filter(r => r.fileId === currentActiveFileFilter);
    }

    // 2. Tính toán KPI & Pareto Lỗi
    calculateAnalysisKPIs();

    // 3. Tính toán Ma Trận Đa Lượt Đo (Multi-Run Matrix)
    calculateMatrixData();

    // 4. Tính toán Ma Trận Tương Quan Lỗi Chéo (Defect Co-occurrence Matrix)
    calculateCorrelationData();

    // 5. Tính toán Phân Tích Ca Kíp (Shift Analytics) & Diễn Biến Sản Xuất Đa Khung Giờ
    calculateShiftData();
    calculateProductionTimelineData();

    // 6. Tính toán So Sánh Năng Lực Trạm & Model (Benchmarking)
    calculateBenchmarkData();

    // 7. Tính toán Thống kê Thông số Đo & Năng lực Cpk
    calculateParametricCpkStats();

    // 8. Cập nhật giao diện toàn diện
    renderAllViews();
}

/**
 * Tính toán các chỉ số chất lượng FPY, Final Yield, Retest và Bảng Pareto Lỗi
 */
function calculateAnalysisKPIs() {
    analysisData = {
        rawRecordsCount: filteredTimelineData.length,
        uniqueUnitsCount: 0,
        passCount: 0,
        failCount: 0,
        fpy: 0,
        finalPassRate: 0,
        retestCount: 0,
        events: [],
        errorPareto: [],
        defectiveUnits: 0,
        totalDefects: 0,
        noTimestamp: false
    };

    if (filteredTimelineData.length === 0) return;

    // Kiểm tra tính sẵn sàng của cột thời gian
    const validTimeCount = filteredTimelineData.filter(r => r.timestamp !== null).length;
    if (validTimeCount === 0) {
        analysisData.noTimestamp = true;
    }

    // Gom nhóm theo DUT (Serial Number đối với hàng có seri, hoặc từng dòng độc lập với hàng không seri)
    const snGroups = new Map();
    filteredTimelineData.forEach(row => {
        const key = row.isNoSeri ? `UNIT_${row.cleanSN}_${row.timestamp ? row.timestamp.getTime() : Math.random()}` : row.cleanSN;
        if (!snGroups.has(key)) {
            snGroups.set(key, []);
        }
        snGroups.get(key).push(row);
    });

    const gapMs = currentGapThreshold * 60 * 1000;
    const eventsList = [];
    const errorMap = new Map(); // errKey -> count

    snGroups.forEach((records, cleanSN) => {
        records.sort((a, b) => (a.timestamp ? a.timestamp.getTime() : 0) - (b.timestamp ? b.timestamp.getTime() : 0));

        let currentEvent = null;
        records.forEach(rec => {
            if (!currentEvent) {
                currentEvent = {
                    sn: rec.displayID || cleanSN,
                    rawSN: rec.displayID || rec.rawSN,
                    records: [rec],
                    firstRun: rec,
                    lastRun: rec
                };
            } else {
                const prevTs = currentEvent.lastRun.timestamp ? currentEvent.lastRun.timestamp.getTime() : 0;
                const currTs = rec.timestamp ? rec.timestamp.getTime() : 0;

                if (currTs - prevTs > gapMs && gapMs > 0) {
                    eventsList.push(currentEvent);
                    currentEvent = {
                        sn: rec.displayID || cleanSN,
                        rawSN: rec.displayID || rec.rawSN,
                        records: [rec],
                        firstRun: rec,
                        lastRun: rec
                    };
                } else {
                    currentEvent.records.push(rec);
                    currentEvent.lastRun = rec;
                }
            }
        });

        if (currentEvent) {
            eventsList.push(currentEvent);
        }
    });

    analysisData.uniqueUnitsCount = eventsList.length;
    analysisData.events = eventsList;

    let fpyPassCount = 0;
    let finalPassCount = 0;

    eventsList.forEach(ev => {
        const isFirstPass = isRecordPass(ev.firstRun);
        const isLastPass = isRecordPass(ev.lastRun);

        if (isFirstPass) fpyPassCount++;
        if (isLastPass) {
            finalPassCount++;
            analysisData.passCount++;
        } else {
            analysisData.failCount++;
        }

        if (ev.records.length > 1) {
            analysisData.retestCount++;
        }

        // Đếm lỗi Pareto dựa trên lần đo cuối (Last Run)
        const activeErrs = activeErrors(ev.lastRun.errors);
        if (activeErrs.length > 0) {
            analysisData.defectiveUnits++;
            analysisData.totalDefects += activeErrs.length;

            const mapped = Array.from(new Set(activeErrs.map(e => getMappedName(e))));
            if (comboErrorMode) {
                const comboKey = mapped.slice().sort().join(' + ');
                errorMap.set(comboKey, (errorMap.get(comboKey) || 0) + 1);
            } else {
                mapped.forEach(err => {
                    errorMap.set(err, (errorMap.get(err) || 0) + 1);
                });
            }
        }
    });

    if (analysisData.uniqueUnitsCount > 0) {
        analysisData.fpy = (fpyPassCount / analysisData.uniqueUnitsCount) * 100;
        analysisData.finalPassRate = (finalPassCount / analysisData.uniqueUnitsCount) * 100;
    }

    // Tính toán bảng xếp hạng Pareto 80/20
    const paretoArr = [];
    errorMap.forEach((count, rawName) => {
        paretoArr.push({
            rawName: rawName,
            mappedName: getMappedName(rawName),
            count: count,
            pctOfDefects: analysisData.totalDefects > 0 ? (count / analysisData.totalDefects) * 100 : 0,
            pctOfUnits: analysisData.uniqueUnitsCount > 0 ? (count / analysisData.uniqueUnitsCount) * 100 : 0,
            cumPercent: 0
        });
    });

    paretoArr.sort((a, b) => b.count - a.count);

    let runningSum = 0;
    paretoArr.forEach(item => {
        runningSum += item.pctOfDefects;
        item.cumPercent = runningSum;
    });

    analysisData.errorPareto = paretoArr;
}

/**
 * Tính toán Ma Trận Đa Lượt Đo (Multi-Run Quality Matrix)
 */
function calculateMatrixData() {
    matrixData = {
        runs: [],
        rows: []
    };

    if (filteredTimelineData.length === 0) return;

    const activeFiles = Array.from(loadedFilesMap.values()).filter(f => f.active);
    if (activeFiles.length === 0) return;

    if (typeof extractModelFromFileName !== 'function') {
        var extractModelFromFileName = function(fn) {
            return (typeof extractModelFromDbOrFile === 'function')
                ? extractModelFromDbOrFile('', fn)
                : (fn || '').replace(/\.[^/.]+$/, '');
        };
    }

    matrixData.runs = activeFiles.map((f, idx) => {
        const model = f.modelName || (f.records && f.records[0] && f.records[0].modelName) || extractModelFromFileName(f.fileName);
        return {
            id: f.fileId,
            label: `${model ? ('Model ' + model) : f.fileName} · Trạm ${f.stationName} (${f.fileName})`,
            shortLabel: model ? `Model ${model}` : f.fileName,
            modelName: model || '',
            recordCount: f.recordCount,
            fileName: f.fileName,
            stationName: f.stationName
        };
    });

    const unitMap = new Map();

    analysisData.events.forEach(ev => {
        const sn = ev.sn;
        const rawSN = ev.rawSN || sn;
        const overallRun = matrixEvalMode === 'FIRST' ? ev.firstRun : ev.lastRun;

        const row = {
            sn: sn,
            rawSN: rawSN,
            finalVerdict: isRecordPass(overallRun),
            totalScans: ev.records.length,
            hasFail: false,
            hasChanged: false,
            runResults: {}
        };

        let lastVerdict = null;

        matrixData.runs.forEach(run => {
            const runRecords = ev.records.filter(r => r.fileId === run.id);
            if (runRecords.length > 0) {
                // Chọn kết quả Lần đầu hay Lần cuối theo cấu hình matrixEvalMode
                const targetRunRec = matrixEvalMode === 'FIRST' ? runRecords[0] : runRecords[runRecords.length - 1];
                const pass = isRecordPass(targetRunRec);
                const activeErrs = activeErrors(targetRunRec.errors);

                if (!pass || activeErrs.length > 0) {
                    row.hasFail = true;
                }

                if (lastVerdict !== null && lastVerdict !== pass) {
                    row.hasChanged = true;
                }
                lastVerdict = pass;

                row.runResults[run.id] = {
                    pass: pass,
                    errors: activeErrs.map(e => getMappedName(e)),
                    rawErrors: activeErrs,
                    count: runRecords.length,
                    timestamp: targetRunRec.timestamp ? targetRunRec.timestamp.toLocaleString() : '—',
                    stationName: targetRunRec.stationName,
                    modelName: targetRunRec.modelName || run.modelName,
                    fileName: targetRunRec.fileName,
                    recordId: targetRunRec.id,
                    metrics: targetRunRec.metrics || {}
                };
            } else {
                row.runResults[run.id] = null;
            }
        });

        unitMap.set(sn, row);
    });

    matrixData.rows = Array.from(unitMap.values());
}

/**
 * Tính toán Ma Trận Tương Quan Lỗi Chéo (Defect Co-occurrence Matrix)
 */
function calculateCorrelationData() {
    correlationData = {
        tasks: [],
        matrix: [],
        combos: []
    };

    if (analysisData.events.length === 0) return;

    // Lấy danh sách các task lỗi xuất hiện nhiều nhất (Top 10 task lỗi)
    const taskSet = new Set();
    analysisData.events.forEach(ev => {
        const errs = activeErrors(ev.lastRun.errors);
        errs.forEach(e => taskSet.add(e));
    });

    const tasks = Array.from(taskSet).slice(0, 12);
    if (tasks.length === 0) return;

    correlationData.tasks = tasks;
    const n = tasks.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    const comboMap = new Map();

    analysisData.events.forEach(ev => {
        const errs = activeErrors(ev.lastRun.errors);
        if (errs.length > 0) {
            // Đếm cho ma trận N x N
            for (let i = 0; i < n; i++) {
                if (errs.includes(tasks[i])) {
                    for (let j = 0; j < n; j++) {
                        if (errs.includes(tasks[j])) {
                            matrix[i][j]++;
                        }
                    }
                }
            }

            // Đếm combo lỗi nếu có > 1 lỗi
            if (errs.length > 1) {
                const comboKey = errs.map(getMappedName).sort().join(' + ');
                comboMap.set(comboKey, (comboMap.get(comboKey) || 0) + 1);
            }
        }
    });

    correlationData.matrix = matrix;

    const comboArr = [];
    comboMap.forEach((cnt, key) => {
        comboArr.push({
            comboKey: key,
            count: cnt,
            pct: analysisData.defectiveUnits > 0 ? (cnt / analysisData.defectiveUnits) * 100 : 0
        });
    });
    comboArr.sort((a, b) => b.count - a.count);
    correlationData.combos = comboArr.slice(0, 8);
}

/**
 * Tính toán Phân Tích Ca Kíp & Dữ Liệu Sản Lượng Theo Giờ (Shift & Hourly Analytics)
 */
function calculateShiftData() {
    // 1. Cấu hình Ca Sản Xuất động từ CFG
    const mode = CFG.SHIFT_MODE || '3_SHIFTS';
    let shiftList = [];

    if (mode === '2_SHIFTS') {
        shiftList = [
            { id: 'shift1', name: CFG.SHIFT_1_NAME || 'Ca Ngày (08:00 - 20:00)', start: CFG.SHIFT_1_START ?? 8, end: CFG.SHIFT_1_END ?? 20, total: 0, pass: 0, fail: 0, fpy: 0, errorMap: new Map() },
            { id: 'shift2', name: CFG.SHIFT_2_NAME || 'Ca Đêm (20:00 - 08:00)', start: CFG.SHIFT_2_START ?? 20, end: CFG.SHIFT_2_END ?? 8, total: 0, pass: 0, fail: 0, fpy: 0, errorMap: new Map() }
        ];
    } else {
        // Mặc định 3 Ca
        shiftList = [
            { id: 'shift1', name: CFG.SHIFT_1_NAME || 'Ca 1 (06:00 - 14:00)', start: CFG.SHIFT_1_START ?? 6, end: CFG.SHIFT_1_END ?? 14, total: 0, pass: 0, fail: 0, fpy: 0, errorMap: new Map() },
            { id: 'shift2', name: CFG.SHIFT_2_NAME || 'Ca 2 (14:00 - 22:00)', start: CFG.SHIFT_2_START ?? 14, end: CFG.SHIFT_2_END ?? 22, total: 0, pass: 0, fail: 0, fpy: 0, errorMap: new Map() },
            { id: 'shift3', name: CFG.SHIFT_3_NAME || 'Ca 3 (22:00 - 06:00)', start: CFG.SHIFT_3_START ?? 22, end: CFG.SHIFT_3_END ?? 6, total: 0, pass: 0, fail: 0, fpy: 0, errorMap: new Map() }
        ];
    }

    shiftData = {
        shifts: shiftList,
        hourlyTimeline: []
    };

    if (filteredTimelineData.length === 0 || analysisData.noTimestamp) return;

    // 2. Thống kê theo từng mốc thời gian giờ thực tế (Hourly Buckets)
    const hourlyMap = new Map(); // key: 'YYYY-MM-DD HH:00' -> { hourLabel, pass, fail, total, yieldRate }

    filteredTimelineData.forEach(r => {
        if (!r.timestamp) return;
        const h = r.timestamp.getHours();
        const dateStr = toLocalDateStr(r.timestamp);
        const hourKey = `${dateStr} ${String(h).padStart(2, '0')}:00`;

        if (!hourlyMap.has(hourKey)) {
            hourlyMap.set(hourKey, {
                hourKey: hourKey,
                hourLabel: `${String(h).padStart(2, '0')}:00`,
                dateStr: dateStr,
                hourNum: h,
                total: 0,
                pass: 0,
                fail: 0,
                yieldRate: 0
            });
        }

        const hObj = hourlyMap.get(hourKey);
        hObj.total++;
        const isPass = isRecordPass(r);
        if (isPass) hObj.pass++;
        else hObj.fail++;

        // Xác định ca
        let matchedShift = null;
        for (const s of shiftList) {
            if (s.start < s.end) {
                if (h >= s.start && h < s.end) { matchedShift = s; break; }
            } else {
                // Ca vắt qua nửa đêm (VD: 22:00 -> 06:00)
                if (h >= s.start || h < s.end) { matchedShift = s; break; }
            }
        }

        if (!matchedShift && shiftList.length > 0) matchedShift = shiftList[0];

        if (matchedShift) {
            matchedShift.total++;
            if (isPass) {
                matchedShift.pass++;
            } else {
                matchedShift.fail++;
                const actErrs = activeErrors(r.errors);
                actErrs.forEach(e => {
                    const name = getMappedName(e);
                    matchedShift.errorMap.set(name, (matchedShift.errorMap.get(name) || 0) + 1);
                });
            }
        }
    });

    // 3. Tính toán FPY và Top lỗi cho từng ca
    shiftList.forEach(s => {
        s.fpy = s.total > 0 ? (s.pass / s.total) * 100 : 0;
        const errArr = [];
        s.errorMap.forEach((count, name) => errArr.push({ name, count }));
        errArr.sort((a, b) => b.count - a.count);
        s.topErrors = errArr.slice(0, 3);
    });

    // 4. Sắp xếp chuỗi thời gian theo giờ
    const sortedHourly = Array.from(hourlyMap.values());
    sortedHourly.sort((a, b) => a.hourKey.localeCompare(b.hourKey));
    sortedHourly.forEach(item => {
        item.yieldRate = item.total > 0 ? (item.pass / item.total) * 100 : 0;
    });

    shiftData.hourlyTimeline = sortedHourly;
}

/**
 * Tính toán Chi Tiết Diễn Biến Sản Xuất & Chất Lượng Đa Khung Thời Gian
 * Hỗ trợ: 15p, 30p, 45p, 60p, 2h, 5h, 1 ngày, theo ca kíp
 * Bóc tách lỗi NG chi tiết và lọc theo 1 lỗi cụ thể
 */
function calculateProductionTimelineData() {
    const interval = currentProductionInterval || '60_MIN';
    const defectFilter = currentProductionDefectFilter || 'ALL';

    productionTimelineData = {
        interval: interval,
        defectFilter: defectFilter,
        buckets: [],
        summary: {
            total: 0,
            pass: 0,
            fail: 0,
            yieldRate: 0,
            ngRate: 0,
            filteredDefectCount: 0,
            filteredDefectRate: 0,
            peakBucket: null,
            worstBucket: null
        }
    };

    if (filteredTimelineData.length === 0 || analysisData.noTimestamp) return;

    const bucketMap = new Map();
    const shiftList = shiftData.shifts || [];

    filteredTimelineData.forEach(r => {
        if (!r.timestamp) return;

        const bucketMeta = getTimelineBucketMeta(r.timestamp, interval, shiftList);
        if (!bucketMap.has(bucketMeta.key)) {
            bucketMap.set(bucketMeta.key, {
                key: bucketMeta.key,
                label: bucketMeta.label,
                dateStr: bucketMeta.dateStr,
                sortKey: bucketMeta.sortKey,
                total: 0,
                pass: 0,
                fail: 0,
                yieldRate: 0,
                ngRate: 0,
                selectedDefectCount: 0,
                selectedDefectRate: 0,
                errorMap: new Map(),
                records: []
            });
        }

        const bucket = bucketMap.get(bucketMeta.key);
        bucket.total++;
        bucket.records.push(r);

        const isPass = isRecordPass(r);
        if (isPass) {
            bucket.pass++;
        } else {
            bucket.fail++;
            const actErrs = activeErrors(r.errors);
            actErrs.forEach(e => {
                bucket.errorMap.set(e, (bucket.errorMap.get(e) || 0) + 1);
            });
        }

        // Kiểm tra nếu bản ghi chứa lỗi được lọc
        if (defectFilter !== 'ALL') {
            const hasTargetError = r.errors && r.errors.some(e => e === defectFilter || getMappedName(e) === defectFilter);
            if (hasTargetError) {
                bucket.selectedDefectCount++;
            }
        }
    });

    // Chuyển Map thành mảng và sắp xếp thời gian tăng dần
    const bucketsArr = Array.from(bucketMap.values());
    bucketsArr.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let maxYield = -1;
    let minYield = 101;
    let peakB = null;
    let worstB = null;

    bucketsArr.forEach(b => {
        b.yieldRate = b.total > 0 ? (b.pass / b.total) * 100 : 0;
        b.ngRate = b.total > 0 ? (b.fail / b.total) * 100 : 0;
        b.selectedDefectRate = b.total > 0 ? (b.selectedDefectCount / b.total) * 100 : 0;

        // Bóc tách danh sách lỗi cụ thể trong bucket
        const errorArr = [];
        b.errorMap.forEach((count, rawName) => {
            errorArr.push({
                rawName: rawName,
                mappedName: getMappedName(rawName),
                count: count,
                pctInBucket: b.fail > 0 ? (count / b.fail) * 100 : 0,
                pctOfTotal: b.total > 0 ? (count / b.total) * 100 : 0
            });
        });
        errorArr.sort((a, b) => b.count - a.count);
        b.errorBreakdown = errorArr;
        b.topError = errorArr.length > 0 ? errorArr[0] : null;

        // Cập nhật summary
        productionTimelineData.summary.total += b.total;
        productionTimelineData.summary.pass += b.pass;
        productionTimelineData.summary.fail += b.fail;
        productionTimelineData.summary.filteredDefectCount += b.selectedDefectCount;

        if (b.total >= 3) {
            if (b.yieldRate > maxYield) { maxYield = b.yieldRate; peakB = b; }
            if (b.yieldRate < minYield) { minYield = b.yieldRate; worstB = b; }
        }
    });

    const sum = productionTimelineData.summary;
    sum.yieldRate = sum.total > 0 ? (sum.pass / sum.total) * 100 : 0;
    sum.ngRate = sum.total > 0 ? (sum.fail / sum.total) * 100 : 0;
    sum.filteredDefectRate = sum.total > 0 ? (sum.filteredDefectCount / sum.total) * 100 : 0;
    sum.peakBucket = peakB;
    sum.worstBucket = worstB;

    productionTimelineData.buckets = bucketsArr;
}

/**
 * Trả về key, nhãn và khóa sắp xếp theo khung thời gian yêu cầu
 */
function getTimelineBucketMeta(ts, interval, shiftList) {
    const dateStr = toLocalDateStr(ts);
    const h = ts.getHours();
    const m = ts.getMinutes();

    if (interval === '15_MIN') {
        const binM = Math.floor(m / 15) * 15;
        const nextM = binM + 15;
        const endH = nextM >= 60 ? (h + 1) % 24 : h;
        const endM = nextM >= 60 ? 0 : nextM;
        const startStr = `${String(h).padStart(2, '0')}:${String(binM).padStart(2, '0')}`;
        const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        return {
            key: `${dateStr} ${startStr}`,
            sortKey: `${dateStr} ${startStr}`,
            label: `${startStr} - ${endStr}`,
            dateStr
        };
    }

    if (interval === '30_MIN') {
        const binM = Math.floor(m / 30) * 30;
        const nextM = binM + 30;
        const endH = nextM >= 60 ? (h + 1) % 24 : h;
        const endM = nextM >= 60 ? 0 : nextM;
        const startStr = `${String(h).padStart(2, '0')}:${String(binM).padStart(2, '0')}`;
        const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        return {
            key: `${dateStr} ${startStr}`,
            sortKey: `${dateStr} ${startStr}`,
            label: `${startStr} - ${endStr}`,
            dateStr
        };
    }

    if (interval === '45_MIN') {
        const totalM = h * 60 + m;
        const binIdx = Math.floor(totalM / 45);
        const startTot = binIdx * 45;
        const endTot = startTot + 45;
        const startH = Math.floor(startTot / 60) % 24;
        const startM = startTot % 60;
        const endH = Math.floor(endTot / 60) % 24;
        const endM = endTot % 60;
        const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
        const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        return {
            key: `${dateStr} ${startStr}`,
            sortKey: `${dateStr} ${startStr}`,
            label: `${startStr} - ${endStr}`,
            dateStr
        };
    }

    if (interval === '2_HOUR') {
        const binH = Math.floor(h / 2) * 2;
        const endH = (binH + 2) % 24;
        const startStr = `${String(binH).padStart(2, '0')}:00`;
        const endStr = `${String(endH).padStart(2, '0')}:00`;
        return {
            key: `${dateStr} ${startStr}`,
            sortKey: `${dateStr} ${startStr}`,
            label: `${startStr} - ${endStr}`,
            dateStr
        };
    }

    if (interval === '5_HOUR') {
        const binH = Math.floor(h / 5) * 5;
        const endH = (binH + 5) % 24;
        const startStr = `${String(binH).padStart(2, '0')}:00`;
        const endStr = `${String(endH).padStart(2, '0')}:00`;
        return {
            key: `${dateStr} ${startStr}`,
            sortKey: `${dateStr} ${startStr}`,
            label: `${startStr} - ${endStr}`,
            dateStr
        };
    }

    if (interval === '1_DAY') {
        return {
            key: dateStr,
            sortKey: dateStr,
            label: `Ngày ${dateStr}`,
            dateStr
        };
    }

    if (interval === 'SHIFT') {
        let matchedShift = shiftList[0] || { id: 'shift1', name: 'Ca 1', start: 6, end: 14 };
        for (const s of shiftList) {
            if (s.start < s.end) {
                if (h >= s.start && h < s.end) { matchedShift = s; break; }
            } else {
                if (h >= s.start || h < s.end) { matchedShift = s; break; }
            }
        }
        return {
            key: `${dateStr} ${matchedShift.id}`,
            sortKey: `${dateStr} ${String(matchedShift.start).padStart(2, '0')}`,
            label: `${matchedShift.name} (${dateStr})`,
            dateStr
        };
    }

    // Mặc định: 60_MIN (1 Giờ)
    const startStr = `${String(h).padStart(2, '0')}:00`;
    const endStr = `${String((h + 1) % 24).padStart(2, '0')}:00`;
    return {
        key: `${dateStr} ${startStr}`,
        sortKey: `${dateStr} ${startStr}`,
        label: `${startStr} - ${endStr}`,
        dateStr
    };
}

/**
 * Tính toán So Sánh Năng Lực Trạm Đo & Model
 */
function calculateBenchmarkData() {
    benchmarkData = {
        stations: [],
        models: []
    };

    if (filteredTimelineData.length === 0) return;

    // 1. Phân nhóm theo trạm đo
    const stMap = new Map();
    filteredTimelineData.forEach(r => {
        const st = r.stationName || 'Station_Unknown';
        if (!stMap.has(st)) {
            stMap.set(st, { stationName: st, total: 0, pass: 0, fail: 0, passRate: 0, errorMap: new Map() });
        }
        const obj = stMap.get(st);
        obj.total++;
        if (isRecordPass(r)) {
            obj.pass++;
        } else {
            obj.fail++;
            activeErrors(r.errors).forEach(e => {
                const name = getMappedName(e);
                obj.errorMap.set(name, (obj.errorMap.get(name) || 0) + 1);
            });
        }
    });

    stMap.forEach(obj => {
        obj.passRate = obj.total > 0 ? (obj.pass / obj.total) * 100 : 0;
        const errArr = [];
        obj.errorMap.forEach((count, name) => errArr.push({ name, count }));
        errArr.sort((a, b) => b.count - a.count);
        obj.topErrors = errArr.slice(0, 3);
        benchmarkData.stations.push(obj);
    });

    // 2. Phân nhóm theo Model
    const mdMap = new Map();
    filteredTimelineData.forEach(r => {
        const md = r.modelName || 'UNKNOWN_MODEL';
        if (!mdMap.has(md)) {
            mdMap.set(md, { modelName: md, total: 0, pass: 0, fail: 0, passRate: 0, errorMap: new Map() });
        }
        const obj = mdMap.get(md);
        obj.total++;
        if (isRecordPass(r)) {
            obj.pass++;
        } else {
            obj.fail++;
            activeErrors(r.errors).forEach(e => {
                const name = getMappedName(e);
                obj.errorMap.set(name, (obj.errorMap.get(name) || 0) + 1);
            });
        }
    });

    mdMap.forEach(obj => {
        obj.passRate = obj.total > 0 ? (obj.pass / obj.total) * 100 : 0;
        const errArr = [];
        obj.errorMap.forEach((count, name) => errArr.push({ name, count }));
        errArr.sort((a, b) => b.count - a.count);
        obj.topErrors = errArr.slice(0, 3);
        benchmarkData.models.push(obj);
    });
}

/**
 * Tính toán Năng lực Quy trình Cpk cho toàn bộ thông số đo liên tục (Chuẩn SPC Klippel QC & 6-Sigma)
 */
function calculateParametricCpkStats() {
    parametricAnalysisMap.clear();

    allKnownMetrics.forEach((mMeta, metricKey) => {
        const allValues = [];
        const passValues = [];
        const recordsWithVal = [];

        filteredTimelineData.forEach(r => {
            if (r.metrics && r.metrics[metricKey] && r.metrics[metricKey].value !== null && !isNaN(r.metrics[metricKey].value)) {
                const val = r.metrics[metricKey].value;
                allValues.push(val);
                if (isRecordPass(r)) {
                    passValues.push(val);
                }
                recordsWithVal.push({ val, record: r });
            }
        });

        if (allValues.length === 0) return;

        // Chọn tập giá trị theo bộ lọc dữ liệu Cpk (Mặc định: 'PASS_ONLY' chuẩn SPC để đánh giá đúng năng lực biến thiên tự nhiên)
        const filterMode = CFG.CPK_DATA_FILTER || 'PASS_ONLY';
        let selectedValues = allValues;

        if (filterMode === 'PASS_ONLY' && passValues.length >= 3) {
            selectedValues = passValues;
        } else if (filterMode === 'TRIMMED_3SIGMA' && allValues.length >= 6) {
            const rawMean = calcMean(allValues);
            const rawStd = calcStdDev(allValues, rawMean);
            if (rawStd > 0) {
                selectedValues = allValues.filter(v => Math.abs(v - rawMean) <= 3 * rawStd);
            }
            if (selectedValues.length < 3) selectedValues = allValues;
        }

        // Tính Cpk trên tập dữ liệu đã chọn
        const stats = calcCpk(selectedValues, mMeta.minLimit, mMeta.maxLimit);

        // Tính Ppk trên toàn bộ sản phẩm thực tế (Bao gồm cả hàng lỗi)
        const overallStats = calcCpk(allValues, mMeta.minLimit, mMeta.maxLimit);

        // Tính độ lệch tâm k (Process Off-center index)
        let kFactor = null;
        if (mMeta.minLimit !== null && mMeta.maxLimit !== null && (mMeta.maxLimit - mMeta.minLimit) > 0) {
            const center = (mMeta.minLimit + mMeta.maxLimit) / 2;
            const halfTol = (mMeta.maxLimit - mMeta.minLimit) / 2;
            kFactor = Math.abs(stats.mean - center) / halfTol;
        }

        const nearFailList = [];

        if (mMeta.minLimit !== null || mMeta.maxLimit !== null) {
            const lsl = mMeta.minLimit;
            const usl = mMeta.maxLimit;
            const range = (usl !== null && lsl !== null) ? (usl - lsl) : ((usl || lsl || 10) * 0.2);
            const margin = range * (CFG.NEAR_FAIL_MARGIN_PCT / 100);

            recordsWithVal.forEach(item => {
                const val = item.val;
                const r = item.record;
                let isNear = false;
                let nearLimit = '';

                if (lsl !== null && val >= lsl && (val - lsl) <= margin) {
                    isNear = true;
                    nearLimit = `LSL (${lsl})`;
                } else if (usl !== null && val <= usl && (usl - val) <= margin) {
                    isNear = true;
                    nearLimit = `USL (${usl})`;
                }

                if (isNear) {
                    nearFailList.push({
                        record: r,
                        serialNo: r.serialNo || r.cleanSN,
                        displayID: r.displayID || r.rawSN,
                        value: val,
                        nearLimit: nearLimit,
                        stationName: r.stationName,
                        timestamp: r.timestamp
                    });
                }
            });
        }

        const hist = computeHistogram(selectedValues, CFG.HISTOGRAM_BINS_COUNT || 16, mMeta.minLimit, mMeta.maxLimit);

        parametricAnalysisMap.set(metricKey, {
            key: metricKey,
            name: mMeta.metricName,
            condition: mMeta.condition,
            unit: mMeta.unit,
            lsl: mMeta.minLimit,
            usl: mMeta.maxLimit,
            filterMode: filterMode,
            count: stats.n,
            totalCount: allValues.length,
            passCount: passValues.length,
            mean: stats.mean,
            stdDev: stats.stdDev,
            min: stats.min,
            max: stats.max,
            cp: stats.cp,
            cpk: stats.cpk,
            cpl: stats.cpl,
            cpu: stats.cpu,
            pp: overallStats.cp,
            ppk: overallStats.cpk,
            kFactor: kFactor,
            histogram: hist,
            nearFailList: nearFailList
        });
    });

    if (!currentSelectedMetric && parametricAnalysisMap.size > 0) {
        currentSelectedMetric = parametricAnalysisMap.keys().next().value;
    }
}
