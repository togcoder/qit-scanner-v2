/* ════════════ QUẢN LÝ TRẠNG THÁI TRUNG TÂM V2 ════════════ */
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
let errorAliases = JSON.parse(localStorage.getItem(LS.ALIASES)) || {};
let hiddenErrors = JSON.parse(localStorage.getItem(LS.HIDDEN)) || {};
let scanHistory = JSON.parse(localStorage.getItem(LS.HISTORY)) || [];
let comboErrorMode = JSON.parse(localStorage.getItem(LS.COMBO)) || false;
let audioMuted = JSON.parse(localStorage.getItem(LS.MUTED)) || false;
let audioVolume = (function () {
    const v = parseFloat(localStorage.getItem(LS.VOLUME));
    return isNaN(v) ? 1.3 : v;
})();
let flagZones = JSON.parse(localStorage.getItem(LS.FLAGS)) || [];

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

// Audit state
let auditState = {
    targetList: [], // Array of { index, rawId, cleanId, scanCount, firstScanTime, lastScanTime, scans: [] }
    scannedCount: 0,
    scanLog: []
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
        shift1: { name: 'Ca 1 (06:00 - 14:00)', total: 0, pass: 0, fail: 0, fpy: 0, topErrors: [] },
        shift2: { name: 'Ca 2 (14:00 - 22:00)', total: 0, pass: 0, fail: 0, fpy: 0, topErrors: [] },
        shift3: { name: 'Ca 3 (22:00 - 06:00)', total: 0, pass: 0, fail: 0, fpy: 0, topErrors: [] }
    };

    benchmarkData = {
        stations: [],
        models: []
    };

    parametricAnalysisMap.clear();

    if (paretoChartInstance) { paretoChartInstance.destroy(); paretoChartInstance = null; }
    if (histogramChartInstance) { histogramChartInstance.destroy(); histogramChartInstance = null; }
    if (hourlyChartInstance) { hourlyChartInstance.destroy(); hourlyChartInstance = null; }
}
