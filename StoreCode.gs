/**
 * ==========================================
 * GLOBAL STORE ENGINE (V3 - Stable Timestamps)
 * ==========================================
 */

function getCoreStore() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- THE FIX: THIS RUNS EVERY TIME THE WEBPAGE LOADS ---
    checkSystemIntegrity(); 

    const payload = {
      success: true,
      people: tableToJson(ss.getSheetByName('User Database').getDataRange().getValues()),
      events: tableToJson(ss.getSheetByName('Events').getDataRange().getValues()),
      settings: getSystemSettings()
    };
    return JSON.stringify(payload);
  } catch(e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}

// HEAVY LOAD: Only pulls the complex matrix (Used by the 5-second poller)
function getAttendanceStore() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- FORCE QUEUE PROCESSING BEFORE RETURNING DATA ---
    if (typeof processScanQueue === 'function') {
        processScanQueue(ss); 
    }
    // ----------------------------------------------------

    const events = getDataAsObjects_('Events', ss); 
    const attendance = parseAttendanceMatrix_(ss, events);

    return JSON.stringify({
      success: true,
      attendance: attendance
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}
// Helper: Flattens the 2D visual matrix and extracts stable times
function parseAttendanceMatrix_(ss, eventsData) {
  const attSheet = ss.getSheetByName('Attendance');
  const attendance = [];
  
  if (attSheet && attSheet.getLastRow() > 1) {
      const data = attSheet.getDataRange().getValues();
      const notes = attSheet.getDataRange().getNotes();
      const headerNotes = notes[0]; // THE FIX: Grab Header Notes
      
      for (let r = 1; r < data.length; r++) {
          const sysID = String(data[r][0]); 
          if (!sysID) continue;
          
          for (let c = 3; c < data[0].length; c++) {
              const status = data[r][c];
              const note = notes[r][c];
              
              // THE FIX: Extract EventID from header note safely
              let colEventID = null;
              if (headerNotes[c] && headerNotes[c].includes("ID: ")) {
                  colEventID = headerNotes[c].split('\n')[0].replace("ID: ", "").trim();
              }
              
              if ((status || note) && colEventID) {
                  const matchedEvent = eventsData.find(e => e.EventID === colEventID);
                  const eID = matchedEvent ? matchedEvent.EventID : colEventID;
                  
                  let timeStamp = 0;
                  if (note) {
                      const manualMatch = note.match(/on\s+(.+)\s+at\s+([^\]]+)\]/);
                      const scannerMatch = note.match(/In:\s*([^\n]+)/);
                      
                      if (manualMatch) {
                          timeStamp = new Date(`${manualMatch[1]} ${manualMatch[2]}`).getTime();
                      } else if (scannerMatch && matchedEvent && matchedEvent.Date) {
                          let baseDate = new Date(matchedEvent.Date).toLocaleDateString('en-US');
                          timeStamp = new Date(`${baseDate} ${scannerMatch[1]}`).getTime();
                      }
                  }
                  
                  attendance.push({
                      EventID: eID,
                      SystemID: sysID,
                      Status: status || "",
                      Note: note || "",
                      CheckInTime: isNaN(timeStamp) ? 0 : timeStamp 
                  });
              }
          }
      }
  }
  return attendance;
}

/**
 * Attached to the custom "Sync" menu button in Google Sheets.
 * Optimally checks the People and Events sheets for formatting discrepancies,
 * paints them if necessary, and triggers the Attendance grid sync.
 */
function runManualSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Helper function to optimally format a specific database sheet
  function optimizeAndFormat(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return; // Nothing to format
    
    // Read headers to find 'Status' column
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const statusIdx = headers.indexOf('Status');
    if (statusIdx === -1) return;
    
    // Bulk read all data and JUST Column A's backgrounds
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const data = dataRange.getValues();
    const colABgs = sheet.getRange(2, 1, lastRow - 1, 1).getBackgrounds();
    
    const newBgs = [];
    const newFonts = [];
    const newLines = [];
    let needsRepaint = false;
    
    for (let i = 0; i < data.length; i++) {
      const isArchived = (data[i][statusIdx] === 'Archived');
      
      // Define our expected colors based on Status
      const targetBg = isArchived ? '#f1f5f9' : '#ffffff';
      const targetFont = isArchived ? '#94a3b8' : '#000000';
      const targetLine = isArchived ? 'line-through' : 'none';
      
      // THE OPTIMIZATION: Check if the current row's Col A matches the target
      if (colABgs[i][0] !== targetBg) {
        needsRepaint = true;
      }
      
      // We build the full arrays in memory (this is essentially instantaneous)
      newBgs.push(new Array(lastCol).fill(targetBg));
      newFonts.push(new Array(lastCol).fill(targetFont));
      newLines.push(new Array(lastCol).fill(targetLine));
    }
    
    // Only execute the expensive API write if a discrepancy was found
    if (needsRepaint) {
      dataRange.setBackgrounds(newBgs);
      dataRange.setFontColors(newFonts);
      dataRange.setFontLines(newLines);
    }
  }

  // 1. Process People Sheet
  optimizeAndFormat('User Database');
  
  // 2. Process Events Sheet
  optimizeAndFormat('Events');
  
  // 3. Process Attendance Sheet (Using your existing 2D Engine)
  if (typeof syncAttendanceStructure_ === 'function') {
    syncAttendanceStructure_(ss);
  }
  
  // 4. Notify the user it's done
  SpreadsheetApp.getUi().alert(
    "✅ Sync Complete", 
    "Database formatting and the Attendance grid have been successfully optimized and refreshed.", 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
