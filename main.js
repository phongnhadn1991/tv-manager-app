const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const adb = require('./adb');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('adb:connect', async (_e, ip, port) => {
  try {
    const result = await adb.connect(ip, port || 5555);
    return { success: true, message: result.message };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:disconnect', async () => {
  try {
    await adb.disconnect();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:deviceInfo', async () => {
  try {
    return { success: true, data: await adb.getDeviceInfo() };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:listPackages', async () => {
  try {
    return { success: true, data: await adb.listPackages() };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:packageInfo', async (_e, pkg) => {
  try {
    return { success: true, data: await adb.getPackageInfo(pkg) };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:disable', async (_e, pkg) => {
  try {
    const out = await adb.disablePackage(pkg);
    return { success: true, message: out };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:enable', async (_e, pkg) => {
  try {
    const out = await adb.enablePackage(pkg);
    return { success: true, message: out };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:forceStop', async (_e, pkg) => {
  try {
    await adb.forceStop(pkg);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:screenshot', async () => {
  try {
    const tmpPath = path.join(os.tmpdir(), `tvscreen_${Date.now()}.png`);
    await adb.screenshot(tmpPath);
    const data = fs.readFileSync(tmpPath).toString('base64');
    fs.unlinkSync(tmpPath);
    return { success: true, data: `data:image/png;base64,${data}` };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:sendKey', async (_e, keycode) => {
  try {
    await adb.sendKey(keycode);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:installApk', async (_e, apkPath) => {
  try {
    const out = await adb.installApk(apkPath);
    return { success: true, message: out };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:backup', async () => {
  try {
    return { success: true, data: await adb.getBackupData() };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('adb:restore', async (_e, disabledList) => {
  try {
    const results = [];
    for (const pkg of disabledList) {
      try {
        const out = await adb.enablePackage(pkg);
        results.push({ pkg, success: true, message: out });
      } catch (err) {
        results.push({ pkg, success: false, message: err.message });
      }
    }
    return { success: true, data: results };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('dialog:selectApk', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn file APK',
    filters: [{ name: 'APK', extensions: ['apk'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return { success: false };
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('dialog:saveBackup', async (_e, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Lưu backup',
    defaultPath: `tv-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
  return { success: true, path: result.filePath };
});

ipcMain.handle('dialog:loadBackup', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn file backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return { success: false };
  const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
  return { success: true, data };
});

ipcMain.handle('cleaner:debloatList', async () => {
  try {
    const examplesDir = path.join(__dirname, '..', 'cleanyourtv', 'examples');
    const folders = fs.readdirSync(examplesDir).filter(f => fs.statSync(path.join(examplesDir, f)).isDirectory());
    const info = await adb.getDeviceInfo();
    const model = (info.model || '').toLowerCase().replace(/\s+/g, '');
    const brand = (info.brand || '').toLowerCase();

    let matchedFolder = null;
    for (const f of folders) {
      const fLower = f.toLowerCase();
      if (fLower.includes(model) || (brand && fLower.startsWith(brand) && fLower.includes(model))) {
        matchedFolder = f;
        break;
      }
    }
    if (!matchedFolder) {
      for (const f of folders) {
        if (f.toLowerCase().includes(brand)) {
          matchedFolder = f;
        }
      }
    }

    const allFolders = folders.filter(f => f.toLowerCase().includes(brand));
    const debloatItems = [];

    const debloatFile = matchedFolder ? path.join(examplesDir, matchedFolder, 'debloat.txt') : null;
    if (debloatFile && fs.existsSync(debloatFile)) {
      const content = fs.readFileSync(debloatFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const commentMatch = trimmed.match(/^([a-zA-Z0-9._]+)\s*(?:#\s*(.*))?$/);
        if (commentMatch) {
          debloatItems.push({ packageName: commentMatch[1], description: commentMatch[2] || '' });
        }
      }
    }

    const extraBloat = [
      { packageName: 'com.google.android.backdrop', description: 'Ambient screensaver (Google content)' },
      { packageName: 'com.google.android.leanbacklauncher', description: 'Launcher cũ Google (đã có CleanYourTV)' },
      { packageName: 'com.google.android.partnersetup', description: 'Google partner setup' },
      { packageName: 'com.google.android.syncadapters.calendar', description: 'Đồng bộ lịch Google, không cần trên TV' },
      { packageName: 'com.google.android.syncadapters.contacts', description: 'Đồng bộ danh bạ Google, không cần trên TV' },
      { packageName: 'com.google.android.onetimeinitializer', description: 'Setup 1 lần, đã chạy xong' },
      { packageName: 'com.google.android.inputmethod.pinyin', description: 'Bàn phím tiếng Trung' },
      { packageName: 'com.tcl.tv.tclhome_passive', description: 'TCL home passive service' },
      { packageName: 'com.android.wallpaperbackup', description: 'Backup hình nền, không cần trên TV' },
      { packageName: 'com.android.htmlviewer', description: 'Trình xem HTML, không cần trên TV' },
      { packageName: 'com.android.providers.calendar', description: 'Lịch, không cần trên TV' },
      { packageName: 'com.android.providers.contacts', description: 'Danh bạ, không cần trên TV' },
      { packageName: 'com.google.android.tts', description: 'Text-to-speech ~18MB, chỉ accessibility dùng' },
      { packageName: 'com.google.android.marvin.talkback', description: 'Trình đọc màn hình, bật lại nếu cần' },
      { packageName: 'com.google.android.speech.pumpkin', description: 'Hotword offline, không cần nếu đã tắt voice' },
      { packageName: 'com.google.android.tv.frameworkpackagestubs', description: 'Stub packages, an toàn để tắt' },
      { packageName: 'com.tcl.inputmethod.international', description: 'Bàn phím TCL (giữ Google keyboard)' },
      { packageName: 'com.tcl.messagebox', description: 'Hộp tin nhắn TCL' },
      { packageName: 'com.google.android.backuptransport', description: 'Google backup transport' },
      { packageName: 'com.android.sharedstoragebackup', description: 'Shared storage backup' },
    ];
    const existing = new Set(debloatItems.map(i => i.packageName));
    for (const item of extraBloat) {
      if (!existing.has(item.packageName)) debloatItems.push(item);
    }

    const installedPkgs = await adb.listPackages();
    const installedSet = new Map(installedPkgs.map(p => [p.packageName, p]));

    const results = debloatItems.map(item => {
      const installed = installedSet.get(item.packageName);
      return {
        packageName: item.packageName,
        description: item.description,
        installed: !!installed,
        alreadyDisabled: installed ? installed.isDisabled : false,
      };
    });

    return {
      success: true,
      data: {
        matchedFolder: matchedFolder || null,
        availableFolders: allFolders,
        items: results,
        deviceModel: `${info.brand} ${info.model}`,
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cleaner:batchDisable', async (_e, pkgs) => {
  const results = [];
  for (const pkg of pkgs) {
    try {
      const out = await adb.disablePackage(pkg);
      results.push({ pkg, success: true, message: out });
    } catch (err) {
      results.push({ pkg, success: false, message: err.message });
    }
  }
  return { success: true, data: results };
});

ipcMain.handle('launcher:status', async () => {
  try {
    const out = await adb.shell('pm list packages | grep gathin');
    const isInstalled = out.includes('com.gathin.tvhome');
    let isHome = false;
    if (isInstalled) {
      const focused = await adb.shell('dumpsys activity activities | grep mResumedActivity');
      isHome = focused.includes('com.gathin.tvhome');
    }
    return { success: true, data: { installed: isInstalled, isHome } };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('launcher:themes', async () => {
  try {
    const themesDir = path.join(__dirname, '..', 'cleanyourtv', 'themes');
    const folders = fs.readdirSync(themesDir).filter(f => {
      const stat = fs.statSync(path.join(themesDir, f));
      return stat.isDirectory() && f !== 'default' && fs.existsSync(path.join(themesDir, f, 'config.json'));
    });
    const themes = folders.map(f => {
      const config = JSON.parse(fs.readFileSync(path.join(themesDir, f, 'config.json'), 'utf-8'));
      const hasScreenshot = fs.existsSync(path.join(themesDir, f, 'screenshot.jpg'));
      let screenshotData = null;
      if (hasScreenshot) {
        screenshotData = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(themesDir, f, 'screenshot.jpg')).toString('base64');
      }
      return { name: f, config, screenshot: screenshotData };
    });
    return { success: true, data: themes };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('launcher:applyTheme', async (_e, themeName) => {
  try {
    const themesDir = path.join(__dirname, '..', 'cleanyourtv', 'themes');
    const themeDir = path.join(themesDir, themeName);
    const configPath = path.join(themeDir, 'config.json');
    if (!fs.existsSync(configPath)) return { success: false, message: 'Theme không tồn tại' };

    const remotePath = '/sdcard/Android/data/com.gathin.tvhome/files';
    await adb.shell(`mkdir -p ${remotePath}`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const tmpConfig = path.join(os.tmpdir(), 'config.json');
    fs.writeFileSync(tmpConfig, JSON.stringify(config, null, 2));
    await adb.run(adb.getConnectedDevice()
      ? ['-s', adb.getConnectedDevice(), 'push', tmpConfig, `${remotePath}/config.json`]
      : ['push', tmpConfig, `${remotePath}/config.json`], 30000);

    const wallpapers = fs.readdirSync(themeDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && f !== 'screenshot.jpg');
    for (const w of wallpapers) {
      const localW = path.join(themeDir, w);
      await adb.run(adb.getConnectedDevice()
        ? ['-s', adb.getConnectedDevice(), 'push', localW, `${remotePath}/${w}`]
        : ['push', localW, `${remotePath}/${w}`], 30000);
    }

    try { await adb.shell('pm disable-user --user 0 com.google.android.tvlauncher'); } catch (_) {}
    try { await adb.shell('pm disable-user --user 0 com.google.android.leanbacklauncher'); } catch (_) {}
    await adb.shell('am force-stop com.gathin.tvhome');
    await adb.shell('input keyevent KEYCODE_HOME');

    fs.unlinkSync(tmpConfig);
    return { success: true, message: `Đã áp dụng theme "${themeName}" với ${wallpapers.length} hình nền` };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('launcher:getLeanbackApps', async () => {
  try {
    const out = await adb.shell('pm query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER');
    const pkgs = [];
    for (const line of out.split('\n')) {
      const match = line.match(/^\s+([a-zA-Z0-9._]+)\//);
      if (match && match[1] !== 'com.gathin.tvhome') {
        if (!pkgs.includes(match[1])) pkgs.push(match[1]);
      }
    }
    return { success: true, data: pkgs };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('launcher:uploadWallpaper', async (_e, filePath) => {
  try {
    const remotePath = '/sdcard/Android/data/com.gathin.tvhome/files';
    await adb.shell(`mkdir -p ${remotePath}`);
    await adb.run(adb.getConnectedDevice()
      ? ['-s', adb.getConnectedDevice(), 'push', filePath, `${remotePath}/wallpaper.jpg`]
      : ['push', filePath, `${remotePath}/wallpaper.jpg`], 60000);

    let config = {};
    try {
      const existing = await adb.shell(`cat ${remotePath}/config.json`);
      config = JSON.parse(existing);
    } catch (_) {}
    config.wallpaper = true;
    const tmpConfig = path.join(os.tmpdir(), 'config.json');
    fs.writeFileSync(tmpConfig, JSON.stringify(config, null, 2));
    await adb.run(adb.getConnectedDevice()
      ? ['-s', adb.getConnectedDevice(), 'push', tmpConfig, `${remotePath}/config.json`]
      : ['push', tmpConfig, `${remotePath}/config.json`], 30000);
    fs.unlinkSync(tmpConfig);

    try { await adb.shell('pm disable-user --user 0 com.google.android.tvlauncher'); } catch (_) {}
    await adb.shell('am force-stop com.gathin.tvhome');
    await adb.shell('input keyevent KEYCODE_HOME');
    return { success: true, message: 'Đã đặt hình nền lên TV' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('launcher:removeWallpaper', async () => {
  try {
    const remotePath = '/sdcard/Android/data/com.gathin.tvhome/files';
    await adb.shell(`rm -f ${remotePath}/wallpaper.jpg ${remotePath}/wallpapers/*.jpg ${remotePath}/wallpapers/*.png`);
    let config = {};
    try {
      const existing = await adb.shell(`cat ${remotePath}/config.json`);
      config = JSON.parse(existing);
    } catch (_) {}
    config.wallpaper = false;
    const tmpConfig = path.join(os.tmpdir(), 'config.json');
    fs.writeFileSync(tmpConfig, JSON.stringify(config, null, 2));
    await adb.run(adb.getConnectedDevice()
      ? ['-s', adb.getConnectedDevice(), 'push', tmpConfig, `${remotePath}/config.json`]
      : ['push', tmpConfig, `${remotePath}/config.json`], 30000);
    fs.unlinkSync(tmpConfig);

    await adb.shell('am force-stop com.gathin.tvhome');
    await adb.shell('input keyevent KEYCODE_HOME');
    return { success: true, message: 'Đã xóa hình nền' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('dialog:selectImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn hình nền',
    filters: [{ name: 'Ảnh', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return { success: false };
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('launcher:getTvConfig', async () => {
  try {
    const out = await adb.shell('cat /sdcard/Android/data/com.gathin.tvhome/files/config.json');
    return { success: true, data: JSON.parse(out) };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('launcher:saveDock', async (_e, dockApps) => {
  try {
    const remotePath = '/sdcard/Android/data/com.gathin.tvhome/files';
    await adb.shell(`mkdir -p ${remotePath}`);
    let config = {};
    try {
      const existing = await adb.shell(`cat ${remotePath}/config.json`);
      config = JSON.parse(existing);
    } catch (_) {}
    config.dock_apps = dockApps;
    const tmpConfig = path.join(os.tmpdir(), 'config.json');
    fs.writeFileSync(tmpConfig, JSON.stringify(config, null, 2));
    await adb.run(adb.getConnectedDevice()
      ? ['-s', adb.getConnectedDevice(), 'push', tmpConfig, `${remotePath}/config.json`]
      : ['push', tmpConfig, `${remotePath}/config.json`], 30000);
    fs.unlinkSync(tmpConfig);
    try { await adb.shell('pm disable-user --user 0 com.google.android.tvlauncher'); } catch (_) {}
    try { await adb.shell('pm disable-user --user 0 com.google.android.leanbacklauncher'); } catch (_) {}
    await adb.shell('am force-stop com.gathin.tvhome');
    await adb.shell('input keyevent KEYCODE_HOME');
    return { success: true, message: 'Đã lưu thứ tự dock lên TV' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('launcher:build', async () => {
  const launcherDir = path.join(__dirname, '..', 'cleanyourtv', 'launcher');
  const apkPath = path.join(launcherDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (fs.existsSync(apkPath)) {
    try {
      const out = await adb.installApk(apkPath);
      return { success: true, message: `Đã cài launcher: ${out}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
  return { success: false, message: `Chưa có APK. Hãy build launcher trước:\ncd ${launcherDir}\n./gradlew assembleRelease` };
});
