/**
 * ADMIN SAVE HANDLER (AdminCode.gs)
 */
function saveAdminSettings(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) throw new Error("Settings sheet missing");

    const data = sheet.getDataRange().getValues();
    
    // Map payload keys to Settings Sheet keys
    // payload.custom_lists is an OBJECT here, we must stringify it for storage
    const updates = {
      'production_title': payload.production_title,
      'org_name': payload.org_name,
      'academic_year': payload.academic_year,
      'org_type': payload.org_type,
      'default_landing_module': payload.default_landing_module,
      'custom_lists': JSON.stringify(payload.custom_lists) // <--- CRITICAL: Stringify
    };

    // Iterate rows and update matches
    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][0]).trim();
      
      if (updates.hasOwnProperty(key)) {
        // Update Value (Col 2)
        sheet.getRange(i + 1, 2).setValue(updates[key]);
        
        // Update Metadata (Cols 3, 4, 5 if they exist)
        // Col 4 = Timestamp, Col 5 = User
        if (sheet.getLastColumn() >= 4) {
           sheet.getRange(i + 1, 4).setValue(new Date());
           sheet.getRange(i + 1, 5).setValue(Session.getActiveUser().getEmail());
        }
      }
    }
    
    // Log it
    const system = getSystemFolders(); // From Code.gs
    writeToAuditLog(system, Session.getActiveUser().getEmail(), "SETTINGS_UPDATE", "Updated Admin Config", "-");

    return { success: true };

  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
