const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

let adbPath = 'adb';
let connectedDevice = null;

function setAdbPath(p) { adbPath = p; }
function getAdbPath() { return adbPath; }
function getConnectedDevice() { return connectedDevice; }

function run(args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const proc = execFile(adbPath, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

async function connect(ip, port = 5555) {
  const target = `${ip}:${port}`;
  const out = await run(['connect', target]);
  if (out.includes('connected') || out.includes('already connected')) {
    connectedDevice = target;
    return { success: true, message: out };
  }
  throw new Error(out);
}

async function disconnect() {
  if (connectedDevice) {
    await run(['disconnect', connectedDevice]);
  }
  connectedDevice = null;
}

function deviceArgs(args) {
  return connectedDevice ? ['-s', connectedDevice, ...args] : args;
}

async function shell(cmd) {
  return run(deviceArgs(['shell', cmd]), 30000);
}

async function getDeviceInfo() {
  const [model, brand, androidVer, sdk, serialNo] = await Promise.all([
    shell('getprop ro.product.model'),
    shell('getprop ro.product.brand'),
    shell('getprop ro.build.version.release'),
    shell('getprop ro.build.version.sdk'),
    shell('getprop ro.serialno'),
  ]);
  return { model, brand, androidVer, sdk, serialNo };
}

async function listPackages() {
  const [allOut, disabledOut, systemOut] = await Promise.all([
    shell('pm list packages -f'),
    shell('pm list packages -d'),
    shell('pm list packages -s'),
  ]);

  const disabled = new Set(disabledOut.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean));
  const system = new Set(systemOut.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean));

  const packages = [];
  for (const line of allOut.split('\n')) {
    if (!line.startsWith('package:')) continue;
    const match = line.match(/^package:(.+)=(.+)$/);
    if (!match) continue;
    const apkPath = match[1];
    const pkg = match[2];
    packages.push({
      packageName: pkg,
      apkPath,
      isDisabled: disabled.has(pkg),
      isSystem: system.has(pkg),
    });
  }
  packages.sort((a, b) => a.packageName.localeCompare(b.packageName));
  return packages;
}

async function getPackageInfo(pkg) {
  const out = await shell(`dumpsys package ${pkg}`);
  const versionMatch = out.match(/versionName=([^\s]+)/);
  const installerMatch = out.match(/installerPackageName=([^\s]+)/);
  const permsSection = out.match(/requested permissions:\n([\s\S]*?)(?:\n\s*\n|\ninstall permissions:)/);
  let permissions = [];
  if (permsSection) {
    permissions = permsSection[1].split('\n').map(l => l.trim()).filter(l => l.startsWith('android.permission.')).slice(0, 30);
  }
  return {
    version: versionMatch ? versionMatch[1] : 'N/A',
    installer: installerMatch ? installerMatch[1] : 'N/A',
    permissions,
  };
}

async function disablePackage(pkg) {
  const out = await shell(`pm disable-user --user 0 ${pkg}`);
  return out;
}

async function enablePackage(pkg) {
  const out = await shell(`pm enable ${pkg}`);
  return out;
}

async function forceStop(pkg) {
  return shell(`am force-stop ${pkg}`);
}

async function screenshot(localPath) {
  const remotePath = '/sdcard/tvscreen.png';
  await shell(`screencap -p ${remotePath}`);
  await run(deviceArgs(['pull', remotePath, localPath]), 30000);
  await shell(`rm ${remotePath}`);
  return localPath;
}

async function sendKey(keycode) {
  return shell(`input keyevent ${keycode}`);
}

async function installApk(localApkPath) {
  return run(deviceArgs(['install', '-r', localApkPath]), 120000);
}

async function getBackupData() {
  const [allPkgs, disabledPkgs, props] = await Promise.all([
    shell('pm list packages'),
    shell('pm list packages -d'),
    shell('getprop'),
  ]);
  return {
    timestamp: new Date().toISOString(),
    allPackages: allPkgs.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean),
    disabledPackages: disabledPkgs.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean),
    properties: props,
  };
}

module.exports = {
  setAdbPath, getAdbPath, getConnectedDevice,
  connect, disconnect, getDeviceInfo,
  listPackages, getPackageInfo,
  disablePackage, enablePackage, forceStop,
  screenshot, sendKey, installApk, getBackupData,
  shell, run,
};
