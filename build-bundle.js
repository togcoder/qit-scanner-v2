/* ════════════ SCANNER V2 BUNDLER — CREATE STANDALONE OFFLINE HTML ════════════ */
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const srcDir = path.join(baseDir, 'src');
const libDir = path.join(baseDir, 'lib');

console.log('📦 Starting bundle build for Scanner v2...');

// 1. Read CSS
let cssCombined = '';
if (fs.existsSync(path.join(baseDir, 'fonts.css'))) {
    cssCombined += fs.readFileSync(path.join(baseDir, 'fonts.css'), 'utf8') + '\n';
}
if (fs.existsSync(path.join(baseDir, 'scanner.css'))) {
    cssCombined += fs.readFileSync(path.join(baseDir, 'scanner.css'), 'utf8') + '\n';
}

// 2. Read Vendor Libs
let vendorJS = '';
const vendorLibs = ['chart.umd.js', 'exceljs.min.js', 'confetti.browser.min.js'];
vendorLibs.forEach(lib => {
    const libPath = path.join(libDir, lib);
    if (fs.existsSync(libPath)) {
        vendorJS += `\n/* ── Vendor: ${lib} ── */\n` + fs.readFileSync(libPath, 'utf8') + '\n';
    }
});

// 3. Read Source JS modules in sequence
const srcFiles = [
    '00-i18n-dict.js',
    '01-config.js',
    '01b-i18n.js',
    '02-state.js',
    '03-util.js',
    '04-parser.js',
    '05-matcher.js',
    '06-stats.js',
    '07-ui-common.js',
    '08-ui-scan.js',
    '09-ui-audit.js',
    '10-ui-analysis.js',
    '11-ui-parametric.js',
    '12-ui-files.js',
    '13-ui-settings.js',
    '14-egg.js',
    '99-boot.js'
];

let appJS = '';
srcFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    if (fs.existsSync(filePath)) {
        appJS += `\n/* ── Module: ${file} ── */\n` + fs.readFileSync(filePath, 'utf8') + '\n';
    }
});

// 4. Read index.html and produce standalone HTML
const indexHtmlPath = path.join(baseDir, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Replace CSS links with inlined style
indexHtml = indexHtml.replace(/<link rel="stylesheet" href="fonts.css">/gi, '');
indexHtml = indexHtml.replace(/<link rel="stylesheet" href="scanner.css">/gi, `<style>\n${cssCombined}\n</style>`);

// Remove external script tags and inject combined inlined scripts
indexHtml = indexHtml.replace(/<script src="lib\/[^"]+"><\/script>\s*/gi, '');
indexHtml = indexHtml.replace(/<script src="src\/[^"]+"><\/script>\s*/gi, '');

const inlineScriptBundle = `
<script>
${vendorJS}
${appJS}
</script>
`;

indexHtml = indexHtml.replace('</body>', `${inlineScriptBundle}\n</body>`);

const standalonePath = path.join(baseDir, 'scanner-v2-standalone.html');
fs.writeFileSync(standalonePath, indexHtml, 'utf8');

console.log(`✅ Generated standalone file: ${standalonePath} (${(fs.statSync(standalonePath).size / 1024).toFixed(1)} KB)`);
