/**
 * ==========================================
 * DASHBOARD SERVER LOGIC
 * ==========================================
 */

function getRecentSystemLogs() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SystemLogs');
    if (!sheet || sheet.getLastRow() < 2) return [];
    
    const data = sheet.getDataRange().getValues();
    
    // Grab the last 8 rows (reversed so newest is first)
    const rows = data.slice(1).reverse().slice(0, 8); 
    
    return rows.map(r => {
      let dateObj = new Date(r[0]);
      let timeStr = "Unknown Time";
      if (!isNaN(dateObj.getTime())) {
          timeStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "MMM dd, h:mm a");
      }
      return {
        Timestamp: timeStr,
        User: String(r[1] || "System"),
        Action: String(r[2] || "Update"),
        Detail: String(r[3] || "")
      };
    });
  } catch (e) {
    return [];
  }
}
