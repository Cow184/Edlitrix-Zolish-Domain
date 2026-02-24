/**
 * ==========================================
 * SHEET STRUCTURAL SYNC ENGINE (V7 - Header Aesthetics)
 * ==========================================
 */

function syncAttendanceStructure_(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const attSheet = ss.getSheetByName('Attendance');
  if (!attSheet) return;
  
  const people = getDataAsObjects_('User Database', ss).filter(p => p.SystemID);

  const parseDateTime = (dateStr, timeStr) => {
    if (!dateStr) return new Date(0);
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date(0);
    if (timeStr) {
        let t = String(timeStr).trim().toUpperCase();
        let match = t.match(/(\d+):(\d+)/);
        if (match) {
            let h = parseInt(match[1]), m = parseInt(match[2]);
            if (t.includes('PM') && h < 12) h += 12;
            if (t.includes('AM') && h === 12) h = 0;
            d.setHours(h, m, 0);
        }
    }
    return d;
  };

  const events = getDataAsObjects_('Events', ss).sort((a, b) => {
    return parseDateTime(a.Date, a.StartTime) - parseDateTime(b.Date, b.StartTime);
  });

  const attendanceMap = {}; 
  const lastRow = attSheet.getLastRow();
  const lastCol = attSheet.getLastColumn();

  // 1. Safely extract existing attendance records before clearing
  if (lastRow > 0 && lastCol >= 3) {
    const range = attSheet.getRange(1, 1, lastRow, lastCol);
    const values = range.getValues();
    const notes = range.getNotes();
    const headers = values[0];
    const headerNotes = notes[0];

    const colToEventId = {};
    for (let c = 3; c < headers.length; c++) {
      let eId = headers[c];
      // System uses the hidden Note ID as the source of truth, so changing visual titles won't break it
      if (headerNotes[c] && headerNotes[c].includes("ID: ")) {
        eId = headerNotes[c].split('\n')[0].replace("ID: ", "").trim();
      }
      colToEventId[c] = eId;
    }

    for (let r = 1; r < values.length; r++) {
      const sysId = String(values[r][0]);
      if (!sysId) continue;
      attendanceMap[sysId] = {};
      for (let c = 3; c < headers.length; c++) {
        const eId = colToEventId[c];
        if (eId && (values[r][c] || notes[r][c])) {
          attendanceMap[sysId][eId] = { status: values[r][c], note: notes[r][c] };
        }
      }
    }
  }

  // 2. Build the new Header Arrays
  const newValues = [];
  const newNotes = [];
  const hVals = ['SystemID', 'StudentID', 'Name'];
  const hNotes = ['', '', ''];
  
  // Custom Arrays to paint the header cells
  const headerBgs = ['#f8fafc', '#f8fafc', '#f8fafc']; 
  const headerFonts = ['#000000', '#000000', '#000000']; 

  events.forEach(evt => {
    // A. Format the Date (e.g., "10/24 - Tech Rehearsal")
    let shortDate = "TBD";
    if (evt.Date) {
        let dObj = new Date(evt.Date);
        if (!isNaN(dObj.getTime())) {
            shortDate = (dObj.getMonth() + 1) + '/' + dObj.getDate();
        }
    }
    hVals.push(`${shortDate} - ${evt.Title}`);

    // B. Inject Header Notes
    const isBarcode = String(evt.AutoBarcode).toUpperCase() === 'TRUE';
    const dateStr = evt.Date ? new Date(evt.Date).toLocaleDateString() : 'N/A';
    let noteText = `ID: ${evt.EventID}\nDate: ${dateStr}\n------------------------\nBarcode: ${isBarcode ? '🟢 ON' : '🔴 OFF'}`;
    hNotes.push(noteText);

    // C. Determine Color based on Type AND Title (Bulletproof)
    let bg = '#64748b'; // Default Grey (Other/Meeting)
    
    // Combine Type and Title into one lowercase search string to catch everything
    let searchStr = String(evt.Type || '').toLowerCase() + " " + String(evt.Title || '').toLowerCase();
    
    if (searchStr.includes('rehearsal') || searchStr.includes('rehersal')) bg = '#3b82f6'; // Blue
    else if (searchStr.includes('performance') || searchStr.includes('show')) bg = '#ef4444'; // Red
    else if (searchStr.includes('fitting') || searchStr.includes('costume')) bg = '#10b981'; // Green
    else if (searchStr.includes('work') || searchStr.includes('build') || searchStr.includes('tech')) bg = '#f59e0b'; // Orange

    headerBgs.push(bg);
    headerFonts.push('#ffffff'); // White text on colored headers
  });

  newValues.push(hVals);
  newNotes.push(hNotes);

  // 3. Build the Data Rows
  people.forEach(p => {
    const sysId = String(p.SystemID);
    const rVals = [sysId, String(p.StudentID || ""), `${p.FirstName} ${p.LastName}`];
    const rNotes = ['', '', ''];
    
    events.forEach(evt => {
      const rec = attendanceMap[sysId] ? attendanceMap[sysId][evt.EventID] : null;
      let status = rec ? String(rec.status).trim() : '';
      
      const isCalled = isPersonCalled_(p, evt);

      // --- THE SMART PRE-FILL ENGINE ---
      if (status === '' && isCalled) {
          status = 'Missing';
      } else if (status === 'Missing' && !isCalled) {
          status = '';
      }

      rVals.push(status);
      rNotes.push(rec ? rec.note : '');
    });
    
    newValues.push(rVals);
    newNotes.push(rNotes);
  });

  // 4. Wipe and Write to Sheet
  attSheet.clear(); 
  if (newValues.length > 0) {
    const targetRange = attSheet.getRange(1, 1, newValues.length, newValues[0].length);
    targetRange.setValues(newValues);
    targetRange.setNotes(newNotes);
    
    // Paint the Headers!
    attSheet.getRange(1, 1, 1, headerBgs.length)
            .setBackgrounds([headerBgs])
            .setFontColors([headerFonts])
            .setFontWeight("bold");

    attSheet.setFrozenRows(1);
    attSheet.setFrozenColumns(3);
  }

  // 5. Data Validation & Conditional Formatting
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Missing', 'Present', 'Late', 'Excused Late', 'Checked Out', 'Early Leave', 'Absent', 'Excused'], true)
    .setAllowInvalid(false)
    .build();

  if (attSheet.getLastColumn() > 3 && attSheet.getLastRow() > 1) {
      attSheet.getRange(2, 4, attSheet.getLastRow() - 1, attSheet.getLastColumn() - 3).setDataValidation(statusRule);
  }
  setupAttendanceFormatting();
}

function setupAttendanceFormatting() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if(!sheet) return;
  sheet.clearConditionalFormatRules();
  
  if (sheet.getMaxRows() < 2 || sheet.getMaxColumns() < 4) return;
  
  const range = sheet.getRange(2, 4, sheet.getMaxRows(), sheet.getMaxColumns()-3);
  
  // Cleaned up validation rules to match the 6 core statuses
  const colors = [
    {t:'Present', b:'#dcfce7', f:'#166534'},
    {t:'Late', b:'#fef3c7', f:'#b45309'},
    {t:'Checked Out', b:'#f1f5f9', f:'#475569'}, 
    {t:'Absent', b:'#fee2e2', f:'#991b1b'},
    {t:'Excused', b:'#dbeafe', f:'#1e40af'},
    {t:'Missing', b:'#f3f4f6', f:'#6b7280'}
  ];
  
  const rules = colors.map(c => SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(c.t).setBackground(c.b).setFontColor(c.f).setRanges([range]).build());
  
  // Set Validation Rule
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Missing', 'Present', 'Late', 'Checked Out', 'Absent', 'Excused'], true)
    .setAllowInvalid(false)
    .build();
    
  range.setDataValidation(statusRule);
  sheet.setConditionalFormatRules(rules);
}

// ==========================================
// PRE-FILL HELPERS
// ==========================================

function parseArr_(val) {
    try { return JSON.parse(val || "[]"); } catch(e) { return []; }
}

function isPersonCalled_(person, event) {
    const reqGroups = parseArr_(event.RequiredGroups);
    const reqRoles = parseArr_(event.RequiredRoles);
    const reqPeople = parseArr_(event.RequiredPeople);
    
    const fullName = `${person.FirstName} ${person.LastName}`;
    if (reqPeople.includes(String(person.SystemID)) || reqPeople.includes(fullName)) return true;
    
    if (reqRoles.includes(String(person.Role))) return true;
    
    const pGroups = parseArr_(person.Groups);
    if (reqGroups.some(g => pGroups.includes(g))) return true;
    
    return false;
}
