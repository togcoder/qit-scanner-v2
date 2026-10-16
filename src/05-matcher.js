/* ════════════ THUẬT TOÁN ĐỐI SOÁT & TÌM KIẾM MÃ VẠCH V2 PRO ════════════ */

var MATCH_TIER = { EXACT: 100, SUFFIX: 80, PREFIX: 60, CONTAINS: 40, REVERSE: 20 };
var MATCH_TIER_NAME = {
    100: 'Tầng 1 · Trùng khớp tuyệt đối (Exact)',
    80:  'Tầng 2 · Khớp hậu tố Serial (Suffix)',
    60:  'Tầng 3 · Khớp tiền tố (Prefix)',
    40:  'Tầng 3 · Chứa chuỗi con (Substring)',
    20:  'Tầng 3 · Khớp ngược (Reverse)'
};

/**
 * Tiền xử lý chuỗi quét theo cấu hình CFG (cắt khoảng trắng, lọc tiền tố/hậu tố cố định)
 */
function preprocessRawScan(rawScan) {
    if (rawScan == null) return '';
    let s = String(rawScan);
    if (CFG.TRIM_SCAN_WHITESPACE !== false) {
        s = s.trim();
    }
    if (CFG.AUTO_TRIM_PREFIX) {
        const pfx = String(CFG.AUTO_TRIM_PREFIX).trim();
        if (pfx && s.toUpperCase().startsWith(pfx.toUpperCase())) {
            s = s.slice(pfx.length).trim();
        }
    }
    if (CFG.AUTO_TRIM_SUFFIX) {
        const sfx = String(CFG.AUTO_TRIM_SUFFIX).trim();
        if (sfx && s.toUpperCase().endsWith(sfx.toUpperCase())) {
            s = s.slice(0, s.length - sfx.length).trim();
        }
    }
    return s;
}

/**
 * Chấm điểm độ khớp giữa mã quét và ID mục tiêu
 */
function scoreMatch(scan, id) {
    if (!scan || !id) return 0;
    if (scan === id)             return MATCH_TIER.EXACT;
    if (scan.endsWith(id))       return MATCH_TIER.SUFFIX;
    if (id.endsWith(scan) && scan.length >= CFG.MIN_SCAN_LEN) return MATCH_TIER.SUFFIX;
    if (scan.startsWith(id))     return MATCH_TIER.PREFIX;
    if (scan.indexOf(id) !== -1) return MATCH_TIER.CONTAINS;
    if (CFG.ALLOW_REVERSE_MATCH && id.indexOf(scan) !== -1) {
        if (scan.length / id.length >= CFG.REVERSE_MIN_RATIO) return MATCH_TIER.REVERSE;
    }
    return 0;
}

/**
 * Tìm tất cả các bản ghi lịch sử đo của một sản phẩm (phục vụ truy vết Retest & Đa trạm)
 */
function findAllRecordsForDUT(record) {
    if (!record) return [];
    const targetClean = record.cleanSN;
    const targetSeri = record.cleanSeri;
    const pool = (filteredTimelineData && filteredTimelineData.length > 0) ? filteredTimelineData : timelineData;
    return pool.filter(r =>
        (targetClean && r.cleanSN === targetClean) ||
        (targetSeri && targetSeri.length >= 4 && r.cleanSeri === targetSeri)
    ).sort((a, b) => (a.timestamp ? a.timestamp.getTime() : 0) - (b.timestamp ? b.timestamp.getTime() : 0));
}

/**
 * Tìm kiếm bản ghi đo từ chuỗi quét mã vạch (Tra cứu Multi-Index 3 Tầng O(1))
 */
function findRecordByBarcode(rawScan, stationFilter) {
    if (!rawScan || !String(rawScan).trim()) return null;

    const processed = preprocessRawScan(rawScan);
    const cleanScan = getAlphaNum(processed);
    if (!cleanScan || cleanScan.length < CFG.MIN_SCAN_LEN) return null;

    const stFilter = stationFilter || (typeof liveScanSession !== 'undefined' ? liveScanSession.stationFilter : 'ALL') || 'ALL';
    const matchMode = CFG.SCAN_MATCH_MODE || 'flex';

    // Nếu lọc theo trạm cụ thể, tìm trong tập bản ghi của trạm đó
    if (stFilter && stFilter !== 'ALL') {
        const pool = ((filteredTimelineData && filteredTimelineData.length > 0) ? filteredTimelineData : timelineData)
            .filter(r => r.stationName === stFilter);
        for (let i = pool.length - 1; i >= 0; i--) {
            const rec = pool[i];
            if (rec.cleanSN === cleanScan) {
                return { record: rec, matchType: 'EXACT_FULL', tier: MATCH_TIER.EXACT, tierName: MATCH_TIER_NAME[100], allRecords: findAllRecordsForDUT(rec) };
            }
            if (rec.cleanSeri === cleanScan) {
                return { record: rec, matchType: 'EXACT_SERIAL', tier: MATCH_TIER.SUFFIX, tierName: MATCH_TIER_NAME[80], allRecords: findAllRecordsForDUT(rec) };
            }
        }
        if (matchMode !== 'exact') {
            for (let i = pool.length - 1; i >= 0; i--) {
                const rec = pool[i];
                const tier = scoreMatch(cleanScan, rec.cleanSN);
                if (tier > 0) {
                    return { record: rec, matchType: 'FUZZY_MATCH', tier: tier, tierName: MATCH_TIER_NAME[tier] || 'Khớp mở rộng', allRecords: findAllRecordsForDUT(rec) };
                }
            }
        }
        return null;
    }

    // 1. Tầng 1: Tìm trực tiếp theo Full Clean Key O(1)
    if (dictLookupClean.has(cleanScan)) {
        const rec = dictLookupClean.get(cleanScan);
        return {
            record: rec,
            matchType: 'EXACT_FULL',
            tier: MATCH_TIER.EXACT,
            tierName: MATCH_TIER_NAME[100],
            allRecords: findAllRecordsForDUT(rec)
        };
    }

    // 2. Tầng 2: Tìm theo Pure Serial Number Key O(1)
    if (dictLookupSeri.has(cleanScan)) {
        const rec = dictLookupSeri.get(cleanScan);
        return {
            record: rec,
            matchType: 'EXACT_SERIAL',
            tier: MATCH_TIER.EXACT,
            tierName: MATCH_TIER_NAME[80],
            allRecords: findAllRecordsForDUT(rec)
        };
    }

    if (matchMode === 'exact') return null;

    // 3. Tầng 3: Quét khớp theo hậu tố / chứa chuỗi trong dictLookupClean
    for (let [key, rec] of dictLookupClean.entries()) {
        const tier = scoreMatch(cleanScan, key);
        if (tier > 0) {
            return {
                record: rec,
                matchType: 'FUZZY_MATCH',
                tier: tier,
                tierName: MATCH_TIER_NAME[tier] || 'Khớp chuỗi con',
                allRecords: findAllRecordsForDUT(rec)
            };
        }
    }

    return null;
}

/**
 * Đối soát mã quét với danh sách kiểm tra (Audit Target List)
 */
function matchScanToTargets(rawScan, targets, mode) {
    const processed = preprocessRawScan(rawScan || '');
    const cleanScan = getAlphaNum(processed);
    const out = { result: 'NO_MATCH', cleanScan, best: null, tier: 0, tierName: '', candidates: [] };

    if (!targets || targets.length === 0) { out.result = 'NO_LIST'; return out; }
    if (cleanScan.length < CFG.MIN_SCAN_LEN) { out.result = 'REJECT_TOO_SHORT'; return out; }

    const candidates = [];
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t.cleanId) continue;
        let tier = 0;
        if (mode === 'exact') {
            tier = (cleanScan === t.cleanId || (t.cleanSeri && cleanScan === t.cleanSeri)) ? MATCH_TIER.EXACT : 0;
        } else {
            tier = scoreMatch(cleanScan, t.cleanId);
            if (tier < MATCH_TIER.SUFFIX && t.cleanSeri && cleanScan === t.cleanSeri) {
                tier = MATCH_TIER.SUFFIX;
            }
        }
        if (tier > 0) candidates.push({ item: t, tier: tier, len: t.cleanId.length });
    }

    if (candidates.length === 0) return out;

    // Sắp xếp: bậc cao trước → ID dài trước → ít lượt quét trước → thứ tự trong list
    candidates.sort(function (a, b) {
        if (b.tier !== a.tier) return b.tier - a.tier;
        if (b.len  !== a.len)  return b.len  - a.len;
        const sa = a.item.scanCount || 0, sb = b.item.scanCount || 0;
        if (sa !== sb) return sa - sb;
        return a.item.index - b.item.index;
    });

    out.candidates = candidates;
    const top = candidates[0];

    // Nhập nhằng: có ứng viên KHÁC ID NGANG HÀNG hoàn toàn
    const tie = candidates.filter(function (c) {
        return c.tier === top.tier &&
               c.len === top.len &&
               (c.item.scanCount || 0) === (top.item.scanCount || 0) &&
               c.item.cleanId !== top.item.cleanId;
    });

    if (tie.length > 0) {
        const allTies = candidates.filter(function (c) {
            return c.tier === top.tier && c.len === top.len && (c.item.scanCount || 0) === (top.item.scanCount || 0);
        });
        out.result = 'AMBIGUOUS';
        out.candidates = allTies;
        return out;
    }

    out.result   = 'MATCH';
    out.best     = top.item;
    out.tier     = top.tier;
    out.tierName = MATCH_TIER_NAME[top.tier] || '';
    return out;
}
