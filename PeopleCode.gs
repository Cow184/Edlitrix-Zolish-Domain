// ============ PEOPLE MODULE SERVER LOGIC ============

function getPeopleContext() {
  try {
    const people = getAllPeople();
    return { success: true, people: people };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getPeopleList() {
  return getAllPeople();
}

/* =========================================
   PEOPLE MODULE - PRO SERVER LOGIC
   ========================================= */

/**
 * ==========================================
 * PEOPLE MODULE BACKEND
 * ==========================================
 */

function processPersonUpdate(form) {
  const payload = { success: false, message: "" };
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('User Database');
    
    if (!sheet) {
      sheet = ss.insertSheet('User Database');
      sheet.appendRow([
        'SystemID', 'FirstName', 'LastName', 'Role', 'Status', 'Email', 'Phone', 
        'CharacterName', 'Groups', 'CreatedBy', 'LastModified'
      ]); 
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('SystemID');
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === form.SystemID) { 
        rowIndex = i + 1; 
        break; 
      }
    }

    const now = new Date();
    let user = "Unknown";
    try { user = Session.getActiveUser().getEmail(); } catch(e) {}
    
    let row = rowIndex > 0 ? data[rowIndex - 1] : new Array(headers.length).fill("");
    
    if (rowIndex < 0 && !form.Status) form.Status = 'Active'; 

    Object.keys(form).forEach(key => {
      setPersonVal_(row, headers, key, form[key]);
    });
    
    setPersonVal_(row, headers, 'LastModified', now);
    setPersonVal_(row, headers, 'ModifiedBy', user);
    
    ['CreatedAt', 'Created At', 'Timestamp', 'DateCreated'].forEach(colName => {
       let idx = headers.indexOf(colName);
       if (idx === -1) {
         const fuzzy = colName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
         idx = headers.findIndex(h => String(h).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === fuzzy);
       }
       if (idx > -1 && (!row[idx] || row[idx] === "")) {
         row[idx] = now;
       }
    });
    
    ['CreatedBy', 'Created By', 'Author'].forEach(colName => {
       let idx = headers.indexOf(colName);
       if (idx === -1) {
         const fuzzy = colName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
         idx = headers.findIndex(h => String(h).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === fuzzy);
       }
       if (idx > -1 && (!row[idx] || row[idx] === "")) {
         row[idx] = user;
       }
    });

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowIndex = sheet.getLastRow();
    }

    const finalLastRow = sheet.getLastRow();
    
    if (finalLastRow > 1) {
      const dataRange = sheet.getRange(2, 1, finalLastRow - 1, headers.length);
      const rowData = dataRange.getValues();
      const statusIdx = headers.indexOf('Status');
      const modifiedIdx = headers.indexOf('LastModified');
      
      rowData.sort((a, b) => {
        const aArchived = a[statusIdx] === 'Archived';
        const bArchived = b[statusIdx] === 'Archived';
        
        if (aArchived && !bArchived) return 1;
        if (!aArchived && bArchived) return -1;
        
        const dateA = new Date(a[modifiedIdx] || 0).getTime();
        const dateB = new Date(b[modifiedIdx] || 0).getTime();
        return dateB - dateA;
      });
      
      dataRange.setValues(rowData);
      
      const bgColors = [];
      const fontColors = [];
      const fontLines = [];
      
      for (let i = 0; i < rowData.length; i++) {
        const isArchived = (rowData[i][statusIdx] === 'Archived');
        bgColors.push(new Array(headers.length).fill(isArchived ? '#f1f5f9' : '#ffffff'));
        fontColors.push(new Array(headers.length).fill(isArchived ? '#94a3b8' : '#000000'));
        fontLines.push(new Array(headers.length).fill(isArchived ? 'line-through' : 'none'));
      }
      
      dataRange.setBackgrounds(bgColors);
      dataRange.setFontColors(fontColors);
      dataRange.setFontLines(fontLines);
    }
    
    if (typeof syncAttendanceStructure_ === 'function') {
        syncAttendanceStructure_(ss);
    }

    // --- NEW: LOG TO UNIVERSAL DASHBOARD FEED ---
    let actionStr = rowIndex > 0 ? "Updated" : "Created";
    logToSystem(`Profile ${actionStr}`, `${form.FirstName} ${form.LastName} (${form.Role || 'User'})`, "Roster");

    payload.success = true;
    payload.count = 1;

  } catch (e) {
    payload.success = false;
    payload.message = e.toString();
  }

  return payload;
}

function deletePerson(systemId) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('User Database');
    const data = sheet.getDataRange().getValues();
    const idIndex = data[0].indexOf('SystemID');
    const system = getSystemFolders();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === String(systemId)) {
        
        // Grab the name before deleting for the log
        const fName = data[i][data[0].indexOf('FirstName')] || 'Unknown';
        const lName = data[i][data[0].indexOf('LastName')] || '';

        sheet.deleteRow(i + 1);
        writeToAuditLog(system, userEmail, 'PERSON_DELETE', 'Deleted user', systemId);
        
        // --- NEW: LOG TO UNIVERSAL DASHBOARD FEED ---
        logToSystem("Profile Deleted", `${fName} ${lName} removed.`, "Roster");

        return { success: true };
      }
    }
    return { success: false, message: 'ID not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// Helper function to map data safely (Fuzzy Matcher: ignores spaces and casing)
function setPersonVal_(row, headers, key, value) {
  // 1. Try exact match first
  let idx = headers.indexOf(key);
  
  // 2. If no exact match, try fuzzy match (e.g., "LastModified" matches "Last Modified")
  if (idx === -1) {
    const fuzzyKey = String(key).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    idx = headers.findIndex(h => String(h).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === fuzzyKey);
  }
  
  if (idx > -1) row[idx] = value;
}

function getPersonDetails(sid) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('User Database');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const searchValue = String(sid).trim().toUpperCase();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).trim().toUpperCase() === searchValue) {
      const person = {};
      headers.forEach((h, idx) => {
        let val = row[idx];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        person[h.trim()] = val;
      });
      return person;
    }
  }
  return null;
}

function getAllPeople() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('User Database');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const person = {};
    headers.forEach((h, i) => person[h] = row[i]);
    return person;
  });
}
