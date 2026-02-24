/**
 * ==========================================
 * ATTENDANCE MODULE (V18 - Simplified Core Statuses)
 * ==========================================
 */

function processScanQueue(ssFromBridge) {
  let ss = ssFromBridge;
  if (!ss) { try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { return "Error: No Context"; } }

  const logSheet = ss.getSheetByName('BarcodeLogs');
  const archSheet = ss.getSheetByName('BarcodeArchived');
  const attSheet = ss.getSheetByName('Attendance');
  
  if (!logSheet || !archSheet || !attSheet) return "Error: Missing Sheets";

  const logs = logSheet.getDataRange().getValues();
  if (logs.length < 2) return "No new scans.";

  const users = getDataAsObjects_('User Database', ss); 
  const events = getDataAsObjects_('Events', ss);
  const currentAttendance = getAttendanceDashboardData(ss, true); 
  
  const toArchive = [];
  const logHeaders = logs[0];
  const scanRows = logs.slice(1);
  let processedCount = 0;

  scanRows.forEach((row) => {
    const scan = {};
    logHeaders.forEach((h, idx) => scan[h] = row[idx]);

    let matchStatus = "Unmatched";
    let failureReason = "";
    let finalEvent = null;
    let newStatus = "Unknown";
    let newNote = "";

    const person = users.find(u => String(u.StudentID).trim() === String(scan.ScannedValue).trim() || String(u.SystemID).trim() === String(scan.ScannedValue).trim());

    if (!person) {
      failureReason = `ID '${scan.ScannedValue}' not found.`;
    } else {
      const scanTime = new Date(scan.Timestamp);
      const timeCandidates = events.filter(e => {
        if(!e.Date) return false;
        const [sH, sM] = parseTime_(e.StartTime);
        const [eH, eM] = parseTime_(e.EndTime);
        const start = new Date(e.Date); start.setHours(sH, sM, 0);
        const end = new Date(e.Date); end.setHours(eH, eM, 0);
        if (end < start) end.setDate(end.getDate() + 1);
        const startBound = new Date(start.getTime() - (60 * 60 * 1000));
        const endBound = new Date(end.getTime() + (60 * 60 * 1000));
        return scanTime >= startBound && scanTime <= endBound;
      });

      if (timeCandidates.length === 0) failureReason = "Scan ignored: No active events.";
      else {
        finalEvent = timeCandidates[0]; 
        matchStatus = "Matched";
        
        const existingRecord = currentAttendance.find(a => a.EventID === finalEvent.EventID && a.SystemID === person.SystemID);
        let noteData = existingRecord ? existingRecord.Note : "";
        let currentStatus = existingRecord ? existingRecord.Status : "";
        const timeStr = scanTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true});
        
        // --- CHECK-IN LOGIC ---
        if (!noteData.includes("[IN:")) {
            const [sH, sM] = parseTime_(finalEvent.StartTime);
            let expectedStart = new Date(finalEvent.Date); 
            expectedStart.setHours(sH, sM, 0);
            
            const arriveMatch = noteData.match(/\[ARRIVE:\s*([^\]]+)\]/);
            if (arriveMatch) {
                const [aH, aM] = parseTime_(arriveMatch[1]);
                expectedStart.setHours(aH, aM, 0);
            }
            
            const graceMins = parseInt(finalEvent.GracePeriod) || 0;
            const lateTime = new Date(expectedStart.getTime() + (graceMins * 60000));
            
            newStatus = (scanTime <= lateTime) ? "Present" : "Late";
            newNote = `[IN_SRC: BARCODE] [IN: ${timeStr}] \n${noteData}`.trim();
            
        // --- CHECK-OUT LOGIC ---
        } else if (!noteData.includes("[OUT:")) {
            const inMatch = noteData.match(/\[IN:\s*([^\]]+)\]/);
            if (inMatch) {
                const [inH, inM] = parseTime_(inMatch[1]);
                const inTime = new Date(scanTime); inTime.setHours(inH, inM, 0);
                const diffMins = (scanTime - inTime) / 60000;
                
                if (diffMins < 2) {
                    matchStatus = "Ignored";
                    failureReason = "Anti-Bounce: 2 min shield.";
                } else {
                    const [eH, eM] = parseTime_(finalEvent.EndTime);
                    let expectedEnd = new Date(finalEvent.Date); 
                    expectedEnd.setHours(eH, eM, 0);
                    
                    const departMatch = noteData.match(/\[DEPART:\s*([^\]]+)\]/);
                    if (departMatch) {
                        const [dH, dM] = parseTime_(departMatch[1]);
                        expectedEnd.setHours(dH, dM, 0);
                    }
                    
                    // --- SMART CHECKOUT LOGIC (10 Min Grace Period) ---
                    const graceTime = new Date(expectedEnd.getTime() - (10 * 60000));
                    
                    newStatus = "Checked Out"; 
                    if (scanTime < graceTime) {
                        noteData = "[EARLY_LEAVE: TRUE] " + noteData; // Inject Early Leave Warning
                    }
                    newNote = `[OUT_SRC: BARCODE] [OUT: ${timeStr}] \n${noteData}`.trim();
                }
            }
        } else {
            matchStatus = "Ignored";
            failureReason = "Already finished.";
        }
      }
    }

    if (matchStatus === "Matched" && finalEvent && person) {
        if (!newNote.includes("DO NOT TOUCH")) {
            newNote += `\n\n=== SYSTEM METADATA ===\nDO NOT TOUCH OR DELETE`;
        }
        writeToMatrix_(ss, person, finalEvent, newStatus, newNote, false);
        processedCount++;
    }

    toArchive.push([
      scan.LogID, scan.ScannedValue, scan.Timestamp, scan.ScanType, scan.LocationGPS, scan.ScannedBy, 
      new Date(), 
      matchStatus === "Matched" ? `Success: ${finalEvent.Title} (${newStatus})` : `Rejected: ${failureReason}`
    ]);
  });

  if (toArchive.length > 0) archSheet.getRange(archSheet.getLastRow() + 1, 1, toArchive.length, toArchive[0].length).setValues(toArchive);
  if (scanRows.length > 0) logSheet.deleteRows(2, scanRows.length);

  return `Processed ${scanRows.length} scans.`;
}

function updateManualAttendance(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const events = getDataAsObjects_('Events', ss);
  const people = getDataAsObjects_('User Database', ss);
  const evt = events.find(e => e.EventID === payload.EventID);
  const per = people.find(p => String(p.SystemID) === String(payload.SystemID));
  if (!evt || !per) return "Error";

  let note = payload.Note;
  if (note && !note.includes("DO NOT TOUCH")) {
      note += `\n\n=== SYSTEM METADATA ===\nDO NOT TOUCH OR DELETE`;
  }

  writeToMatrix_(ss, per, evt, payload.Status, note);
  
  // --- NEW: LOG TO UNIVERSAL DASHBOARD FEED ---
  let statusLog = payload.Status;
  if (!statusLog || statusLog === "") statusLog = "Cleared/Missing";
  let cleanNote = payload.Note ? payload.Note.replace(/\[.*?\]/g, '').replace(/===.*?===/g, '').trim() : "";
  if (cleanNote) cleanNote = " - " + cleanNote;

  logToSystem("Attendance Updated", `${per.FirstName} ${per.LastName} marked as [${statusLog}]${cleanNote}`, "Attendance");

  return "Updated";
}

function processAbsencesNow(eventId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Attendance');
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if(lastRow < 2 || lastCol < 4) return {count: 0};
    
    const headerNotes = sheet.getRange(1, 1, 1, lastCol).getNotes()[0];
    let col = -1;
    for (let c = 3; c < headerNotes.length; c++) {
        if (headerNotes[c] && headerNotes[c].includes(eventId)) { col = c + 1; break; }
    }
    if(col === -1) return {count: 0};
    
    const range = sheet.getRange(2, col, lastRow - 1, 1);
    const values = range.getValues();
    const bgs = range.getBackgrounds();
    let count = 0;
    
    for(let r=0; r<values.length; r++) {
        if(values[r][0] === 'Missing') {
            values[r][0] = 'Absent';
            bgs[r][0] = '#fee2e2'; // Light red
            count++;
        }
    }
    if(count > 0) {
        range.setValues(values);
        range.setBackgrounds(bgs);
        // --- NEW: LOG TO UNIVERSAL DASHBOARD FEED ---
        logToSystem("Processed Absences", `Locked ${count} Missing personnel as Absent.`, "Attendance");
    }
    return {count: count};
  } catch(e) {
    return {count: 0, error: e.toString()};
  }
}

function writeToMatrix_(ss, person, event, status, noteContent) {
  const sheet = ss.getSheetByName('Attendance');
  if (!sheet) return false;

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastCol < 4 || lastRow < 2) return false;

  const headerNotes = sheet.getRange(1, 1, 1, lastCol).getNotes()[0];
  const rangeIDs = sheet.getRange(1, 1, lastRow, 1).getValues(); 
  
  let col = -1;
  for (let c = 3; c < headerNotes.length; c++) {
      if (headerNotes[c] && headerNotes[c].includes(event.EventID)) { col = c + 1; break; }
  }
  
  const sysID = String(person.SystemID);
  let row = -1;
  for(let i=0; i<rangeIDs.length; i++) {
      if (String(rangeIDs[i][0]) === sysID) { row = i + 1; break; }
  }
  if (row === -1 || col === -1) return false;

  const cell = sheet.getRange(row, col);
  
  if (status !== undefined && status !== null) {
      // Updated valid statuses
      const validStatuses = ['Missing', 'Present', 'Late', 'Checked Out', 'Absent', 'Excused', ''];
      if (validStatuses.includes(status)) {
          cell.setValue(status);
          const colors = {'Present':'#dcfce7','Late':'#fef3c7','Checked Out':'#f1f5f9','Absent':'#fee2e2','Excused':'#dbeafe','Missing':'#f3f4f6','': '#ffffff'};
          if (colors[status]) cell.setBackground(colors[status]);
      }
  }
  if (noteContent !== undefined) {
      cell.setNote(noteContent === "" ? null : noteContent);
  }
  return true;
}

// Global data fetcher
function getAttendanceDashboardData(ssOverride, returnObjects = false) {
  try {
    const ss = ssOverride || SpreadsheetApp.getActiveSpreadsheet();
    const events = getDataAsObjects_('Events', ss);
    const people = getDataAsObjects_('User Database', ss);
    const attSheet = ss.getSheetByName('Attendance');
    const attendance = [];
    
    if (attSheet && attSheet.getLastRow() > 1) {
        const data = attSheet.getDataRange().getValues();
        const notes = attSheet.getDataRange().getNotes(); 
        const headerNotes = notes[0]; 
        
        for (let r = 1; r < data.length; r++) {
            const sysID = String(data[r][0]); 
            if (!sysID) continue;
            
            for (let c = 3; c < data[0].length; c++) {
                const status = data[r][c];
                const note = notes[r][c]; 
                
                let colEventID = null;
                if (headerNotes[c] && headerNotes[c].includes("ID: ")) {
                    colEventID = headerNotes[c].split('\n')[0].replace("ID: ", "").trim();
                }
                
                if ((status || note) && colEventID) {
                    const matchedEvent = events.find(e => e.EventID === colEventID);
                    if (matchedEvent) {
                        attendance.push({
                            EventID: matchedEvent.EventID,
                            SystemID: sysID,
                            Status: status || "",
                            Note: note || ""
                        });
                    }
                }
            }
        }
    }
    return returnObjects ? attendance : JSON.stringify({ events, attendance, people });
  } catch (e) {
    return returnObjects ? [] : JSON.stringify({ events: [], attendance: [], people: [] });
  }
}

function getDataAsObjects_(sheetName, optSS) {
  const ss = optSS || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function parseTime_(val) {
    if (!val) return [0, 0];
    const sVal = String(val).trim().toUpperCase();
    const match = sVal.match(/(\d+):(\d+)/);
    if (match) {
        let h = parseInt(match[1]), m = parseInt(match[2]);
        if (sVal.includes('PM') && h < 12) h += 12;
        if (sVal.includes('AM') && h === 12) h = 0;
        return [h, m];
    }
    return [0, 0];
}
