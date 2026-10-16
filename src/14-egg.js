/* ════════════ THỐNG KÊ TUỔI THỌ ROBOT & HIỆU ỨNG TƯƠNG TÁC V2 ════════════ */

function showRobotLifetimeStats() {
    const modal = document.getElementById('robot-stats-modal');
    if (!modal) return;

    const totalEl = document.getElementById('robot-stat-total');
    const passEl = document.getElementById('robot-stat-pass');
    const failEl = document.getElementById('robot-stat-fail');
    const nodataEl = document.getElementById('robot-stat-nodata');

    if (totalEl) totalEl.textContent = robotLifetimeStats.total.toLocaleString();
    if (passEl) passEl.textContent = robotLifetimeStats.pass.toLocaleString();
    if (failEl) failEl.textContent = robotLifetimeStats.fail.toLocaleString();
    if (nodataEl) nodataEl.textContent = robotLifetimeStats.nodata.toLocaleString();

    modal.classList.remove('hidden');
}

function closeRobotLifetimeModal() {
    const modal = document.getElementById('robot-stats-modal');
    if (modal) modal.classList.add('hidden');
}

function triggerConfetti() {
    if (!CFG.ENABLE_EASTER_EGGS || typeof confetti === 'undefined') return;
    try {
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
        });
    } catch(e) {}
}
