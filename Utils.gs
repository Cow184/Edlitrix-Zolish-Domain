/**
 * ============================================
 * SHARED UTILITIES (PRO VERSION)
 * ============================================
 */

const FDS_SHEETS = {
  DATABASE: 'User Database',
  SETTINGS: 'Settings',
  LOGS: 'SystemLogs',
  WELLNESS: 'Wellness',
  AUDITIONS: 'Auditions',
  REHEARSALS: 'Rehearsals'
};

/**
 * Trims a sheet to only include columns that have a header in Row 1.
 */
function hardCleanColumns(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const maxCols = sheet.getMaxColumns();
  const lastHeaderCol = sheet.getLastColumn(); // Finds the last column with any data

  if (maxCols > lastHeaderCol) {
    sheet.deleteColumns(lastHeaderCol + 1, maxCols - lastHeaderCol);
    console.log(`🧹 Utils: Hard-trimmed ${maxCols - lastHeaderCol} empty columns from ${sheetName}`);
  }
}

/**
 * Advanced formatting for sheets: Zebra stripes and Smart Resizing.
 */
function applyPremiumFormatting(sheet) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return;

  // 1. Remove any old banding to prevent overlap errors
  sheet.getBandings().forEach(b => b.remove());

  // 2. Apply "Zebra Stripes" (Grey/White)
  // Starting from Row 2 to preserve the colored header
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol)
         .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  }

  // 3. Smart Column Resizing with Padding
  sheet.autoResizeColumns(1, lastCol);
  for (let i = 1; i <= lastCol; i++) {
    const currentWidth = sheet.getColumnWidth(i);
    // Add 20 pixels of extra "breathing room" to every column
    sheet.setColumnWidth(i, currentWidth + 20);
  }

  // 4. Header Freeze and Row Height
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);
}

/**
 * Log an action to the SystemLogs sheet.
 * Standardized to match the 5-column setup in SetupCode.gs.
 */
function logAction(user, action, module, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(FDS_SHEETS.LOGS);
    
    if (!sheet) return; // Fail silently to not crash the UI
    
    // Header: ['Timestamp', 'User', 'Action', 'Details', 'Meta']
    sheet.appendRow([new Date(), user, action, details, module]);
    
    // Auto-trim logs to 1000 rows to maintain speed
    const lastRow = sheet.getLastRow();
    if (lastRow > 1000) {
      sheet.deleteRows(2, lastRow - 1000);
    }
  } catch (error) {
    console.error('Logging Error:', error);
  }
}

/**
 * Master Utility: Trims every sheet to match the exact width of its headers.
 */
function cleanAllEmptyColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // This map must match the one in SetupCode.gs exactly
  const headersMap = {
    'User Database': 28, // Count of columns in headersMap
    'Settings': 5,
    'Wellness': 6,
    'Auditions': 6,
    'Rehearsals': 11,
    'Conflicts': 5,
    'BarcodeLogs': 6,
    'Corrections': 4,
    'Archive': 2,
    'SystemLogs': 5
  };

  Object.keys(headersMap).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const maxCols = sheet.getMaxColumns();
    const targetCols = headersMap[sheetName];

    if (maxCols > targetCols) {
      // Delete every column from the one after the last header to the very end
      sheet.deleteColumns(targetCols + 1, maxCols - targetCols);
      console.log(`🧹 Trimming ${sheetName}: Removed ${maxCols - targetCols} columns.`);
    }
  });
}

// Example usage: cleanSheetColumns('Settings');

/**
 * Get data from a sheet as JSON objects.
 * Standardized for the 28-column User Database.
 */
function getSheetDataAsJSON(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet || sheet.getLastRow() <= 1) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      // Date formatting for HTML inputs
      if (row[index] instanceof Date) {
        obj[header] = Utilities.formatDate(row[index], ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
      } else {
        obj[header] = row[index] || "";
      }
    });
    return obj;
  });
}

/**
 * Generates a unique SystemID (e.g., USR-A1B2)
 */
function generateSystemID(prefix = 'USR') {
  return prefix + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}
