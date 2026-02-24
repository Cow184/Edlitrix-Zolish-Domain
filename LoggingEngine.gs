/**
 * ==========================================
 * GLOBAL LOGGING ENGINE (V1)
 * ==========================================
 */

// 1. SYSTEM LOGS (People, Events, Admin)
function logSystemAction_(moduleName, actionType, targetID, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('SystemLogs');
    
    // Auto-create if missing
    if (!sheet) {
      sheet = ss.insertSheet('SystemLogs');
      sheet.appendRow(['Timestamp', 'UserEmail', 'Module', 'Action', 'TargetID', 'Details']);
      sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#f8fafc");
      sheet.setFrozenRows(1);
    }

    const user = Session.getActiveUser().getEmail() || "System";
    const detailString = typeof details === 'object' ? JSON.stringify(details) : String(details);
    
    sheet.appendRow([new Date(), user, moduleName, actionType, targetID, detailString]);
  } catch (e) {
    console.error("System Logging Failed:", e);
  }
}

// 2. ATTENDANCE LOGS (Clean Ledger of Status Changes)
function logAttendanceChange_(method, systemId, eventId, status, note) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('AttendanceLogs');
    
    // Auto-create if missing
    if (!sheet) {
      sheet = ss.insertSheet('AttendanceLogs');
      sheet.appendRow(['Timestamp', 'UserEmail', 'Method', 'SystemID', 'EventID', 'NewStatus', 'Notes']);
      sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#f8fafc");
      sheet.setFrozenRows(1);
    }

    const user = Session.getActiveUser().getEmail() || "ScannerBot";
    
    sheet.appendRow([new Date(), user, method, systemId, eventId, status, note || ""]);
  } catch (e) {
    console.error("Attendance Logging Failed:", e);
  }
}
