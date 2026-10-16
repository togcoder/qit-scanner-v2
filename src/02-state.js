/* ════════════ QUẢN LÝ TRẠNG THÁI TRUNG TÂM V2 PRO ════════════ */
let filesToLoad = [];
let loadedFilesMap = new Map(); // fileId -> { fileId, fileName, stationName, recordCount, active: true, schema, records }

// Lookup Index Tables
let dictLookupClean = new Map();  // fullCleanKey -> record
let dictLookupSeri = new Map();   // pureSerialKey -> record
let dictLookupModel = new Map();  // modelKey -> Array<record>
let timelineData = [];            // Toàn bộ bản ghi đo thô thu thập được
let filteredTimelineData = [];    // Bản ghi sau khi áp dụng bộ lọc tệp/trạm

let uniqueErrorsInFile = new Set();
let allKnownErrors = new Set();
let allKnownMetrics = new Map();  // metricKey -> { metricName, condition, unit, minLimit, maxLimit, sampleCount }

let totalLinesParsed = 0;
let parseWarnings = [];

// Persisted user configurations
let errorAliases = (function() { try { return JSON.parse(localStorage.getItem(LS.ALIASES)) || {}; } catch(e) { return {}; } })();
let hiddenErrors = (function() { try { return JSON.parse(localStorage.getItem(LS.HIDDEN)) || {}; } catch(e) { return {}; } })();
let scanHistory = (function() { try { return JSON.parse(localStorage.getItem(LS.HISTORY)) || []; } catch(e) { return []; } })();
let comboErrorMode = (function() { try { return JSON.parse(localStorage.getItem(LS.COMBO)) || false; } catch(e) { return false; } })();
let audioMuted = (function() { try { return JSON.parse(localStorage.getItem(LS.MUTED)) || false; } catch(e) { return false; } })();
let audioVolume = (function () {
    try {
        const v = parseFloat(localStorage.getItem(LS.VOLUME));
        return isNaN(v) ? 1.3 : v;
    } catch(e) {
        return 1.3;
    }
})();
let flagZones = (function() { try { return JSON.parse(localStorage.getItem(LS.FLAGS)) || []; } catch(e) { return []; } })();

// Robot Lifetime persistence
let robotLifetimeStats = (function() {
    try {
        const saved = JSON.parse(localStorage.getItem('qit_robot_lifetime_stats_v2'));
        if (saved && typeof saved === 'object') {
            return {
                total: saved.total || 0,
                pass: saved.pass || 0,
                fail: saved.fail || 0,
                nodata: saved.nodata || 0
            };
        }
    } catch(e) {}
    return { total: 0, pass: 0, fail: 0, nodata: 0 };
})();

function recordRobotStats(totalInc, passInc, failInc, nodataInc) {
    robotLifetimeStats.total += (totalInc || 0);
    robotLifetimeStats.pass += (passInc || 0);
    robotLifetimeStats.fail += (failInc || 0);
    robotLifetimeStats.nodata += (nodataInc || 0);
    try {
        localStorage.setItem('qit_robot_lifetime_stats_v2', JSON.stringify(robotLifetimeStats));
    } catch(e) {}
}

// Live Scan Session Metrics (Tách biệt với KPI tĩnh của file log)
let liveScanSession = {
    totalScans: 0,
    passScans: 0,
    failScans: 0,
    dupScans: 0,
    notFoundScans: 0,
    timestamps: [],
    historyFilter: 'ALL', // 'ALL' | 'PASS' | 'FAIL' | 'DUP' | 'NOT_FOUND'
    historySearch: '',
    stationFilter: 'ALL'
};

// Multi-Group Audit State (Kiểm soát đối soát danh sách theo từng Group độc lập)
let auditState = {
    groups: [],             // Array of { id, name, note, locked, createdAt, targetList, scannedCount, duplicateCount, strangerScans }
    activeGroupId: 'ALL',   // 'ALL' (Xem tổng hợp mọi Group) hoặc group.id cụ thể
    scanScope: CFG.AUDIT_SCAN_SCOPE || 'GLOBAL', // 'ACTIVE' (Chỉ quét trong Group đang mở) | 'GLOBAL' (Tự động định tuyến vào đúng Group)
    autoSwitchGroup: CFG.AUDIT_AUTO_SWITCH_GROUP !== false,
    warnOnKlippelFail: CFG.AUDIT_WARN_KLIPPEL_FAIL !== false,
    filterStatus: 'ALL',    // 'ALL' | 'SCANNED' | 'MISSING' | 'DUPLICATE' | 'KLIPPEL_FAIL' | 'NO_LOG'
    searchQuery: '',
    targetList: [],         // Danh sách mục tiêu phẳng (đồng bộ tự động cho tương thích ngược & hiển thị)
    scannedCount: 0,        // Số lượng mã mục tiêu đã quét khớp
    duplicateCount: 0,      // Tổng số lượt quét lặp lại
    strangerList: [],       // Danh sách mã lạ ngoài danh sách [{ time, rawScan, cleanScan, activeGroupName }]
    scanLog: []             // Nhật ký các lượt quét đối soát
};

let currentGapThreshold = CFG.GAP_THRESHOLD_MIN;
let currentActiveFileFilter = 'ALL'; // 'ALL' | fileId
let currentSelectedMetric = null;   // Metric key hiện đang xem trong tab Cpk

// Analysis & Cpk State
let analysisData = {
    rawRecordsCount: 0,
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

let matrixData = {
    runs: [],
    rows: []
};
let matrixEvalMode = 'LAST'; // 'LAST' (Lần cuối) | 'FIRST' (Lần đầu)

let correlationData = {
    tasks: [],      // Array of string task names
    matrix: [],     // 2D array matrix[i][j] = count
    combos: []      // Array of { comboKey, count, pct }
};

let currentProductionInterval = '60_MIN'; // '15_MIN' | '30_MIN' | '45_MIN' | '60_MIN' | '2_HOUR' | '5_HOUR' | '1_DAY' | 'SHIFT'
let currentProductionDefectFilter = 'ALL'; // 'ALL' | specific error rawName

let productionTimelineData = {
    interval: '60_MIN',
    defectFilter: 'ALL',
    buckets: [],
    summary: { total: 0, pass: 0, fail: 0, yieldRate: 0, peakBucket: null, worstBucket: null }
};

let shiftData = {
    shifts: [],
    hourlyTimeline: []
};

let benchmarkData = {
    stations: [],   // Array of { stationName, total, pass, fail, passRate, topErrors }
    models: []      // Array of { modelName, total, pass, fail, passRate, topErrors }
};

let parametricAnalysisMap = new Map(); // metricKey -> { mean, stdDev, min, max, lsl, usl, cp, cpk, cpl, cpu, histogram, nearFailList }

// Chart instances
let paretoChartInstance = null;
let histogramChartInstance = null;
let hourlyChartInstance = null;
let productionTimelineChartInstance = null;

function resetAllData() {
    loadedFilesMap.clear();
    dictLookupClean.clear();
    dictLookupSeri.clear();
    dictLookupModel.clear();
    timelineData = [];
    filteredTimelineData = [];
    uniqueErrorsInFile.clear();
    allKnownErrors.clear();
    allKnownMetrics.clear();
    totalLinesParsed = 0;
    parseWarnings = [];
    currentSelectedMetric = null;

    analysisData = {
        rawRecordsCount: 0,
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

    matrixData = {
        runs: [],
        rows: []
    };

    correlationData = {
        tasks: [],
        matrix: [],
        combos: []
    };

    shiftData = {
        shifts: [],
        hourlyTimeline: []
    };

    benchmarkData = {
        stations: [],
        models: []
    };

    parametricAnalysisMap.clear();

    if (paretoChartInstance) { paretoChartInstance.destroy(); paretoChartInstance = null; }
    if (histogramChartInstance) { histogramChartInstance.destroy(); histogramChartInstance = null; }
    if (hourlyChartInstance) { hourlyChartInstance.destroy(); hourlyChartInstance = null; }
    if (productionTimelineChartInstance) { productionTimelineChartInstance.destroy(); productionTimelineChartInstance = null; }
}
