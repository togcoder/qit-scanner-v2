/* ════════════ THUẬT TOÁN ĐỐI SOÁT & TÌM KIẾM MÃ VẠCH V2 ════════════ */

var MATCH_TIER = { EXACT: 100, SUFFIX: 80, PREFIX: 60, CONTAINS: 40, REVERSE: 20 };
var MATCH_TIER_NAME = {
    100: 'Trùng khớp tuyệt đối',
    80: 'Khớp hậu tố (Suffix)',
    60: 'Khớp tiền tố (Prefix)',
    40: 'Chứa chuỗi (Contains)',
    20: 'Khớp ngược (Reverse)'
};

/**
 * Chấm điểm độ khớp giữa mã quét và ID mục tiêu
 */
function scoreMatch(scan, id) {
    if (!scan || !id) return 0;
    if (scan === id)             return MATCH_TIER.EXACT;
    if (scan.endsWith(id))       return MATCH_TIER.SUFFIX;
    if (scan.startsWith(id))     return MATCH_TIER.PREFIX;
    if (scan.indexOf(id) !== -1) return MATCH_TIER.CONTAINS;
    if (CFG.ALLOW_REVERSE_MATCH && id.indexOf(scan) !== -1) {
        if (scan.length / id.length >= CFG.REVERSE_MIN_RATIO) return MATCH_TIER.REVERSE;
    }
    return 0;
}

/**
 * Tìm kiếm bản ghi đo từ chuỗi quét mã vạch (Tra cứu Multi-Index nhanh)
 */
function findRecordByBarcode(rawScan) {
    if (!rawScan || !rawScan.trim()) return null;

    const cleanScan = getAlphaNum(rawScan);
    if (!cleanScan || cleanScan.length < CFG.MIN_SCAN_LEN) return null;

    // 1. Tìm trực tiếp theo Full Clean Key
    if (dictLookupClean.has(cleanScan)) {
        return {
            record: dictLookupClean.get(cleanScan),
            matchType: 'EXACT_FULL',
            tier: MATCH_TIER.EXACT
        };
    }

    // 2. Tìm theo Pure Serial Number Key
    if (dictLookupSeri.has(cleanScan)) {
        return {
            record: dictLookupSeri.get(cleanScan),
            matchType: 'EXACT_SERIAL',
            tier: MATCH_TIER.EXACT
        };
    }

    // 3. Quét khớp theo hậu tố / chứa chuỗi trong dictLookupClean
    for (let [key, rec] of dictLookupClean.entries()) {
        const tier = scoreMatch(cleanScan, key);
        if (tier > 0) {
            return {
                record: rec,
                matchType: 'FUZZY_MATCH',
                tier: tier
            };
        }
    }

    return null;
}

/**
 * Đối soát mã quét với danh sách kiểm tra (Audit Target List)
 */
function matchScanToTargets(rawScan, targets, mode) {
    const cleanScan = getAlphaNum(rawScan || '');
    const out = { result: 'NO_MATCH', cleanScan, best: null, tier: 0, tierName: '', candidates: [] };

    if (!targets || targets.length === 0) { out.result = 'NO_LIST'; return out; }
    if (cleanScan.length < CFG.MIN_SCAN_LEN) { out.result = 'REJECT_TOO_SHORT'; return out; }

    const candidates = [];
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t.cleanId) continue;
        let tier;
        if (mode === 'exact') {
            tier = (cleanScan === t.cleanId) ? MATCH_TIER.EXACT : 0;
        } else {
            tier = scoreMatch(cleanScan, t.cleanId);
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
