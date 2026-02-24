/**
 * ==========================================
 * UNIFIED SETUP SCRIPT (V24 - Full System Sync)
 * ==========================================
 */

function runSetup(setupData) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('No active spreadsheet found.');
    
    // 1. Initialize
    initializeAllSheets(spreadsheet);
    populateSystemSettings(spreadsheet, setupData);
    
    // 2. Add Admin
    const dbSheet = spreadsheet.getSheetByName('User Database');
    if (dbSheet && dbSheet.getLastRow() <= 1) {
        addAdminToDatabase(dbSheet, userEmail, setupData.adminName);
    }

    if (setupData.productionTitle) spreadsheet.setName("FDS - " + setupData.productionTitle);
    
    // 3. Formatting
    formatUserDatabase();
    setupArchivedFormatting(); 
    
    // 4. SYNC (With New Statuses)
    syncAttendanceMatrix();
    setupAttendanceFormatting(); 
    
    // 5. FLAG COMPLETE
    const props = PropertiesService.getScriptProperties();
    props.setProperty('system_initialized', 'true');
    props.setProperty('owner_email', userEmail);
    
    forceSheetTrue(spreadsheet);
    
    logSystemAction(userEmail, "SYSTEM_SETUP", "System Initialized (V24)");

    return { success: true, message: 'Setup Complete!' };
  } catch (error) {
    console.error("Setup Error:", error);
    return { success: false, message: "Error: " + error.toString() };
  }
}

/**
 * 🛠️ HELPER: Forces 'true' string in Settings Sheet
 */
function forceSheetTrue(ss) {
  const sheet = ss.getSheetByName('Settings');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'system_initialized') {
       const cell = sheet.getRange(i + 1, 2);
       cell.setNumberFormat('@'); 
       cell.setValue('true'); 
       return;
    }
  }
}

/**
 * 🏗️ SYNC ATTENDANCE MATRIX
 */
function syncAttendanceMatrix() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let attSheet = ss.getSheetByName('Attendance');
  
  if (!attSheet) attSheet = ss.insertSheet('Attendance');
  
  // 1. RESET FIXED AREA (Cols A-C)
  attSheet.getRange("A:C").clearDataValidations();
  
  if (attSheet.getLastColumn() < 3 || attSheet.getRange(1,1).getValue() !== "SystemID") {
      attSheet.getRange(1, 1, 1, 3).setValues([['SystemID', 'StudentID', 'User']]);
      attSheet.setFrozenRows(1);
      attSheet.setFrozenColumns(3);
      attSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#065f46').setFontColor('white');
  }

  attSheet.setColumnWidth(1, 120); 
  attSheet.setColumnWidth(2, 100); 
  attSheet.setColumnWidth(3, 200); 

  const userSheet = ss.getSheetByName('User Database');
  const evtSheet = ss.getSheetByName('Events');
  if(!userSheet || !evtSheet) return;

  const users = getDataAsObjects_setup('User Database', ss);
  const events = getDataAsObjects_setup('Events', ss);

  // A. CLEAN UP JUNK
  const lastCol = Math.max(attSheet.getLastColumn(), 3);
  const headers = attSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = headers.length - 1; i >= 3; i--) { 
      if (/^Event\d+$/.test(headers[i]) || headers[i] === "") attSheet.deleteColumn(i + 1);
  }

  // B. FORCE VALIDATION (Updated with Excused Late & Early Leave)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Missing', 'Present', 'Late', 'Excused Late', 'Early Leave', 'Absent', 'Excused'], true)
    .setAllowInvalid(false)
    .build();

  const currentEventCols = Math.max(0, attSheet.getLastColumn() - 3);
  if (currentEventCols > 0 && attSheet.getMaxRows() > 1) {
      attSheet.getRange(2, 4, attSheet.getMaxRows() - 1, currentEventCols).setDataValidation(statusRule);
  }

  // C. SYNC EVENT COLUMNS
  events.sort((a,b) => new Date(a.Date) - new Date(b.Date));
  const newLastCol = Math.max(attSheet.getLastColumn(), 3);
  const currentHeaders = attSheet.getRange(1, 1, 1, newLastCol).getValues()[0];

  events.forEach(e => {
    if (e.Title && !currentHeaders.includes(e.Title)) {
      const newCol = attSheet.getLastColumn() + 1;
      const cell = attSheet.getRange(1, newCol);
      cell.setValue(e.Title);
      cell.setNote(`ID: ${e.EventID}\nDate: ${e.Date}`); 
      
      attSheet.setColumnWidth(newCol, 100); 
      cell.setFontWeight('bold').setBackground('#065f46').setFontColor('white');
      
      const dataRange = attSheet.getRange(2, newCol, attSheet.getMaxRows() - 1, 1);
      dataRange.setDataValidation(statusRule);
      
      const values = dataRange.getValues();
      const newValues = values.map(r => [r[0] === "" ? "Missing" : r[0]]);
      dataRange.setValues(newValues);
    }
  });

  // D. SYNC PEOPLE ROWS
  const lastRow = Math.max(attSheet.getLastRow(), 1);
  const currentSysIDs = lastRow > 1 ? attSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String) : [];
  const newRows = [];
  
  const finalEventColCount = attSheet.getLastColumn() - 3; 
  
  users.forEach(u => {
    const sysID = String(u.SystemID || "").trim();
    if (!sysID) return;
    const idx = currentSysIDs.indexOf(sysID);
    
    if (idx === -1) {
      const rowData = [sysID, String(u.StudentID||""), `${u.FirstName} ${u.LastName}`];
      for(let k=0; k<finalEventColCount; k++) rowData.push("Missing");
      newRows.push(rowData);
    } else {
      const r = idx + 2;
      const vals = attSheet.getRange(r, 2, 1, 2).getValues()[0];
      if(vals[0] !== String(u.StudentID||"") || vals[1] !== `${u.FirstName} ${u.LastName}`) {
         attSheet.getRange(r, 2).setValue(String(u.StudentID||""));
         attSheet.getRange(r, 3).setValue(`${u.FirstName} ${u.LastName}`);
      }
      if (finalEventColCount > 0) {
          const eventRange = attSheet.getRange(r, 4, 1, finalEventColCount);
          const eventVals = eventRange.getValues()[0];
          let changed = false;
          const fixedVals = eventVals.map(v => {
              if (v === "") { changed = true; return "Missing"; }
              return v;
          });
          if (changed) eventRange.setValues([fixedVals]);
      }
    }
  });

  if (newRows.length > 0) {
    attSheet.getRange(attSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    if (finalEventColCount > 0) {
        attSheet.getRange(attSheet.getLastRow() - newRows.length + 1, 4, newRows.length, finalEventColCount).setDataValidation(statusRule);
    }
  }
}

function setupAttendanceFormatting() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attendance');
  if(!sheet) return;
  sheet.clearConditionalFormatRules();
  const range = sheet.getRange(2, 4, sheet.getMaxRows(), Math.max(1, sheet.getMaxColumns()-3));
  
  const rules = [];
  const colors = [
    {t:'Present', b:'#dcfce7', f:'#166534'},
    {t:'Late', b:'#fef3c7', f:'#b45309'},
    {t:'Excused Late', b:'#fef9c3', f:'#854d0e'},
    {t:'Early Leave', b:'#f3e8ff', f:'#6b21a8'},
    {t:'Absent', b:'#fee2e2', f:'#991b1b'},
    {t:'Excused', b:'#dbeafe', f:'#1e40af'},
    {t:'Missing', b:'#f3f4f6', f:'#6b7280'}
  ];
  
  colors.forEach(c => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(c.t).setBackground(c.b).setFontColor(c.f)
      .setRanges([range]).build());
  });

  sheet.setConditionalFormatRules(rules);
}

// --- STANDARD HELPERS ---

function initializeAllSheets(ss) {
  const sheets = ['User Database', 'Settings', 'Script', 'Events', 'Attendance', 'BarcodeLogs', 'BarcodeArchived', 'Wellness', 'Conflicts', 'SystemLogs'];
  sheets.forEach(name => {
    let s = ss.getSheetByName(name);
    if (s && name !== 'SystemLogs' && name !== 'Attendance') {
       try { ss.deleteSheet(s); } catch(e){}
       s = null;
    }
    if (!s) s = ss.insertSheet(name);
    if (s.getLastRow() === 0) setupSheetHeaders(s, name);
  });
}

function setupSheetHeaders(sheet, name) {
  const headers = {
    // UPDATED: Audit Columns added to People
    'User Database': ['SystemID', 'StudentID', 'FirstName', 'MiddleName', 'LastName', 'Email', 'Phone', 'Role', 'Groups', 'AvatarColor', 'Status', 'CharacterName', 'CharacterAbbr', 'BirthDate', 'ProfilePhotoURL', 'Notes', 'EmergencyContact1', 'EmergencyRel1', 'EmergencyPhone1', 'EmergencyContact2', 'EmergencyRel2', 'EmergencyPhone2', 'Gender', 'Height', 'ShirtSize', 'PantsSize', 'WaistSize', 'ChestSize', 'Inseam', 'ShoeSize', 'WardrobeNotes', 'PhotoRelease', 'Transport', 'ActivityFee', 'GradeLevel', 'VocalRange', 'DanceLevel', 'Instruments', 'CrewInterests', 'Certifications', 'CreatedBy', 'CreatedAt', 'LastModified', 'ModifiedBy', 'LastLogin'],
    // Events matches V8 exactly
    'Events': ['EventID', 'Title', 'Type', 'Status', 'Date', 'StartTime', 'EndTime', 'Location', 'GracePeriod', 'LocationGPS', 'MeterTolerance', 'LocationBarcodeCheck', 'RequiredGroups', 'RequiredRoles', 'RequiredCharacters', 'RequiredPeople', 'AutoBarcode', 'SyncGoogleCalendar', 'CalendarID', 'Notes', 'CreatedBy', 'CreatedAt', 'LastModified'],
    'Attendance': ['SystemID', 'StudentID', 'User'],
    'BarcodeLogs': ['LogID', 'ScannedValue', 'Timestamp', 'ScanType', 'LocationGPS', 'ScannedBy'],
    'BarcodeArchived': ['LogID', 'ScannedValue', 'Timestamp', 'ScanType', 'LocationGPS', 'ScannedBy', 'ProcessedAt', 'Result']
  };
  
  if (headers[name]) {
      sheet.getRange(1, 1, 1, headers[name].length).setValues([headers[name]])
           .setFontWeight('bold').setBackground('#334155').setFontColor('white');
      sheet.setFrozenRows(1);
      
      // PREVENT TIMEZONE TRAP: Force Text on Event Time Columns during Setup
      if (name === 'Events') {
          const stIdx = headers[name].indexOf('StartTime') + 1;
          const etIdx = headers[name].indexOf('EndTime') + 1;
          // Format 1000 rows as plain text to be safe
          if (stIdx > 0) sheet.getRange(2, stIdx, 1000, 1).setNumberFormat('@');
          if (etIdx > 0) sheet.getRange(2, etIdx, 1000, 1).setNumberFormat('@');
      }
  }
}

function populateSystemSettings(ss, data) {
    const s = ss.getSheetByName('Settings');
    if(s.getLastRow() > 1) return;
    const defaults = [
        ['production_title', data.productionTitle || 'Production', 'Meta'],
        ['academic_year', '2025-2026', 'Meta'],
        ['custom_lists', JSON.stringify({roles:['Actor','Crew'], groups:['Full Cast'], locations:[{name:'Auditorium',gracePeriod:15}]}), 'UI']
    ];
    s.getRange(2, 1, defaults.length, 3).setValues(defaults);
    
    // 🔥 NEW: Add the flag directly
    s.appendRow(['system_initialized', "'true", 'Internal', new Date()]);
}

function addAdminToDatabase(sheet, email, name) {
  const data = sheet.getDataRange().getValues();
  const exists = data.slice(1).some(r => r[5] === email);
  if (exists) return;

  const row = new Array(45).fill(""); 
  row[0] = 'USR-' + Math.floor(Math.random() * 100000); 
  row[2] = (name || 'System').split(' ')[0]; 
  row[4] = (name || 'Owner').split(' ').pop(); 
  row[5] = email; row[7] = 'Staff'; row[10] = 'Active'; 
  row[40] = 'System'; // CreatedBy
  row[41] = new Date(); // CreatedAt
  sheet.appendRow(row);
}

function formatUserDatabase() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('User Database');
  if (s && s.getLastRow() > 1) {
    const range = s.getDataRange();
    range.getBandings().forEach(b => b.remove());
    if(s.getLastRow() > 1) {
       s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn())
        .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
    }
  }
}

function setupArchivedFormatting() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BarcodeArchived');
  if(!s || s.getLastRow() < 2) return;
  s.clearConditionalFormatRules();
  const range = s.getRange(2, 1, s.getLastRow() - 1, s.getMaxColumns());
  const r1 = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=REGEXMATCH($H2,"Matched")').setBackground('#dcfce7').setRanges([range]).build();
  const r2 = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=REGEXMATCH($H2,"Failed")').setBackground('#fee2e2').setRanges([range]).build();
  s.setConditionalFormatRules([r1, r2]);
}

function getDataAsObjects_setup(n, ss) {
  const s = ss.getSheetByName(n); if (!s) return [];
  const d = s.getDataRange().getValues(); if (d.length < 2) return [];
  const h = d[0]; return d.slice(1).map(r => { let o={}; h.forEach((k,i)=>o[k]=r[i]); return o; });
}

function logSystemAction(u, a, d) { try { SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SystemLogs').appendRow([new Date(),u,a,d,""]); } catch(e){} }
