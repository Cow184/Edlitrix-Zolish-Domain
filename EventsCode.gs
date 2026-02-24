/**
 * ==========================================
 * EVENTS MODULE BACKEND (V8 - Plain Text Time Lock)
 * ==========================================
 */

function fetchEvents_v4_JSON() {
  var payload = { success: false, logs: "", data: [] };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Events');
    
    if (!sheet) {
      sheet = ss.insertSheet('Events');
      sheet.appendRow([
        'EventID', 'Title', 'Type', 'Status', 'Date', 'StartTime', 'EndTime', 
        'Location', 'GracePeriod', 'LocationGPS', 'MeterTolerance', 'LocationBarcodeCheck',
        'RequiredGroups', 'RequiredRoles', 'RequiredCharacters', 'RequiredPeople',
        'AutoBarcode', 'SyncGoogleCalendar', 'CalendarID', 'Notes',
        'CreatedBy', 'CreatedAt', 'LastModified'
      ]);
      payload.success = true;
      return JSON.stringify(payload); 
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      payload.success = true;
      return JSON.stringify(payload);
    }

    var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    var displayData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getDisplayValues();
    
    var headers = data[0];
    var rows = data.slice(1);
    var displayRows = displayData.slice(1);

    var objects = rows.map(function(row, i) {
      var obj = {};
      headers.forEach(function(h, colIndex) {
        var val = row[colIndex];
        var dVal = displayRows[i][colIndex]; 

        // 100% RELIANCE ON TEXT FOR TIMES
        if (h === 'StartTime' || h === 'EndTime') {
            obj[h] = dVal; 
        } 
        else if (h === 'Date' && val instanceof Date) {
             var y = val.getFullYear();
             var m = String(val.getMonth() + 1).padStart(2,'0');
             var d = String(val.getDate()).padStart(2,'0');
             obj[h] = y + '-' + m + '-' + d;
        } 
        else {
           obj[h] = val === null ? "" : String(val);
        }
      });
      return obj;
    });

    payload.success = true;
    payload.data = objects;

  } catch (e) {
    payload.success = false;
    payload.error = e.toString();
  }

  return JSON.stringify(payload);
}

function saveEvent_v4(form) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Events');
  var user = Session.getActiveUser().getEmail();
  var now = new Date();
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('EventID');
  
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol] === form.EventID) { rowIndex = i + 1; break; }
  }

  var row = rowIndex > 0 ? data[rowIndex - 1] : new Array(headers.length).fill("");
  var existingCalId = (rowIndex > 0 && headers.indexOf('CalendarID') > -1) ? row[headers.indexOf('CalendarID')] : "";

  var isTrue = function(val) { return String(val).toUpperCase() === 'TRUE'; };

  var headerMap = {
    'EventID': form.EventID || '', 
    'Title': form.Title || '', 
    'Type': form.Type || '', 
    'Status': form.Status || 'Scheduled', 
    'Date': form.Date || '', 
    'StartTime': form.StartTime || '', 
    'EndTime': form.EndTime || '', 
    'Location': form.Location || '',
    'GracePeriod': form.GracePeriod || '', 
    'LocationGPS': form.LocationGPS || '', 
    'MeterTolerance': form.MeterTolerance || '', 
    'Notes': form.Notes || '',
    'AutoBarcode': isTrue(form.AutoBarcode) ? 'TRUE' : 'FALSE',
    'SyncGoogleCalendar': isTrue(form.SyncGoogleCalendar) ? 'TRUE' : 'FALSE',
    'LocationBarcodeCheck': isTrue(form.LocationBarcodeCheck) ? 'TRUE' : 'FALSE',
    'RequiredGroups': form.RequiredGroups || '[]', 
    'RequiredRoles': form.RequiredRoles || '[]',
    'RequiredPeople': form.RequiredPeople || '[]', 
    'RequiredCharacters': form.RequiredCharacters || '[]',
    'CalendarID': form.CalendarID || existingCalId 
  };

  if(rowIndex < 0) {
      setVal(row, headers, 'CreatedBy', user);
      setVal(row, headers, 'CreatedAt', now);
  }

  Object.keys(headerMap).forEach(function(key) { setVal(row, headers, key, headerMap[key]); });
  setVal(row, headers, 'LastModified', now);

  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  
  var finalLastRow = sheet.getLastRow();
  var targetRow = rowIndex > 0 ? rowIndex : finalLastRow;

  var stCol = headers.indexOf('StartTime') + 1;
  var etCol = headers.indexOf('EndTime') + 1;
  if (stCol > 0) sheet.getRange(2, stCol, finalLastRow, 1).setNumberFormat('@');
  if (etCol > 0) sheet.getRange(2, etCol, finalLastRow, 1).setNumberFormat('@');

  var statusVal = form.Status || 'Scheduled';
  var isArchived = (statusVal === 'Archived');
  var bg = isArchived ? '#f1f5f9' : '#ffffff';
  var font = isArchived ? '#94a3b8' : '#000000';
  var strike = isArchived ? 'line-through' : 'none';
  
  sheet.getRange(targetRow, 1, 1, headers.length).setBackground(bg).setFontColor(font).setFontLine(strike);

  if (finalLastRow > 1) {
    var dateColIdx = headers.indexOf('Date') + 1; 
    var timeColIdx = headers.indexOf('StartTime') + 1;
    sheet.getRange(2, 1, finalLastRow - 1, sheet.getLastColumn()).sort([
      { column: dateColIdx, ascending: true },
      { column: timeColIdx, ascending: true }
    ]);
  }

  if (typeof syncAttendanceStructure_ === 'function') syncAttendanceStructure_(ss);
  
  // --- NEW: LOG TO UNIVERSAL DASHBOARD FEED ---
  let cleanDate = form.Date ? String(form.Date).split('T')[0] : "TBD";
  let actionStr = rowIndex > 0 ? "Updated" : "Created";
  logToSystem(`Event ${actionStr}`, `"${form.Title}" on ${cleanDate}`, "Events");

  return fetchEvents_v4_JSON();
}

function fetchEventsData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Events');
  if (!sheet) return []; 
  
  // Use Display Values globally
  var data = sheet.getDataRange().getDisplayValues(); 
  if (data.length < 2) return []; 
  
  var headers = data[0];
  var eventsList = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var eventObj = {};
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) eventObj[headers[j]] = row[j]; 
    }
    if (eventObj.EventID && eventObj.EventID.trim() !== "") {
      if (!eventObj.Status || eventObj.Status.trim() === "") eventObj.Status = "Scheduled";
      eventsList.push(eventObj);
    }
  }
  return eventsList;
}

function setVal(row, headers, key, value) {
  var idx = headers.indexOf(key);
  if (idx > -1) row[idx] = value;
}
