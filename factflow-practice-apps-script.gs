// FactFlow / FactFlow Check - combined Google Sheets receiver
// Paste this entire file into Extensions > Apps Script in the target Google Sheet.
// Deploy as Web App:
//   Execute as: Me
//   Who has access: Anyone
// Use the V8 runtime.
// After deploying, paste the Web App URL into the TEACHERS map in FactFlow index.html.
//
// IMPORTANT:
// These are Google Spreadsheet IDs, not Apps Script IDs.
//
// Class routing is strict and fail-closed:
//   https://factflow.mtomlinson.ca/?t=IP5/8 -> IP5/8 sheet
//   https://factflow.mtomlinson.ca/?t=IP5/9 -> IP5/9 sheet
//   https://factflow.mtomlinson.ca/?t=IP6/8 -> IP6/8 sheet
//   https://factflow.mtomlinson.ca/?t=IP6/9 -> IP6/9 sheet
//
// There is deliberately NO fallback spreadsheet. If a submission does not include
// a valid class code, the upload is rejected before any sheet is opened or written.
var BUILD_VERSION = 'factflow-practice-v2-no-number-format';

var CLASS_SPREADSHEET_IDS = {
  'ip5/8': '1VYs2dbduN8s5R3YEoOzIqQO2fnHko0YQypd3MYKn3Wg',
  'ip5/9': '1hLfZ0OJ5huE3OKg5w4wLvMLu5ImP2SDHdmtX89C7JJY',
  'ip6/8': '14bjzUQ3tq_An3Ef5VSydZ84LrXueqk0oJF8HmUyihiI',
  'ip6/9': '1iY1_YWHFvFDtvwz5FyWJtbnKCq8ixSIjGpysJ1LSg7Y'
};

var ALLOWED_CLASS_CODES = ['IP5/8', 'IP5/9', 'IP6/8', 'IP6/9'];

// Backward-compatible aliases for older helper code. These are not fallbacks.
var ALLOWED_SPREADSHEETS = CLASS_SPREADSHEET_IDS;
var TEACHER_SPREADSHEET_IDS = CLASS_SPREADSHEET_IDS;
var DEFAULT_SPREADSHEET_ID = '';
var TARGET_SPREADSHEET_ID = '';

function getAllowedSpreadsheetIds() {
  return [
    CLASS_SPREADSHEET_IDS['ip5/8'],
    CLASS_SPREADSHEET_IDS['ip5/9'],
    CLASS_SPREADSHEET_IDS['ip6/8'],
    CLASS_SPREADSHEET_IDS['ip6/9']
  ];
}

function isAllowedSpreadsheetId(spreadsheetId) {
  var key;

  for (key in ALLOWED_SPREADSHEETS) {
    if (Object.prototype.hasOwnProperty.call(ALLOWED_SPREADSHEETS, key)) {
      if (String(ALLOWED_SPREADSHEETS[key]) === String(spreadsheetId)) {
        return true;
      }
    }
  }

  return false;
}

function resolveTargetSpreadsheetId(data, e) {
  var rawClassCode = '';
  var classCode = '';

  data = data || {};

  if (data.teacherKey) {
    rawClassCode = data.teacherKey;
  } else if (data.class) {
    rawClassCode = data.class;
  } else if (data.teacher) {
    rawClassCode = data.teacher;
  } else if (data.t) {
    rawClassCode = data.t;
  } else if (e && e.parameter && e.parameter.t) {
    rawClassCode = e.parameter.t;
  } else if (e && e.parameter && e.parameter.teacherKey) {
    rawClassCode = e.parameter.teacherKey;
  } else if (e && e.parameter && e.parameter.class) {
    rawClassCode = e.parameter.class;
  }

  rawClassCode = String(rawClassCode || '').trim();
  classCode = normalizeKey(rawClassCode);

  if (!classCode) {
    throw new Error('Missing class code. Upload cancelled. Open FactFlow with ?t=IP5/8, ?t=IP5/9, ?t=IP6/8, or ?t=IP6/9.');
  }

  if (!TEACHER_SPREADSHEET_IDS[classCode]) {
    throw new Error('Unknown class code "' + rawClassCode + '". Upload cancelled.');
  }

  return TEACHER_SPREADSHEET_IDS[classCode];
}

function assertExpectedSpreadsheetId(data, spreadsheetId) {
  var expected = String(data && data.expectedSpreadsheetId ? data.expectedSpreadsheetId : '').trim();
  var classCode = String(data && (data.teacherKey || data.class || data.teacher || data.t) ? (data.teacherKey || data.class || data.teacher || data.t) : '').trim();

  if (expected && String(expected) !== String(spreadsheetId)) {
    throw new Error('Spreadsheet mismatch for class code "' + classCode + '". Expected ' + expected + ' but receiver resolved ' + spreadsheetId + '. Upload cancelled.');
  }
}

function getTargetSpreadsheet(data, e) {
  return SpreadsheetApp.openById(resolveTargetSpreadsheetId(data, e));
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').split(' ').map(function (w) {
    return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
  }).join(' ');
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readJsonPayload(e) {
  var rawJson = '';
  if (e && e.postData && e.postData.contents) {
    rawJson = e.postData.contents;
  } else if (e && e.parameter && e.parameter.json) {
    rawJson = e.parameter.json;
  } else {
    throw new Error('No data received.');
  }
  return JSON.parse(rawJson);
}

function doPost(e) {
  try {
    var data = readJsonPayload(e);
    if (data && data.app === 'FactFlowPractice') {
      return handleFactFlowPractice(data, e);
    }
    return handleFactFlowCheck(data, e);
  } catch (err) {
    return json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

// -----------------------------------------------------------------------------
// Forgiving helpers
// -----------------------------------------------------------------------------
function safeSortRange(sheet, startRow, startCol, numRows, numCols, sortColumn, ascending) {
  if (!sheet || numRows < 2 || numCols < 1) {
    return false;
  }

  try {
    sheet.getRange(startRow, startCol, numRows, numCols)
      .sort({ column: sortColumn, ascending: ascending });
    return true;
  } catch (err) {
    Logger.log('safeSortRange: skipped sort on sheet "' + sheet.getName() + '". Data was still written. Error: ' + (err && err.message ? err.message : String(err)));
    return false;
  }
}

function safeFlush() {
  try {
    safeFlush();
    return true;
  } catch (err) {
    Logger.log('safeFlush: flush failed after writes were requested. Error: ' + (err && err.message ? err.message : String(err)));
    return false;
  }
}

// -----------------------------------------------------------------------------
// One-shot migration helper. Run this ONCE from the Apps Script editor
// to rename legacy tabs to their canonical names.
//
// What it does:
//   1. 'Practice Summary' -> 'FactFlow Practice'
//   2. 'FactFlow'         -> 'FactFlow Practice'
//   3. 'Summary'          -> 'Check'
// -----------------------------------------------------------------------------
function migrateTabs(classCode) {
  var ss = getTargetSpreadsheet({ teacherKey: classCode }, null);
  var log = [];
  var pairs = [
    ['Practice Summary', 'FactFlow Practice'],
    ['FactFlow', 'FactFlow Practice'],
    ['Summary', 'Check']
  ];

  for (var i = 0; i < pairs.length; i += 1) {
    var from = pairs[i][0];
    var to = pairs[i][1];

    if (to === 'FactFlow Practice' && ss.getSheetByName(to)) {
      log.push("Skip '" + from + "' -> '" + to + "' because target already exists");
      continue;
    }

    var sheet = ss.getSheetByName(from);
    if (sheet) {
      try {
        sheet.setName(to);
        log.push("Renamed '" + from + "' -> '" + to + "'");
      } catch (e) {
        log.push("FAILED '" + from + "' -> '" + to + "': " + (e && e.message ? e.message : e));
      }
    } else {
      log.push("Skip '" + from + "' because it is not present");
    }
  }

  safeFlush();
  Logger.log('migrateTabs complete:\n' + log.join('\n'));
  return log;
}

function doGet(e) {
  var spreadsheetId;

  try {
    spreadsheetId = resolveTargetSpreadsheetId({}, e);
  } catch (err) {
    return json({
      ok: false,
      receiver: 'factflow-combined-v1',
      buildVersion: BUILD_VERSION,
      status: 'Receiver is online, but no valid class route was provided.',
      error: err && err.message ? err.message : String(err),
      allowedSpreadsheetIds: getAllowedSpreadsheetIds(),
      allowedClassCodes: ALLOWED_CLASS_CODES
    });
  }

  return json({
    ok: true,
    receiver: 'factflow-combined-v1',
      buildVersion: BUILD_VERSION,
    status: 'Receiver is online.',
    spreadsheetId: spreadsheetId,
    allowedSpreadsheetIds: getAllowedSpreadsheetIds(),
    allowedClassCodes: ALLOWED_CLASS_CODES
  });
}

// -----------------------------------------------------------------------------
// Manual diagnostic helper.
// Run this from Apps Script if you want to prove the script is writing to the
// correct class spreadsheet. Example: writeDiagnosticStamp('IP5/9')
// -----------------------------------------------------------------------------
function writeDiagnosticStamp(classCode) {
  var spreadsheetId = resolveTargetSpreadsheetId({ teacherKey: classCode }, null);
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName('Script Diagnostic');

  if (!sheet) {
    sheet = ss.insertSheet('Script Diagnostic');
  }

  sheet.getRange('A1').setValue('Script wrote here at:');
  sheet.getRange('B1').setValue(new Date());
  sheet.getRange('A2').setValue('Spreadsheet ID:');
  sheet.getRange('B2').setValue(spreadsheetId);

  safeFlush();

  return 'Wrote diagnostic stamp to spreadsheet ID ' + spreadsheetId;
}

// -----------------------------------------------------------------------------
// Generic sheet helper
// -----------------------------------------------------------------------------
function ensureSheet(ss, name, headers, hidden, legacyNames) {
  var sheet = ss.getSheetByName(name);
  var legacySheet;
  var i;

  if (legacyNames && !Array.isArray(legacyNames)) {
    legacyNames = [legacyNames];
  } else if (!legacyNames) {
    legacyNames = [];
  }

  if (!sheet) {
    for (i = 0; i < legacyNames.length; i += 1) {
      legacySheet = ss.getSheetByName(legacyNames[i]);
      if (legacySheet) {
        try {
          legacySheet.setName(name);
          sheet = legacySheet;
        } catch (e) {
          sheet = legacySheet;
        }
        break;
      }
    }
  }

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    if (hidden) {
      sheet.hideSheet();
    }
  }

  return sheet;
}

// -----------------------------------------------------------------------------
// FactFlow practice receiver
// Visible practice summary tab: FactFlow Practice
// Hidden practice log tab: Practice Raw Data
// -----------------------------------------------------------------------------
function ensurePracticeRawSheet(ss) {
  return ensureSheet(ss, 'Practice Raw Data', [
    'Timestamp',
    'Student',
    'Email',
    'Student Key',
    'Class',
    'Round ID',
    'Round Started',
    'Round Ended',
    'Focus Table',
    'Order Mode',
    'Configured Duration Sec',
    'Elapsed Sec',
    'Completed Fully',
    'Stop Reason',
    'Attempted',
    'Correct',
    'Incorrect',
    'Accuracy %',
    'FPM',
    'Best Streak',
    'Timeouts',
    'Graduated',
    'Graduated From',
    'Graduated To',
    'Current Table',
    'Sessions Completed',
    'Fluent Facts',
    'Learning Facts',
    'Struggling Facts',
    'Total Facts',
    'Device ID'
  ], true);
}

function ensurePracticeSummarySheet(ss) {
  return ensureSheet(ss, 'FactFlow Practice', [
    'Student',
    'Email',
    'Student Key',
    'Class',
    'Last Updated',
    'Current Table',
    'Sessions Completed',
    'Last Focus Table',
    'Last Accuracy %',
    'Last FPM',
    'Last Correct',
    'Last Attempted',
    'Best Streak',
    'All-Time Best Streak',
    'All-Time Best FPM',
    'Fluent Facts',
    'Learning Facts',
    'Struggling Facts',
    'Last Graduation',
    'Total Submitted Rounds',
    'Last Round ID'
  ], false, ['FactFlow', 'Practice Summary']);
}

function hasRoundAlready(rawSheet, roundId) {
  var lastRow = rawSheet.getLastRow();
  var values;
  var i;

  if (!roundId || lastRow < 2) {
    return false;
  }

  values = rawSheet.getRange(2, 6, lastRow - 1, 1).getValues();

  for (i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(roundId)) {
      return true;
    }
  }

  return false;
}

function appendPracticeRaw(rawSheet, data) {
  rawSheet.appendRow([
    data.submittedAt ? new Date(data.submittedAt) : new Date(),
    normalizeName(data.studentName) || 'Unknown',
    data.studentEmail || '',
    normalizeKey(data.studentKey || data.studentEmail || data.studentName),
    data.teacherKey || '',
    data.roundId || '',
    data.roundStartedAt ? new Date(data.roundStartedAt) : '',
    data.roundEndedAt ? new Date(data.roundEndedAt) : '',
    data.focusTable != null ? data.focusTable : '',
    data.orderMode || '',
    data.configuredDurationSec != null ? data.configuredDurationSec : '',
    data.elapsedSec != null ? data.elapsedSec : '',
    data.completedFully ? 'Yes' : 'No',
    data.stopReason || '',
    data.attempted != null ? data.attempted : '',
    data.correct != null ? data.correct : '',
    data.incorrect != null ? data.incorrect : '',
    data.accuracy != null ? data.accuracy : '',
    data.fpm != null ? data.fpm : '',
    data.bestStreak != null ? data.bestStreak : '',
    data.timeoutsTriggered != null ? data.timeoutsTriggered : '',
    data.graduated ? 'Yes' : 'No',
    data.graduatedFrom != null ? data.graduatedFrom : '',
    data.graduatedTo != null ? data.graduatedTo : '',
    data.currentTable != null ? data.currentTable : '',
    data.sessionsCompleted != null ? data.sessionsCompleted : '',
    data.fluentFacts != null ? data.fluentFacts : '',
    data.learningFacts != null ? data.learningFacts : '',
    data.strugglingFacts != null ? data.strugglingFacts : '',
    data.totalFacts != null ? data.totalFacts : '',
    data.deviceId || ''
  ]);
}

function findPracticeSummaryRow(summary, studentKey, email, studentName) {
  var values = summary.getDataRange().getValues();
  var key = normalizeKey(studentKey);
  var mail = normalizeKey(email);
  var name = normalizeName(studentName);
  var i;

  for (i = 1; i < values.length; i += 1) {
    if (key && normalizeKey(values[i][2]) === key) {
      return i + 1;
    }
  }

  for (i = 1; i < values.length; i += 1) {
    if (mail && normalizeKey(values[i][1]) === mail) {
      return i + 1;
    }
  }

  for (i = 1; i < values.length; i += 1) {
    if (name && normalizeName(values[i][0]) === name) {
      return i + 1;
    }
  }

  return -1;
}

function getSubmittedRoundCount(rawSheet, studentKey, email, studentName) {
  var lastRow = rawSheet.getLastRow();
  var values;
  var key = normalizeKey(studentKey);
  var mail = normalizeKey(email);
  var name = normalizeName(studentName);
  var count = 0;
  var i;

  if (lastRow < 2) {
    return 0;
  }

  values = rawSheet.getRange(2, 1, lastRow - 1, 31).getValues();

  for (i = 0; i < values.length; i += 1) {
    if (key && normalizeKey(values[i][3]) === key) {
      count += 1;
    } else if (!key && mail && normalizeKey(values[i][2]) === mail) {
      count += 1;
    } else if (!key && !mail && name && normalizeName(values[i][1]) === name) {
      count += 1;
    }
  }

  return count;
}

function upsertPracticeSummary(summary, rawSheet, data) {
  var studentName = normalizeName(data.studentName) || 'Unknown';
  var studentEmail = data.studentEmail || '';
  var studentKey = normalizeKey(data.studentKey || studentEmail || studentName);
  var row = findPracticeSummaryRow(summary, studentKey, studentEmail, studentName);
  var graduationText = data.graduated ? String(data.graduatedFrom || '') + ' to ' + String(data.graduatedTo || '') : '';
  var totalSubmitted = getSubmittedRoundCount(rawSheet, studentKey, studentEmail, studentName);

  var rowValues = [
    studentName,
    studentEmail,
    studentKey,
    data.teacherKey || '',
    data.submittedAt ? new Date(data.submittedAt) : new Date(),
    data.currentTable != null ? data.currentTable : '',
    data.sessionsCompleted != null ? data.sessionsCompleted : '',
    data.focusTable != null ? data.focusTable : '',
    data.accuracy != null ? data.accuracy : '',
    data.fpm != null ? data.fpm : '',
    data.correct != null ? data.correct : '',
    data.attempted != null ? data.attempted : '',
    data.bestStreak != null ? data.bestStreak : '',
    data.allTimeBestStreak != null ? data.allTimeBestStreak : '',
    data.allTimeBestFpm != null ? data.allTimeBestFpm : '',
    data.fluentFacts != null ? data.fluentFacts : '',
    data.learningFacts != null ? data.learningFacts : '',
    data.strugglingFacts != null ? data.strugglingFacts : '',
    graduationText,
    totalSubmitted,
    data.roundId || ''
  ];

  if (row > 0) {
    summary.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    summary.appendRow(rowValues);
  }

  if (summary.getLastRow() > 1) {
    safeSortRange(summary, 2, 1, summary.getLastRow() - 1, summary.getLastColumn(), 1, true);
  }
}

function handleFactFlowPractice(data, e) {
  var lock = null;

  try {
    if (!data.roundId) {
      throw new Error('Missing roundId.');
    }

    if (!data.studentName && !data.studentEmail) {
      throw new Error('Missing student identity.');
    }

    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    var spreadsheetId = resolveTargetSpreadsheetId(data, e);
    assertExpectedSpreadsheetId(data, spreadsheetId);
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var rawSheet = ensurePracticeRawSheet(ss);
    var summary = ensurePracticeSummarySheet(ss);

    if (!hasRoundAlready(rawSheet, data.roundId)) {
      appendPracticeRaw(rawSheet, data);
    }

    upsertPracticeSummary(summary, rawSheet, data);

    safeFlush();

    return json({
      ok: true,
      receiver: 'factflow-practice-v1',
      buildVersion: BUILD_VERSION,
      student: normalizeName(data.studentName),
      roundId: data.roundId,
      spreadsheetId: spreadsheetId,
      classCode: data.teacherKey || data.class || data.teacher || data.t || ''
    });
  } catch (err) {
    return json({
      ok: false,
      receiver: 'factflow-practice-v1',
      buildVersion: BUILD_VERSION,
      error: err && err.message ? err.message : String(err),
      spreadsheetId: spreadsheetId,
      classCode: data.teacherKey || data.class || data.teacher || data.t || ''
    });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}

// -----------------------------------------------------------------------------
// FactFlow Check receiver
// Visible check summary tab: Check
// Hidden check log tab: Raw Data
// -----------------------------------------------------------------------------
function ensureCheckRawSheet(ss) {
  var rawSheet = ss.getSheetByName('Raw Data');

  if (!rawSheet) {
    rawSheet = ss.insertSheet('Raw Data');
    rawSheet.appendRow([
      'Timestamp',
      'Student',
      'Code',
      'Assessment',
      'Verified',
      'Developing',
      'Accuracy %',
      'Fluent',
      'Slow',
      'Wrong',
      'Timeout',
      'Questions',
      'Missed Facts',
      'Duration sec'
    ]);
    rawSheet.hideSheet();
  }

  return rawSheet;
}

function ensureCheckSummarySheet(ss) {
  return ensureSheet(ss, 'Check', [
    'Student',
    'Date',
    'Code',
    'Verified',
    'Developing',
    'Accuracy %',
    'Fluent',
    'Slow',
    'Missed',
    'Facts to Review'
  ], false, 'Summary');
}

function findCheckSummaryRow(summary, studentName) {
  var summaryData = summary.getDataRange().getValues();
  var normalizedStudentName = normalizeName(studentName);
  var i;

  for (i = 1; i < summaryData.length; i += 1) {
    if (normalizeName(summaryData[i][0]) === normalizedStudentName) {
      return i + 1;
    }
  }

  return -1;
}

function appendCheckRaw(rawSheet, data, studentName) {
  rawSheet.appendRow([
    data.completedAt ? new Date(data.completedAt) : new Date(),
    studentName,
    data.code || '',
    data.assessmentName || '',
    data.verifiedBand || '',
    data.developingBand || '',
    data.accuracy != null ? data.accuracy : '',
    data.fluent != null ? data.fluent : '',
    data.slow != null ? data.slow : '',
    data.wrong != null ? data.wrong : '',
    data.timeout != null ? data.timeout : '',
    data.totalQuestions != null ? data.totalQuestions : '',
    (data.missedFacts || []).join(', '),
    data.durationSec != null ? data.durationSec : ''
  ]);
}

function upsertCheckSummary(summary, data, studentName) {
  var foundRow = findCheckSummaryRow(summary, studentName);

  var rowValues = [
    studentName,
    data.completedAt ? new Date(data.completedAt) : new Date(),
    data.code || '',
    data.verifiedBand || '',
    data.developingBand || '',
    data.accuracy != null ? data.accuracy + '%' : '',
    data.fluent != null ? data.fluent : '',
    data.slow != null ? data.slow : '',
    (data.wrong || 0) + (data.timeout || 0),
    (data.missedFacts || []).join(', ')
  ];

  if (foundRow > 0) {
    summary.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    summary.appendRow(rowValues);
  }

  if (summary.getLastRow() > 1) {
    safeSortRange(summary, 2, 1, summary.getLastRow() - 1, summary.getLastColumn(), 1, true);
  }
}

function handleFactFlowCheck(data, e) {
  var lock = null;

  try {
    var studentName = normalizeName(data.studentName) || 'Unknown';

    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    var spreadsheetId = resolveTargetSpreadsheetId(data, e);
    assertExpectedSpreadsheetId(data, spreadsheetId);
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var rawSheet = ensureCheckRawSheet(ss);
    var summary = ensureCheckSummarySheet(ss);

    appendCheckRaw(rawSheet, data, studentName);
    upsertCheckSummary(summary, data, studentName);

    safeFlush();

    return json({
      ok: true,
      receiver: 'factflow-check-v1',
      buildVersion: BUILD_VERSION,
      student: studentName,
      spreadsheetId: spreadsheetId
    });
  } catch (err) {
    return json({
      ok: false,
      receiver: 'factflow-check-v1',
      buildVersion: BUILD_VERSION,
      error: err && err.message ? err.message : String(err),
      spreadsheetId: spreadsheetId
    });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}
