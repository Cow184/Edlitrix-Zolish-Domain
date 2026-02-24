/* =========================================
   FDS CORE ENGINE (Code.gs)
   ========================================= */

// 1. WEB APP ENTRY POINT
function doGet() {
  try {
    const html = HtmlService.createTemplateFromFile('index');
    html.library = HtmlService.createHtmlOutputFromFile('UI_Library').getContent();
    html.user = { email: Session.getActiveUser().getEmail() || "User" };
    
    return html.evaluate()
        .setTitle('Etzold Engine | EZD') // <--- UPDATED TITLE
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    return HtmlService.createHtmlOutput("<h1>Startup Error</h1><p>" + e.toString() + "</p>");
  }
}

function include(filename) {
  try { return HtmlService.createTemplateFromFile(filename).evaluate().getContent(); } 
  catch (e) { return ""; }
}

function loadModuleContent(moduleName) {
  const moduleMap = {
    'dashboard': 'Dashboard',
    'attendance': 'Attendance',
    'events': 'Events',
    'people': 'People',
    'admin': 'Admin',
    'setup': 'Setup',
    'script': 'Script',
    'shows': 'Shows',
    'reports': 'Reports',
    'ui-library': 'UIViewer'
  };
  const fileName = moduleMap[moduleName] || 'Dashboard';
  try { return HtmlService.createHtmlOutputFromFile(fileName).getContent(); } 
  catch (e) { return '<div style="padding:20px; color:red;">Error loading module: ' + moduleName + '</div>'; }
}

/* =========================================
   CORE SYSTEM LOADER (Expanded)
   ========================================= */
function getInitialSystemState() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("Spreadsheet not found");

    // --- NEW: AUTO-INSTALL TRIGGERS ON BOOT ---
    // Every time the web app opens, it makes sure the background engines are running.
    checkSystemIntegrity(); 

    // 1. Define the Roadmap
    const sheetsToLoad = [
      'User Database', 
      'Settings', 
      'Events', 
      'Attendance', 
      'SystemLogs', 
      'BarcodeArchived'
    ];

    const payload = {
      status: "success",
      userEmail: Session.getActiveUser().getEmail(),
      serverTime: new Date().getTime()
    };

    // 2. Bulk Loader Loop
    sheetsToLoad.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        // Convert sheet name to camelCase key (User Database -> userDatabase)
        // or just use a clean key mapping
        const key = name.replace(/\s+/g, '').toLowerCase(); 
        
        // Special handling for Settings (Key/Value pair) vs Tables
        if (name === 'Settings') {
           payload['settings'] = getSystemSettings();
        } else {
           const data = sheet.getDataRange().getValues();
           payload[key] = tableToJson(data);
        }
      } else {
        console.warn(`Sheet missing: ${name}`);
        const key = name.replace(/\s+/g, '').toLowerCase();
        payload[key] = []; // Return empty array to prevent crashes
      }
    });

    return JSON.stringify(payload);

  } catch (e) {
    console.error("Loader Error:", e);
    return JSON.stringify({ status: "error", message: e.toString() });
  }
}

// HELPER: Converts 2D Array to JSON Objects
function tableToJson(data) {
  if (!data || data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if(h) obj[h.toString().trim()] = row[i];
    });
    return obj;
  });
}

/* =========================================
   ROBUST SETTINGS LOADER (Sanitized)
   ========================================= */
function getSystemSettings() {
  const settingsObj = { "system_initialized": "false" }; 
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) return settingsObj;

    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      const key = String(rows[i][0]).trim();
      let val = rows[i][1];
      
      // 1. Boolean Normalization
      if (val === true || val === "TRUE" || val === "true") val = "true";
      if (val === false || val === "FALSE" || val === "false") val = "false";

      // 2. LIST SANITIZER
      if (key === 'custom_lists') {
        let lists = {};
        // Parse the main object
        if (typeof val === 'object' && val !== null) lists = val;
        else if (typeof val === 'string' && val.trim() !== "") {
          try { lists = JSON.parse(val); } catch(e) { lists = {}; }
        }

        // DEEP CLEAN: Iterate through every list (roles, groups, characters...)
        Object.keys(lists).forEach(listName => {
          if (Array.isArray(lists[listName])) {
            lists[listName] = lists[listName].map(item => {
              // A. Fix Double-Serialization (The "{" Bug)
              if (typeof item === 'string' && item.trim().startsWith('{')) {
                try { item = JSON.parse(item); } catch(e) {} 
              }

              // B. Fix Ghost Spaces in Keys (The " Abbreviation" Bug)
              if (typeof item === 'object' && item !== null) {
                const cleanItem = {};
                Object.keys(item).forEach(objKey => {
                  const cleanKey = objKey.trim(); // Removes " " from " Abbreviation"
                  cleanItem[cleanKey] = item[objKey];
                });
                return cleanItem;
              }
              return item;
            });
          }
        });
        val = lists;
      }
      
      if (key) settingsObj[key] = val;
    }
    
    return settingsObj;

  } catch (e) {
    console.error("Settings Load Error:", e);
    return settingsObj;
  }
}

/* =========================================
   3. FILE SYSTEM & LOGS
   ========================================= */

function getSystemFolders() {
  const props = PropertiesService.getScriptProperties();
  let mainId = props.getProperty('EZD_MAIN_FOLDER_ID');
  let mainFolder;
  const audit = [];

  // 1. Try to connect using the exact stored ID
  if (mainId) { 
    try { 
      mainFolder = DriveApp.getFolderById(mainId); 
    } catch(e) { 
      mainId = null; // Folder was deleted or permissions lost
    } 
  }
  
  // 2. STRICT ID ENFORCEMENT: If no ID exists, do NOT search by name. 
  // Forcefully create a new, isolated ecosystem and lock in the new ID.
  if (!mainId) {
    mainFolder = DriveApp.createFolder("EZD_System_Files"); 
    audit.push("Root Folder"); 
    props.setProperty('EZD_MAIN_FOLDER_ID', mainFolder.getId());
  }

  const ensureSub = (name) => {
    const subs = mainFolder.getFoldersByName(name);
    if (subs.hasNext()) return subs.next();
    audit.push(name + " Folder");
    return mainFolder.createFolder(name);
  };

  return {
    mainFolder: mainFolder,
    imagesFolder: ensureSub("Images"),
    backupsFolder: ensureSub("Backups"),
    logsFolder: ensureSub("Logs"),
    logs: audit
  };
}

function writeToAuditLog(system, user, action, detail, id) {
  try {
    const LOG_FILE = "EZD_Master_Audit_Log.txt"; // <--- EZD
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const logLine = `${timestamp}\t${user}\t${action}\t${detail}\t${id}\n`;
    
    const files = system.logsFolder.getFilesByName(LOG_FILE);
    if (files.hasNext()) {
      const file = files.next();
      let content = file.getBlob().getDataAsString();
      if (content.length > 800000) { 
        file.setName(`Archived_Log_${Date.now()}.txt`);
        system.logsFolder.createFile(LOG_FILE, "TIMESTAMP\tUSER\tACTION\tDETAIL\tID\n" + logLine);
      } else {
        file.setContent(content + logLine);
      }
    } else {
      system.logsFolder.createFile(LOG_FILE, "TIMESTAMP\tUSER\tACTION\tDETAIL\tID\n" + logLine);
    }
  } catch (e) {
    console.error("Logger Failed: " + e.toString());
  }
}

/**
 * Runs automatically when the Google Sheet is opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ System Menu')
    .addItem('Sync & Format Database', 'manualSyncStructure') // Fixed the name mismatch!
    .addToUi();
    
  try {
    syncAttendanceStructure_();
  } catch(e) {
    console.warn("Silent sync on open paused. Use the FDS Admin menu to sync manually.");
  }
}

/**
 * Triggered by the Custom Menu
 */
function manualSyncStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Run the check and capture the text output of what happened
  const triggerStatus = checkSystemIntegrity(); 
  
  // 2. Sync the matrix
  try { syncAttendanceStructure_(); } catch(e) {}
  
  // 3. VISUAL FEEDBACK: Tell the user exactly what was installed
  let statusMessage = "All background triggers were already active.";
  if (triggerStatus.length > 0 && !triggerStatus[0].includes("ERROR")) {
    statusMessage = "Newly Installed: " + triggerStatus.join(", ");
  } else if (triggerStatus.length > 0 && triggerStatus[0].includes("ERROR")) {
    statusMessage = "Warning: " + triggerStatus[0];
  }

  ss.toast(
    statusMessage, 
    '✅ System Ready', 
    8
  );
}

// INTEGRITY CHECK (Frontend calls this)
function checkSystemIntegrity() {
  try {
    const sys = getSystemFolders();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const triggers = ScriptApp.getProjectTriggers();
    let installedList = [];
    
    // 1. Check for Backup Trigger
    const hasBackup = triggers.some(t => t.getHandlerFunction() === 'backupSystem');
    if (!hasBackup) {
      ScriptApp.newTrigger('backupSystem').timeBased().everyDays(1).atHour(2).create();
      installedList.push("Daily Backup");
    }

    // 2. Check for Manual Edit Trigger
    const hasEditTracker = triggers.some(t => t.getHandlerFunction() === 'trackManualEdits');
    if (!hasEditTracker) {
      ScriptApp.newTrigger('trackManualEdits').forSpreadsheet(ss).onEdit().create();
      installedList.push("Manual Edit Tracker");
    }
    
    // Log successful installations to the dashboard
    if (installedList.length > 0) {
      logToSystem("System Setup", "Auto-installed: " + installedList.join(", "), "System");
    }
    
    return installedList;
  } catch (e) {
    // If Google blocks it due to permissions, log the error!
    logToSystem("System Setup Error", e.message, "System");
    return ["ERROR: " + e.message];
  }
}

/* =========================================
   4. FILE UPLOADER
   ========================================= */
function uploadFileToDrive(base64Data, filename, mimeType) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const system = getSystemFolders();
    
    // Duplicate Check
    const existingFiles = system.imagesFolder.getFilesByName(filename);
    if (existingFiles.hasNext()) {
      const existingFile = existingFiles.next();
      writeToAuditLog(system, userEmail, "UPLOAD_DUPLICATE", filename, existingFile.getId());
      return { url: existingFile.getUrl(), id: existingFile.getId(), status: "matched" };
    }

    // Create New
    const data = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(data, mimeType, filename);
    const newFile = system.imagesFolder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    writeToAuditLog(system, userEmail, "UPLOAD_SUCCESS", filename, newFile.getId());
    
    // --- NEW: LOG TO UNIVERSAL DASHBOARD FEED ---
    logToSystem("Image Uploaded", `File: ${filename}`, "File System");
    
    return { url: newFile.getUrl(), id: newFile.getId(), status: "created" };

  } catch (e) {
    console.error("Upload Failed: " + e.toString());
    throw new Error("Upload failed: " + e.message);
  }
}

/* =========================================
   6. UNIVERSAL SYSTEM LOGGER
   ========================================= */
function logToSystem(action, detail, moduleName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName('SystemLogs');
    if (!logSheet) return;
    
    const user = Session.getActiveUser().getEmail() || "System User";
    
    // Structure: Timestamp | User | Action | Detail | Module
    logSheet.appendRow([new Date(), user, action, detail, moduleName || "System"]);
  } catch(e) {
    console.error("Logging failed: " + e.toString());
  }
}

/**
 * Catches MANUAL typing directly in the Google Sheet 
 */
function trackManualEdits(e) {    // <--- RENAMED FROM onEdit(e)
  if (!e || !e.range) return;
  const sheetName = e.range.getSheet().getName();
  
  // Ignore edits to log sheets to prevent infinite logging loops!
  const ignoredSheets = ['SystemLogs', 'BarcodeLogs', 'BarcodeArchived', 'Settings'];
  if (ignoredSheets.includes(sheetName)) return;

  let oldVal = e.oldValue;
  let newVal = e.value;
  
  if (oldVal === undefined && newVal === undefined) {
     oldVal = "Multiple Cells";
     newVal = "Updated";
  }

  const user = e.user ? e.user.getEmail() : (Session.getActiveUser().getEmail() || "Unknown");
  const detail = `[${sheetName}!${e.range.getA1Notation()}] changed from '${oldVal}' to '${newVal}'`;

  try {
    const logSheet = e.source.getSheetByName('SystemLogs');
    if (logSheet) logSheet.appendRow([new Date(), user, "Manual Sheet Edit", detail, "Google Sheets"]);
  } catch(err) {}
}
/* =========================================
   7. SMART BACKUP SYSTEM
   ========================================= */
function backupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const system = getSystemFolders();
  const timezone = ss.getSpreadsheetTimeZone();
  const dateStr = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  
  const logSheet = ss.getSheetByName('SystemLogs');
  let hasRecentActivity = false;
  
  if (logSheet && logSheet.getLastRow() > 1) {
    const lastRowTime = new Date(logSheet.getRange(logSheet.getLastRow(), 1).getValue()).getTime();
    const now = new Date().getTime();
    const hoursSinceLastEdit = (now - lastRowTime) / (1000 * 60 * 60);
    if (hoursSinceLastEdit <= 24) hasRecentActivity = true;
  }
  
  if (!hasRecentActivity) {
     console.log("No activity in last 24 hours. Skipping backup.");
     writeToAuditLog(system, "SYSTEM_AUTO", "BACKUP_SKIPPED", "No data changed in the last 24 hours.", "N/A");
     return; 
  }

  const backupName = `EZD_Backup_${dateStr}`; // <--- EZD
  const backupFile = DriveApp.getFileById(ss.getId()).makeCopy(backupName, system.backupsFolder);
  
  writeToAuditLog(system, "SYSTEM_AUTO", "BACKUP_CREATED", backupName, backupFile.getId());
  logToSystem("Backup Created", backupName, "System"); 
  
  cleanUpOldBackups(system.backupsFolder);
}

function cleanUpOldBackups(folder) {
  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const file = iter.next();
    if (file.getName().startsWith("EZD_Backup_")) { // <--- EZD
      files.push({ file: file, date: file.getDateCreated() });
    }
  }
  files.sort((a, b) => b.date - a.date);
  
  if (files.length > 120) {
    for (let i = 120; i < files.length; i++) {
      try { files[i].file.setTrashed(true); } catch (e) {}
    }
  }
}

function processBatchUpdate(updates) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    let ws = ss.getSheetByName("People"); 
    if (!ws) ws = ss.getSheets()[0]; 
    if (!ws) return { success: false, message: "No sheets found in spreadsheet." };
    
    const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
    
    const idColIndex = headers.indexOf("SystemID") + 1;
    const groupColIndex = headers.indexOf("Groups") + 1;
    
    if (idColIndex === 0) return { success: false, message: "Column 'SystemID' not found." };
    if (groupColIndex === 0) return { success: false, message: "Column 'Groups' not found." };
    
    const lastRow = ws.getLastRow();
    if (lastRow < 2) return { success: true, count: 0 }; 

    const ids = ws.getRange(2, idColIndex, lastRow - 1, 1).getValues().map(r => String(r[0]));
    
    updates.forEach(u => {
      const rowIndex = ids.indexOf(String(u.SystemID));
      if (rowIndex !== -1) {
        ws.getRange(rowIndex + 2, groupColIndex).setValue(u.Groups);
      }
    });

    // --- NEW: LOG TO UNIVERSAL DASHBOARD FEED ---
    logToSystem("Bulk Roster Update", `Updated groups for ${updates.length} users.`, "Roster");
    
    return { success: true, count: updates.length };
    
  } catch (e) {
    return { success: false, message: "Server Error: " + e.toString() };
  }
}
