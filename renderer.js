let packages = [];
let currentFilter = 'all';
let isConnected = false;

try {
  const savedIp = localStorage.getItem('tv_ip');
  const savedPort = localStorage.getItem('tv_port');
  if (savedIp) document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ipInput').value = savedIp;
    if (savedPort) document.getElementById('portInput').value = savedPort;
  });
} catch (_) {}

// Toast
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

function setStatus(msg) {
  document.getElementById('statusText').textContent = msg;
}

// Tabs
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  const tabs = document.querySelectorAll('.nav-tab');
  const tabNames = ['packages', 'cleaner', 'remote', 'screenshot', 'backup', 'launcher'];
  const idx = tabNames.indexOf(name);
  if (idx >= 0) tabs[idx].classList.add('active');
  if (name === 'launcher') { loadThemes(); if (isConnected) checkLauncherStatus(); }
}

// Connection
async function handleConnect() {
  const ip = document.getElementById('ipInput').value.trim();
  const port = document.getElementById('portInput').value.trim() || '5555';
  if (!ip) { showToast('Nhập IP của TV', 'error'); return; }
  try { localStorage.setItem('tv_ip', ip); localStorage.setItem('tv_port', port); } catch (_) {}
  setStatus('Đang kết nối...');
  const res = await window.tvAPI.connect(ip, parseInt(port));
  if (res.success) {
    isConnected = true;
    document.getElementById('statusDot').classList.add('connected');
    document.getElementById('connectBtn').style.display = 'none';
    document.getElementById('disconnectBtn').style.display = '';
    showToast('Đã kết nối!');
    const info = await window.tvAPI.getDeviceInfo();
    if (info.success) {
      const d = info.data;
      document.getElementById('deviceInfo').textContent = `${d.brand} ${d.model} · Android ${d.androidVer} (SDK ${d.sdk})`;
    }
    loadPackages();
  } else {
    showToast(`Kết nối thất bại: ${res.message}`, 'error');
    setStatus('Kết nối thất bại');
  }
}

async function handleDisconnect() {
  await window.tvAPI.disconnect();
  isConnected = false;
  packages = [];
  document.getElementById('statusDot').classList.remove('connected');
  document.getElementById('connectBtn').style.display = '';
  document.getElementById('disconnectBtn').style.display = 'none';
  document.getElementById('deviceInfo').textContent = 'Chưa kết nối';
  document.getElementById('pkgBody').innerHTML = '';
  updateCounts();
  setStatus('Đã ngắt kết nối');
  showToast('Đã ngắt kết nối');
}

// Packages
async function loadPackages() {
  document.getElementById('pkgLoading').style.display = 'flex';
  setStatus('Đang tải danh sách ứng dụng...');
  const res = await window.tvAPI.listPackages();
  document.getElementById('pkgLoading').style.display = 'none';
  if (res.success) {
    packages = res.data;
    renderTable();
    setStatus(`Đã tải ${packages.length} packages`);
  } else {
    showToast(`Lỗi: ${res.message}`, 'error');
    setStatus('Lỗi khi tải packages');
  }
}

function updateCounts() {
  document.getElementById('countAll').textContent = packages.length;
  document.getElementById('countEnabled').textContent = packages.filter(p => !p.isDisabled).length;
  document.getElementById('countDisabled').textContent = packages.filter(p => p.isDisabled).length;
  document.getElementById('countSystem').textContent = packages.filter(p => p.isSystem).length;
  document.getElementById('pkgCount').textContent = `Tổng: ${packages.length} packages`;
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  const chips = document.querySelectorAll('.filter-chip');
  const filters = ['all', 'enabled', 'disabled', 'system'];
  const idx = filters.indexOf(f);
  if (idx >= 0) chips[idx].classList.add('active');
  renderTable();
}

function getFilteredPackages() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase();
  return packages.filter(p => {
    if (currentFilter === 'enabled' && p.isDisabled) return false;
    if (currentFilter === 'disabled' && !p.isDisabled) return false;
    if (currentFilter === 'system' && !p.isSystem) return false;
    if (search && !p.packageName.toLowerCase().includes(search)) return false;
    return true;
  });
}

function renderTable() {
  updateCounts();
  const filtered = getFilteredPackages();
  const body = document.getElementById('pkgBody');
  body.innerHTML = filtered.map((p, i) => {
    const statusClass = p.isDisabled ? 'disabled' : 'enabled';
    const statusText = p.isDisabled ? 'Đã tắt' : 'Đang bật';
    const systemBadge = p.isSystem ? ' <span class="status-badge system">Hệ thống</span>' : '';
    const toggleBtn = p.isDisabled
      ? `<button class="btn sm primary" onclick="togglePackage('${p.packageName}', true)">Bật lại</button>`
      : `<button class="btn sm danger" onclick="togglePackage('${p.packageName}', false)">Vô hiệu hóa</button>`;
    return `<tr>
      <td class="col-num">${i + 1}</td>
      <td class="col-name">
        <span class="pkg-name">${p.packageName.split('.').pop()}</span>
        <span class="pkg-id">${p.packageName}</span>
      </td>
      <td class="col-status"><span class="status-badge ${statusClass}">${statusText}</span>${systemBadge}</td>
      <td class="col-actions"><div class="actions-cell">
        ${toggleBtn}
        <button class="btn sm" onclick="showAppInfo('${p.packageName}')">App Info</button>
        <button class="btn sm" onclick="stopApp('${p.packageName}')">Force Stop</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function togglePackage(pkg, enable) {
  const action = enable ? 'BẬT LẠI' : 'VÔ HIỆU HÓA';
  showModal(`
    <h3>Xác nhận ${action}</h3>
    <p style="margin:12px 0;font-size:13px;color:var(--text-secondary)">
      Bạn có chắc muốn <strong>${action.toLowerCase()}</strong> package:<br>
      <code style="color:var(--accent)">${pkg}</code>
    </p>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn ${enable ? 'primary' : 'danger'}" onclick="confirmToggle('${pkg}', ${enable})">${action}</button>
    </div>
  `);
}

async function confirmToggle(pkg, enable) {
  closeModal();
  setStatus(`Đang ${enable ? 'bật' : 'tắt'} ${pkg}...`);
  const res = enable ? await window.tvAPI.enablePackage(pkg) : await window.tvAPI.disablePackage(pkg);
  if (res.success) {
    showToast(`${enable ? 'Đã bật' : 'Đã vô hiệu hóa'}: ${pkg}`);
    const p = packages.find(x => x.packageName === pkg);
    if (p) p.isDisabled = !enable;
    renderTable();
  } else {
    showToast(`Lỗi: ${res.message}`, 'error');
  }
  setStatus('Sẵn sàng');
}

async function showAppInfo(pkg) {
  setStatus(`Đang tải thông tin ${pkg}...`);
  const res = await window.tvAPI.getPackageInfo(pkg);
  if (!res.success) { showToast(`Lỗi: ${res.message}`, 'error'); return; }
  const d = res.data;
  showModal(`
    <h3>Thông tin ứng dụng</h3>
    <div class="info-row"><span class="info-label">Package:</span><span class="info-value">${pkg}</span></div>
    <div class="info-row"><span class="info-label">Phiên bản:</span><span class="info-value">${d.version}</span></div>
    <div class="info-row"><span class="info-label">Nguồn cài:</span><span class="info-value">${d.installer}</span></div>
    <div class="info-row"><span class="info-label">Quyền (${d.permissions.length}):</span></div>
    <div class="perm-list">${d.permissions.map(p => `· ${p}`).join('<br>') || 'Không có'}</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>
  `);
  setStatus('Sẵn sàng');
}

async function stopApp(pkg) {
  const res = await window.tvAPI.forceStop(pkg);
  if (res.success) showToast(`Đã dừng: ${pkg}`);
  else showToast(`Lỗi: ${res.message}`, 'error');
}

// Remote
async function sendKey(keycode) {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  await window.tvAPI.sendKey(keycode);
}

// Screenshot
async function takeScreenshot() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  setStatus('Đang chụp màn hình...');
  const res = await window.tvAPI.screenshot();
  if (res.success) {
    document.getElementById('screenshotArea').innerHTML = `<img class="screenshot-img" src="${res.data}">`;
    showToast('Đã chụp màn hình');
  } else {
    showToast(`Lỗi: ${res.message}`, 'error');
  }
  setStatus('Sẵn sàng');
}

// Backup
async function doBackup() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  setStatus('Đang tạo backup...');
  const res = await window.tvAPI.backup();
  if (!res.success) { showToast(`Lỗi: ${res.message}`, 'error'); return; }
  const saveRes = await window.tvAPI.saveBackupFile(res.data);
  if (saveRes.success) {
    showToast(`Đã lưu backup: ${saveRes.path}`);
  }
  setStatus('Sẵn sàng');
}

async function doRestore() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  const fileRes = await window.tvAPI.loadBackupFile();
  if (!fileRes.success) return;
  const backup = fileRes.data;
  if (!backup.disabledPackages || backup.disabledPackages.length === 0) {
    showToast('Không có package nào cần khôi phục', 'error');
    return;
  }
  showModal(`
    <h3>Xác nhận khôi phục</h3>
    <p style="margin:12px 0;font-size:13px;color:var(--text-secondary)">
      Sẽ bật lại <strong>${backup.disabledPackages.length}</strong> packages đã bị vô hiệu hóa.<br>
      Backup tạo lúc: ${backup.timestamp}
    </p>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn primary" onclick="confirmRestore(${JSON.stringify(backup.disabledPackages).replace(/"/g, '&quot;')})">Khôi phục</button>
    </div>
  `);
}

async function confirmRestore(disabledList) {
  closeModal();
  setStatus('Đang khôi phục...');
  const res = await window.tvAPI.restore(disabledList);
  if (res.success) {
    const log = document.getElementById('restoreLog');
    log.style.display = 'block';
    document.getElementById('restoreResults').innerHTML = res.data.map(r =>
      `<div style="color:${r.success ? 'var(--accent)' : 'var(--danger)'}">${r.success ? '✓' : '✗'} ${r.pkg}: ${r.message || 'OK'}</div>`
    ).join('');
    showToast('Khôi phục hoàn tất');
    loadPackages();
  } else {
    showToast(`Lỗi: ${res.message}`, 'error');
  }
  setStatus('Sẵn sàng');
}

// Launcher
async function installLauncher() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  setStatus('Đang cài launcher...');
  const res = await window.tvAPI.buildLauncher();
  if (res.success) showToast(res.message);
  else showToast(res.message, 'error');
  setStatus('Sẵn sàng');
}

async function installCustomApk() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  const fileRes = await window.tvAPI.selectApkFile();
  if (!fileRes.success) return;
  setStatus('Đang cài APK...');
  const res = await window.tvAPI.installApk(fileRes.path);
  if (res.success) showToast('Đã cài APK thành công');
  else showToast(`Lỗi: ${res.message}`, 'error');
  setStatus('Sẵn sàng');
}

// Cleaner
let debloatItems = [];

async function loadDebloatList() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  document.getElementById('cleanerLoading').style.display = 'flex';
  document.getElementById('cleanerEmpty').style.display = 'none';
  setStatus('Đang quét bloatware...');
  const res = await window.tvAPI.getDebloatList();
  document.getElementById('cleanerLoading').style.display = 'none';
  if (!res.success) { showToast(`Lỗi: ${res.message}`, 'error'); return; }
  const d = res.data;
  document.getElementById('cleanerModel').textContent = d.deviceModel;
  document.getElementById('cleanerMatch').textContent = d.matchedFolder ? `Tìm thấy: ${d.matchedFolder}` : 'Không tìm thấy model chính xác';
  debloatItems = d.items.filter(i => i.installed);
  renderCleanerTable();
  setStatus(`Tìm thấy ${debloatItems.length} bloatware có thể tắt`);
}

function renderCleanerTable() {
  const body = document.getElementById('cleanerBody');
  body.innerHTML = debloatItems.map((item, i) => {
    const statusClass = item.alreadyDisabled ? 'disabled' : 'enabled';
    const statusText = item.alreadyDisabled ? 'Đã tắt' : 'Đang bật';
    const checked = !item.alreadyDisabled ? 'checked' : '';
    const disabled = item.alreadyDisabled ? 'disabled' : '';
    return `<tr>
      <td><input type="checkbox" class="debloat-check" data-pkg="${item.packageName}" ${checked} ${disabled}></td>
      <td class="col-num">${i + 1}</td>
      <td class="col-name">
        <span class="pkg-name">${item.packageName.split('.').pop()}</span>
        <span class="pkg-id">${item.packageName}</span>
      </td>
      <td style="font-size:12px;color:var(--text-secondary)">${item.description}</td>
      <td class="col-status"><span class="status-badge ${statusClass}">${statusText}</span></td>
    </tr>`;
  }).join('');
}

function selectAllDebloat() {
  document.querySelectorAll('.debloat-check:not([disabled])').forEach(c => c.checked = true);
}
function deselectAllDebloat() {
  document.querySelectorAll('.debloat-check:not([disabled])').forEach(c => c.checked = false);
}
function toggleAllDebloat(checked) {
  document.querySelectorAll('.debloat-check:not([disabled])').forEach(c => c.checked = checked);
}

async function runBatchDisable() {
  const selected = [...document.querySelectorAll('.debloat-check:checked:not([disabled])')].map(c => c.dataset.pkg);
  if (selected.length === 0) { showToast('Chưa chọn package nào', 'error'); return; }
  showModal(`
    <h3>Xác nhận dọn dẹp</h3>
    <p style="margin:12px 0;font-size:13px;color:var(--text-secondary)">
      Sẽ vô hiệu hóa <strong>${selected.length}</strong> packages.<br>
      Tất cả đều có thể bật lại từ tab "Quản lý ứng dụng" hoặc Backup/Restore.
    </p>
    <div style="max-height:200px;overflow-y:auto;font-size:11px;font-family:monospace;color:var(--text-muted);margin:8px 0">
      ${selected.map(p => `· ${p}`).join('<br>')}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn danger" onclick="confirmBatchDisable()">Dọn dẹp ${selected.length} packages</button>
    </div>
  `);
}

async function confirmBatchDisable() {
  closeModal();
  const selected = [...document.querySelectorAll('.debloat-check:checked:not([disabled])')].map(c => c.dataset.pkg);
  setStatus('Đang tạo backup trước khi dọn dẹp...');
  const backupRes = await window.tvAPI.backup();
  if (backupRes.success) {
    const saveRes = await window.tvAPI.saveBackupFile(backupRes.data);
    if (saveRes.success) {
      showToast(`Đã lưu backup: ${saveRes.path}`);
    } else {
      showToast('Bỏ qua backup, tiếp tục dọn dẹp...', 'error');
    }
  }
  setStatus(`Đang dọn dẹp 0/${selected.length}...`);
  const res = await window.tvAPI.batchDisable(selected);
  if (res.success) {
    const ok = res.data.filter(r => r.success).length;
    const fail = res.data.filter(r => !r.success).length;
    showToast(`Hoàn tất: ${ok} thành công${fail ? `, ${fail} lỗi` : ''}`);
    for (const r of res.data) {
      if (r.success) {
        const item = debloatItems.find(i => i.packageName === r.pkg);
        if (item) item.alreadyDisabled = true;
        const p = packages.find(x => x.packageName === r.pkg);
        if (p) p.isDisabled = true;
      }
    }
    renderCleanerTable();
    renderTable();
  } else {
    showToast(`Lỗi: ${res.message}`, 'error');
  }
  setStatus('Sẵn sàng');
}

// Dock sorting
let dockApps = [];
let allTvApps = [];

const appNames = {
  'com.netflix.ninja': 'Netflix',
  'com.google.android.youtube.tv': 'YouTube',
  'com.android.vending': 'Google Play Store',
  'com.viettel.tv360.tv': 'TV360',
  'com.google.android.apps.mediashell': 'Chromecast',
  'com.amazon.amazonvideo.livingroom': 'Prime Video',
  'com.disney.disneyplus': 'Disney+',
  'com.apple.atve.androidtv.appletv': 'Apple TV',
  'com.spotify.tv.android': 'Spotify',
  'com.wbd.stream': 'Max (HBO)',
  'com.tcl.tv': 'Live TV',
  'com.tcl.ui_mediaCenter': 'Media Center',
  'com.tcl.audioplayer': 'Trình phát nhạc',
  'com.tcl.videoplayer': 'Trình phát video',
  'com.tcl.imageplayer': 'Trình xem ảnh',
  'com.google.android.play.games': 'Play Games',
  'com.nousguide.android.rbtv': 'Red Bull TV',
  'tv.twitch.android.app': 'Twitch',
  'com.globo.globotv': 'Globoplay',
  'com.tcl.MultiScreenInteraction_TV': 'Screen Mirroring',
};

function getAppName(pkg) {
  if (appNames[pkg]) return appNames[pkg];
  const parts = pkg.split('.');
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

async function loadDockApps() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  setStatus('Đang tải danh sách app...');
  const res = await window.tvAPI.listPackages();
  if (!res.success) { showToast('Lỗi: ' + res.message, 'error'); return; }
  allTvApps = res.data.filter(p => !p.isDisabled).map(p => p.packageName).sort();

  const lbRes = await window.tvAPI.getLeanbackApps();
  const lbApps = lbRes.success ? lbRes.data : [];

  // Đọc thứ tự đã lưu từ config.json trên TV
  let savedOrder = null;
  try {
    const cfgRes = await window.tvAPI.getTvConfig();
    if (cfgRes.success && cfgRes.data && cfgRes.data.dock_apps) {
      savedOrder = cfgRes.data.dock_apps;
    }
  } catch (_) {}

  if (savedOrder) {
    // Giữ thứ tự đã lưu, thêm app mới chưa có vào cuối
    dockApps = savedOrder.filter(p => lbApps.includes(p));
    for (const p of lbApps) {
      if (!dockApps.includes(p)) dockApps.push(p);
    }
  } else {
    dockApps = lbApps;
  }
  renderDockList();
  renderDockSelect();
  setStatus('Đã tải danh sách app');
}

function renderDockList() {
  const list = document.getElementById('dockList');
  list.innerHTML = dockApps.map((pkg, i) => `
    <div class="dock-item" draggable="true" data-idx="${i}"
         ondragstart="dockDragStart(event)" ondragover="dockDragOver(event)" ondrop="dockDrop(event)" ondragend="dockDragEnd(event)">
      <span style="color:var(--text-muted);width:24px;text-align:center;font-size:12px">${i + 1}</span>
      <span style="flex:1;font-size:13px">${getAppName(pkg)} <span style="color:var(--text-muted);font-size:11px">(${pkg})</span></span>
      <button class="btn sm" onclick="moveDock(${i},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="btn sm" onclick="moveDock(${i},1)" ${i === dockApps.length - 1 ? 'disabled' : ''}>▼</button>
      <button class="btn sm danger" onclick="removeDock(${i})">✕</button>
    </div>
  `).join('');
}

function renderDockSelect() {
  const select = document.getElementById('addDockSelect');
  const systemSkip = [
    'android', 'com.android.', 'com.google.android.gms', 'com.google.android.gsf',
    'com.google.android.ext.', 'com.google.android.packageinstaller',
    'com.google.android.inputmethod', 'com.google.android.webview',
    'com.google.android.backuptransport', 'com.google.android.onetimeinitializer',
    'com.google.android.sss.', 'com.google.android.tungsten.',
    'com.google.android.tv.frameworkpackagestubs', 'com.google.android.tv.remote.service',
    'com.tcl.framework', 'com.tcl.keyhelp', 'com.tcl.keycustomfunctionservice',
    'com.tcl.autopair', 'com.tcl.tcl_bt_rcu_service', 'com.tcl.settings',
    'com.tcl.initsetup', 'com.tcl.appstatecontroller', 'com.tcl.xian.',
    'com.tcl.tvinput', 'com.tcl.tvpassthrough', 'com.tcl.sourcemananger',
    'com.tcl.systemuioverlay', 'com.tcl.rc.ota', 'com.tcl.versionUpdateApp',
    'com.tcl.factory', 'com.tcl.inputmethod', 'com.realtek.',
    'com.gathin.tvhome',
  ];
  const available = allTvApps.filter(p => !dockApps.includes(p) && !systemSkip.some(s => p === s || p.startsWith(s)));
  select.innerHTML = available.map(p => `<option value="${p}">${getAppName(p)} (${p})</option>`).join('');
}

function moveDock(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= dockApps.length) return;
  [dockApps[idx], dockApps[newIdx]] = [dockApps[newIdx], dockApps[idx]];
  renderDockList();
}

function removeDock(idx) {
  dockApps.splice(idx, 1);
  renderDockList();
  renderDockSelect();
}

function addToDock() {
  const select = document.getElementById('addDockSelect');
  if (!select.value) return;
  dockApps.push(select.value);
  renderDockList();
  renderDockSelect();
}

let dragIdx = null;
function dockDragStart(e) {
  dragIdx = parseInt(e.currentTarget.dataset.idx);
  e.currentTarget.style.opacity = '0.4';
}
function dockDragOver(e) { e.preventDefault(); }
function dockDrop(e) {
  e.preventDefault();
  const targetIdx = parseInt(e.currentTarget.dataset.idx);
  if (dragIdx === null || dragIdx === targetIdx) return;
  const item = dockApps.splice(dragIdx, 1)[0];
  dockApps.splice(targetIdx, 0, item);
  renderDockList();
}
function dockDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  dragIdx = null;
}

async function saveDockOrder() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  if (dockApps.length === 0) { showToast('Chưa có app trong dock', 'error'); return; }
  setStatus('Đang lưu thứ tự dock...');
  const res = await window.tvAPI.saveDock(dockApps);
  if (res.success) showToast(res.message);
  else showToast('Lỗi: ' + res.message, 'error');
  setStatus('Sẵn sàng');
}

// Wallpaper
async function uploadWallpaper() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  const fileRes = await window.tvAPI.selectImage();
  if (!fileRes.success) return;
  setStatus('Đang upload hình nền...');
  document.getElementById('wallpaperPreview').innerHTML = `<img src="file://${fileRes.path}" style="max-width:400px;border-radius:8px;border:1px solid var(--border)">`;
  const res = await window.tvAPI.uploadWallpaper(fileRes.path);
  if (res.success) showToast(res.message);
  else showToast('Lỗi: ' + res.message, 'error');
  setStatus('Sẵn sàng');
}

async function removeWallpaper() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  setStatus('Đang xóa hình nền...');
  const res = await window.tvAPI.removeWallpaper();
  if (res.success) {
    showToast(res.message);
    document.getElementById('wallpaperPreview').innerHTML = '';
  } else {
    showToast('Lỗi: ' + res.message, 'error');
  }
  setStatus('Sẵn sàng');
}

// Launcher & Themes
let selectedTheme = null;

async function checkLauncherStatus() {
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  const res = await window.tvAPI.launcherStatus();
  const el = document.getElementById('launcherStatus');
  if (res.success) {
    const d = res.data;
    if (!d.installed) el.innerHTML = '❌ Launcher <strong>chưa cài</strong>. Bấm "Cài / Cập nhật" để bắt đầu.';
    else if (d.isHome) el.innerHTML = '✅ Launcher đã cài và đang là <strong>màn hình chính</strong>.';
    else el.innerHTML = '⚠️ Launcher đã cài nhưng <strong>chưa phải màn hình chính</strong>. Bấm Home trên remote để chọn.';
  } else {
    el.textContent = 'Lỗi kiểm tra: ' + res.message;
  }
}

async function loadThemes() {
  const res = await window.tvAPI.getThemes();
  if (!res.success) return;
  const grid = document.getElementById('themeGrid');
  grid.innerHTML = res.data.map(t => `
    <div class="theme-card ${selectedTheme === t.name ? 'selected' : ''}" onclick="selectTheme('${t.name}')" id="theme-${t.name}">
      ${t.screenshot ? `<img src="${t.screenshot}" style="width:100%;border-radius:6px;margin-bottom:8px">` : '<div style="height:120px;background:var(--bg-primary);border-radius:6px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px">Không có preview</div>'}
      <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${t.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${t.config.wallpaper ? 'Có hình nền' : 'Không hình nền'} · ${t.config.background_color || '#000'}</div>
    </div>
  `).join('');
}

function selectTheme(name) {
  selectedTheme = name;
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
  const el = document.getElementById('theme-' + name);
  if (el) el.classList.add('selected');
  document.getElementById('themeActions').style.display = 'flex';
  document.getElementById('selectedThemeName').textContent = `Theme: ${name}`;
}

async function applyTheme() {
  if (!selectedTheme) { showToast('Chưa chọn theme', 'error'); return; }
  if (!isConnected) { showToast('Chưa kết nối TV', 'error'); return; }
  setStatus(`Đang áp dụng theme "${selectedTheme}"...`);
  const res = await window.tvAPI.applyTheme(selectedTheme);
  if (res.success) {
    showToast(res.message);
  } else {
    showToast(`Lỗi: ${res.message}`, 'error');
  }
  setStatus('Sẵn sàng');
}

// Modal
function showModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
