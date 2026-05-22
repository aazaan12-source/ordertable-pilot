const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { appVersion, defaultPlatformUrl } = require("./config");

let activationWindow;
let dashboardWindow;
let settingsPath;
let settingsCache = {};

function loadSettings() {
  settingsPath = path.join(app.getPath("userData"), "ordertable-manager-license.json");
  try {
    settingsCache = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    settingsCache = {};
  }
}

function getSetting(key) {
  return settingsCache[key];
}

function setSetting(key, value) {
  settingsCache[key] = value;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settingsCache, null, 2));
}

function deviceId() {
  let id = getSetting("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    setSetting("deviceId", id);
  }
  return id;
}

function platformUrl() {
  return String(getSetting("platformUrl") || defaultPlatformUrl).replace(/\/$/, "");
}

async function validateLicense(licenseKey, url = platformUrl()) {
  const baseUrl = String(url || defaultPlatformUrl).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/software/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      licenseKey,
      deviceId: deviceId(),
      deviceName: os.hostname(),
      platform: `${process.platform} ${os.release()}`,
      appVersion
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || "License validation failed.");
  }
  setSetting("licenseKey", licenseKey);
  setSetting("platformUrl", baseUrl);
  setSetting("license", payload.license);
  setSetting("restaurant", payload.restaurant);
  setSetting("release", payload.release);
  setSetting("lastValidatedAt", new Date().toISOString());
  return payload;
}

async function checkRelease() {
  const response = await fetch(`${platformUrl()}/api/software/release`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to check software release.");
  const release = await response.json();
  setSetting("release", release);
  return release;
}

function createActivationWindow(message) {
  activationWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 620,
    title: "OrderTable Manager Activation",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  activationWindow.loadFile(path.join(__dirname, "renderer", "activation.html"));
  activationWindow.once("ready-to-show", () => {
    activationWindow.webContents.send("activation-state", {
      platformUrl: platformUrl(),
      licenseKey: getSetting("licenseKey") || "",
      message: message || ""
    });
  });
}

function createDashboardWindow(dashboardUrl) {
  dashboardWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: "OrderTable Manager",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  dashboardWindow.loadURL(dashboardUrl || `${platformUrl()}/dashboard`);
  dashboardWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
}

async function openApp() {
  const savedKey = getSetting("licenseKey");
  if (!savedKey) {
    createActivationWindow();
    return;
  }
  try {
    const payload = await validateLicense(savedKey);
    createDashboardWindow(payload.dashboardUrl);
  } catch (error) {
    createActivationWindow(error.message);
  }
}

function createMenu() {
  const template = [
    {
      label: "OrderTable",
      submenu: [
        {
          label: "Open Dashboard",
          click: () => {
            if (!dashboardWindow) createDashboardWindow(`${platformUrl()}/dashboard`);
          }
        },
        {
          label: "Check License",
          click: async () => {
            try {
              const key = getSetting("licenseKey");
              if (!key) throw new Error("No license key is saved.");
              await validateLicense(key);
              dialog.showMessageBox({ type: "info", title: "License Active", message: "License is active and verified." });
            } catch (error) {
              dialog.showErrorBox("License Check Failed", error.message);
            }
          }
        },
        {
          label: "Check For Updates",
          click: async () => {
            try {
              const release = await checkRelease();
              if (release.available && release.version !== appVersion) {
                const result = await dialog.showMessageBox({
                  type: "info",
                  buttons: ["Download", "Later"],
                  defaultId: 0,
                  title: "Update Available",
                  message: `Version ${release.version} is available.`,
                  detail: release.releaseNotes || "Download the latest installer from OrderTable."
                });
                if (result.response === 0 && release.downloadUrl) shell.openExternal(release.downloadUrl);
              } else {
                dialog.showMessageBox({ type: "info", title: "Up To Date", message: "You are using the latest desktop version." });
              }
            } catch (error) {
              dialog.showErrorBox("Update Check Failed", error.message);
            }
          }
        },
        {
          label: "Change License Key",
          click: () => {
            createActivationWindow();
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "togglefullscreen" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("activate-license", async (_event, input) => {
  const licenseKey = String(input.licenseKey || "").trim().toUpperCase();
  const url = String(input.platformUrl || defaultPlatformUrl).trim();
  const payload = await validateLicense(licenseKey, url);
  if (activationWindow) activationWindow.close();
  createDashboardWindow(payload.dashboardUrl);
  return payload;
});

ipcMain.handle("open-external", async (_event, url) => {
  await shell.openExternal(url);
});

app.whenReady().then(() => {
  loadSettings();
  createMenu();
  openApp();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) openApp();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
