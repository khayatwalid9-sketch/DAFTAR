const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

assert.match(app, /function currency\(/);
assert.match(app, /function buildInstallments\(/);
assert.match(app, /function renderAudit\(/);
assert.match(app, /function syncToSupabase\(/);
assert.match(app, /function exportDocumentPdf\(/);
assert.match(app, /XLSX\.utils\.sheet_to_json/);
assert.match(app, /currentLang==='en'/);
assert.match(app, /QAR/);
assert.match(app, /function renderNotifications\(/);
assert.match(app, /function applyMode\(/);
assert.match(app, /Notifications/);
assert.match(html, /id="f_installments"/);
assert.match(html, /id="usersList"/);
assert.match(html, /id="auditList"/);
assert.match(css, /305922021_523349173131481_1401793005313797692_n\.jpg/);
assert.match(css, /html\[data-mode="light"\]/);
assert.ok(fs.existsSync(path.join(root, 'vercel.json')));
assert.ok(fs.existsSync(path.join(root, 'supabase', 'schema.sql')));
console.log('Daftar contract tests passed.');
