/* ════════════ TIỆN ÍCH TOÁN HỌC, CHUỖI & NGÀY GIỜ V2 ════════════ */

/**
 * Chuẩn hóa chuỗi chỉ giữ chữ cái và số, viết hoa (Dùng cho tra cứu nhanh).
 */
function getAlphaNum(txt) {
    if (txt == null) return '';
    return String(txt).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Làm sạch chuỗi không mất dấu cấu trúc (Lossless ID sanitization):
 * Loại bỏ ký tự điều khiển ẩn, BOM, zero-width space, khoảng trắng đầu cuối,
 * nhưng GIỮ NGUYÊN dấu gạch nối, gạch dưới, chấm, gạch chéo hợp lệ.
 */
function sanitizeIdentifier(txt) {
    if (txt == null) return '';
    return String(txt)
        .replace(/[\u200B-\u200D\uFEFF\x00-\x1F\x7F]/g, '')
        .trim();
}

/**
 * Chuyển đổi dung lượng bytes sang chuỗi hiển thị
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Escape HTML chống XSS và bảo vệ layout khi hiển thị tên lỗi có ký tự đặc biệt
 */
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Trả về chuỗi ngày địa phương 'YYYY-MM-DD'
 */
function toLocalDateStr(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/**
 * Bộ phân tích Timestamp Klippel siêu việt (Hỗ trợ đa định dạng Date & Time):
 * - Date: YYYY-MM-DD, M/D/YYYY, DD/MM/YYYY, MM-DD-YYYY
 * - Time: HH:MM:SS:f (với :f là phần mười giây của Klippel), HH:MM:SS.mmm, HH:MM:SS
 * - UTC: UTC+07:00, UTC+0700, +07:00
 */
function parseLogTimestamp(dateStr, timeStr, utcStr) {
    if (!dateStr || !String(dateStr).trim()) return null;
    try {
        const dStr = String(dateStr).trim();
        let year, month, day;

        if (dStr.includes('-')) {
            const parts = dStr.split('-');
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10);
            } else {
                // MM-DD-YYYY
                month = parseInt(parts[0], 10) - 1;
                day = parseInt(parts[1], 10);
                year = parseInt(parts[2], 10);
            }
        } else if (dStr.includes('/')) {
            const parts = dStr.split('/');
            if (parts[2] && parts[2].length === 4) {
                // M/D/YYYY hoặc D/M/YYYY (Mặc định chuẩn US M/D/YYYY)
                month = parseInt(parts[0], 10) - 1;
                day = parseInt(parts[1], 10);
                year = parseInt(parts[2], 10);
            } else if (parts[0].length === 4) {
                // YYYY/MM/DD
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10);
            }
        }

        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

        // Parse Time: Klippel dùng 12:41:43:0 (hh:mm:ss:tenths)
        const tParts = String(timeStr || '00:00:00').trim().split(':');
        const hh = parseInt(tParts[0] || 0, 10);
        const mm = parseInt(tParts[1] || 0, 10);
        const ss = parseInt(tParts[2] || 0, 10);
        let ms = 0;
        if (tParts[3]) {
            const tenths = String(tParts[3]).trim();
            ms = parseInt(tenths.padEnd(3, '0').substring(0, 3), 10) || 0;
        }

        const dateObj = new Date(year, month, day, hh, mm, ss, ms);
        return isNaN(dateObj.getTime()) ? null : dateObj;
    } catch (e) {
        return null;
    }
}

/**
 * Kiểm tra xem một bản ghi có PASS thực tế hay không (xem xét cả lỗi bị ẩn)
 */
function isRecordPass(rec) {
    if (!rec) return false;
    const all = Array.isArray(rec.errors) ? rec.errors : Array.from(rec.errors || []);
    const visible = all.filter(isErrorVisible);
    if (visible.length > 0) return false;
    const hasHidden = all.length !== visible.length;
    return hasHidden ? true : (rec.verdictOverall === 1);
}

function isErrorVisible(errName) {
    return !hiddenErrors[errName];
}

function getMappedName(rawErr) {
    if (!rawErr) return '';
    return errorAliases[rawErr] || rawErr;
}

function activeErrors(errorsArray) {
    if (!errorsArray) return [];
    const arr = Array.isArray(errorsArray) ? errorsArray : Array.from(errorsArray);
    return arr.filter(isErrorVisible);
}

/* ════════════ TIỆN ÍCH THỐNG KÊ TOÁN HỌC & Cpk ════════════ */

/**
 * Tính toán trung bình (Mean)
 */
function calcMean(values) {
    if (!values || values.length === 0) return 0;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
}

/**
 * Tính toán độ lệch chuẩn mẫu (Sample Standard Deviation)
 */
function calcStdDev(values, mean) {
    if (!values || values.length < 2) return 0;
    const m = (typeof mean === 'number') ? mean : calcMean(values);
    const sumSq = values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0);
    return Math.sqrt(sumSq / (values.length - 1));
}

/**
 * Tính chỉ số năng lực quy trình Cp, Cpk, Cpl, Cpu
 */
function calcProcessCapability(values, lsl, usl) {
    if (!values || values.length < 3) {
        return { n: values ? values.length : 0, mean: 0, stdDev: 0, min: 0, max: 0, cp: null, cpk: null, cpl: null, cpu: null };
    }

    const mean = calcMean(values);
    const stdDev = calcStdDev(values, mean);
    let min = Infinity, max = -Infinity;
    values.forEach(v => {
        if (v < min) min = v;
        if (v > max) max = v;
    });

    let cp = null, cpl = null, cpu = null, cpk = null;

    if (stdDev > 0) {
        if (typeof lsl === 'number' && !isNaN(lsl) && typeof usl === 'number' && !isNaN(usl)) {
            cp = (usl - lsl) / (6 * stdDev);
            cpl = (mean - lsl) / (3 * stdDev);
            cpu = (usl - mean) / (3 * stdDev);
            cpk = Math.min(cpl, cpu);
        } else if (typeof lsl === 'number' && !isNaN(lsl)) {
            cpl = (mean - lsl) / (3 * stdDev);
            cpk = cpl;
        } else if (typeof usl === 'number' && !isNaN(usl)) {
            cpu = (usl - mean) / (3 * stdDev);
            cpk = cpu;
        }
    }

    return {
        n: values.length,
        mean,
        stdDev,
        min,
        max,
        cp,
        cpk,
        cpl,
        cpu
    };
}

const calcCpk = calcProcessCapability;

/**
 * Hàm mật độ xác suất Gauss (Normal Probability Density Function)
 */
function normalPdf(x, mean, stdDev) {
    if (stdDev <= 0) return 0;
    const factor = 1 / (stdDev * Math.sqrt(2 * Math.PI));
    const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
    return factor * Math.exp(exponent);
}

/**
 * Tạo các khoảng Bin cho biểu đồ Histogram
 */
function createHistogramBins(values, binCount = 15, lsl = null, usl = null) {
    if (!values || values.length === 0) return { bins: [], labels: [], counts: [] };

    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    if (typeof lsl === 'number' && !isNaN(lsl)) minVal = Math.min(minVal, lsl);
    if (typeof usl === 'number' && !isNaN(usl)) maxVal = Math.max(maxVal, usl);

    const span = maxVal - minVal;
    const padding = span > 0 ? span * 0.05 : 1;
    const plotMin = minVal - padding;
    const plotMax = maxVal + padding;
    const binWidth = (plotMax - plotMin) / binCount;

    const bins = [];
    const labels = [];
    const counts = new Array(binCount).fill(0);

    for (let i = 0; i < binCount; i++) {
        const binStart = plotMin + i * binWidth;
        const binEnd = binStart + binWidth;
        const binMid = (binStart + binEnd) / 2;
        bins.push({ start: binStart, end: binEnd, mid: binMid });
        labels.push(binMid >= 100 ? binMid.toFixed(1) : (binMid >= 1 ? binMid.toFixed(2) : binMid.toExponential(2)));
    }

    values.forEach(v => {
        let idx = Math.floor((v - plotMin) / binWidth);
        if (idx < 0) idx = 0;
        if (idx >= binCount) idx = binCount - 1;
        counts[idx]++;
    });

    return { bins, labels, counts, binWidth, plotMin, plotMax };
}

const computeHistogram = createHistogramBins;
