// FactFlow / FactFlow Quiz - combined Google Sheets receiver
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
var BUILD_VERSION = 'factflow-combined-v6-quiz-tabs';

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
  } else if (data.classCode) {
    rawClassCode = data.classCode;
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
  classCode = normalizeKey(rawClassCode).replace(/\s+/g, '').replace(/\\/g, '/');

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
    if (data && data.app && data.app !== 'FactFlowCheck') throw new Error('Unknown app.');
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
  SpreadsheetApp.flush();
  return true;
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
  }
  ensureMinimumColumns(sheet, headers.length);
  var headerRow = sheet.getRange(1, 1, 1, headers.length);
  if (headerRow.getValues()[0].every(function (cell) { return String(cell || '').trim() === ''; })) {
    headerRow.setValues([headers]);
  }
  if (hidden) {
    try { sheet.hideSheet(); } catch (err) { Logger.log('Could not hide ' + name + ': ' + err.message); }
  }
  return sheet;
}

function ensureMinimumColumns(sheet, count) {
  var current = sheet.getMaxColumns();
  if (current < count) sheet.insertColumnsAfter(current, count - current);
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
// FactFlow Quiz receiver
// Visible check summary tab: Check
// Hidden check log tab: Raw Data
// -----------------------------------------------------------------------------
// Append metadata columns without moving or deleting existing results.
function ensureCheckRawSheet(ss, modern) {
  var sheet = ensureSheet(ss, modern ? 'FactFlow Quiz Raw' : 'Raw Data', [
    'Timestamp', 'Student', 'Code', 'Assessment', 'Verified', 'Needs Practice',
    'Accuracy %', 'Fluent', 'Slow', 'Wrong', 'Timeout', 'Questions', 'Missed Facts', 'Duration sec'
  ], true, modern ? ['Check Raw v3'] : []);
  ensureMinimumColumns(sheet, 16);
  sheet.getRange(1, 15, 1, 2).setValues([['Assessment ID', 'Assessment JSON']]);
  return sheet;
}

function ensureCheckSummarySheet(ss, modern) {
  var sheet = ensureSheet(ss, modern ? 'FactFlow Quiz' : 'Check', [
    'Student', 'Date', 'Code', 'Verified', 'Needs Practice',
    'Accuracy %', 'Fluent', 'Slow', 'Missed', 'Facts to Review'
  ], false, modern ? ['Check v3'] : 'Summary');
  ensureMinimumColumns(sheet, modern ? 26 : 14);
  sheet.getRange(1, 11, 1, 4).setValues([['Assessment ID', 'Incomplete Bands', 'Not Assessed Bands', 'Ended Because']]);
  if(modern) {
    sheet.getRange(1,4,1,2).setValues([['Fluent Recall','Areas Needing Attention']]);
    sheet.getRange(1,12,1,2).setValues([['Incomplete Groups','Not Assessed Groups']]);
    sheet.getRange(1,15,1,8).setValues([['Version','Response Conditions','Input Method','Accuracy Only Groups','Fluency Developing Groups','Incorrect / Unanswered / Skipped','Started','Pauses / Interruptions']]);
    sheet.getRange(1,23,1,4).setValues([['Teacher Grade %','Grade Basis','Level-weighted Accuracy %','Level-weighted Fluency %']]);
  }
  return sheet;
}

function findCheckSummaryRow(summary, studentName) {
  var values = summary.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    if (normalizeName(values[i][0]) === normalizeName(studentName)) return i + 1;
  }
  return -1;
}

function checkCell(value) {
  // Names and other submitted text must remain literal cells, never formulas.
  return typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function validateCheck(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid assessment.');
  if (typeof data.studentName !== 'string' || !data.studentName.trim() || data.studentName.length > 100) throw new Error('Missing or invalid student name.');
  if (typeof data.completedAt !== 'string' || !isFinite(Date.parse(data.completedAt))) throw new Error('Invalid completion date.');
  var modern=data.schemaVersion===3;
  var limit=modern?98:60;
  ['totalQuestions', 'correct', 'fluent', 'slow', 'wrong', 'timeout', 'accuracy'].forEach(function (key) {
    var value = data[key];
    if (!Number.isInteger(value) || value < 0 || value > (key === 'accuracy' ? 100 : limit)) throw new Error('Invalid ' + key + '.');
  });
  if(modern&&(!Number.isInteger(data.skipped)||data.skipped<0||data.skipped>limit))throw new Error('Invalid skipped count.');
  if (data.correct + data.wrong + data.timeout + (modern?data.skipped:0) !== data.totalQuestions || data.fluent + data.slow !== data.correct) throw new Error('Inconsistent assessment totals.');
  if (!Array.isArray(data.missedFacts) || data.missedFacts.length > limit || data.missedFacts.some(function (fact) { return typeof fact !== 'string' || fact.length > 30; })) throw new Error('Invalid missed facts.');
  if (data.app === 'FactFlowCheck' && ([2,3].indexOf(data.schemaVersion)<0 || typeof data.assessmentId !== 'string' || !/^ffc-[a-zA-Z0-9-]{1,100}$/.test(data.assessmentId))) throw new Error('Missing or invalid assessment ID/version.');
  if (JSON.stringify(data).length > (modern?48000:45000)) throw new Error('Assessment is too large.');
  if (data.bandResults && (!Array.isArray(data.bandResults) || data.bandResults.length > 8 || data.bandResults.some(function (band) {
    return !band || !/^[A-H]$/.test(band.bandId) || (modern?['pass','slow','accuracy_only','fail','incomplete','not_assessed']:['pass','fail','incomplete','not_assessed']).indexOf(band.verdict) < 0;
  }))) throw new Error('Invalid band evidence.');
  if(modern) {
    var c=data.conditions;
    if(data.app!=='FactFlowCheck'||!c||['standard','extended','untimed'].indexOf(c.mode)<0||['student','teacher'].indexOf(c.input)<0||typeof c.mixed!=='boolean'||typeof c.hideTimer!=='boolean')throw new Error('Invalid assessment conditions.');
    if(!Array.isArray(data.bandResults)||data.bandResults.length!==8||new Set(data.bandResults.map(function(b){return b.bandId;})).size!==8)throw new Error('Missing group evidence.');
    var totals={questions:0,correct:0,fluent:0,slow:0,wrong:0,timeout:0,skipped:0};
    data.bandResults.forEach(function(b){
      Object.keys(totals).forEach(function(k){if(!Number.isInteger(b[k])||b[k]<0||b[k]>(b.bandId==='H'?18:['C','D','E','F'].indexOf(b.bandId)>=0?11:12))throw new Error('Invalid group count.');totals[k]+=b[k];});
      if(b.correct+b.wrong+b.timeout+b.skipped!==b.questions||b.fluent+b.slow!==b.correct)throw new Error('Inconsistent group evidence.');
      if((c.mode!=='standard'||c.input!=='student')&&(b.fluent!==0||b.verdict==='pass'||b.verdict==='slow'))throw new Error('Accommodated check cannot claim standard fluency.');
      if(typeof b.label!=='string'||b.label.length>60||!Array.isArray(b.tables)||b.tables.some(function(t){return !Number.isInteger(t)||t<2||t>12;}))throw new Error('Invalid group label/coverage.');
    });
    if(totals.questions!==data.totalQuestions)throw new Error('Inconsistent group totals.');
    ['correct','fluent','slow','wrong','timeout','skipped'].forEach(function(k){if(totals[k]!==data[k])throw new Error('Inconsistent '+k+' totals.');});
    if(!Array.isArray(data.questionResults)||data.questionResults.length!==data.totalQuestions||!Array.isArray(data.breaks)||!Array.isArray(data.interruptions))throw new Error('Missing assessment evidence.');
    if(data.accuracy!==(data.totalQuestions?Math.round(data.correct/data.totalQuestions*100):0))throw new Error('Inconsistent accuracy.');
  }
}

function checkBandsWithVerdict(data, verdict) {
  return (data.bandResults || []).filter(function (band) { return band.verdict === verdict; }).map(function (band) { return data.schemaVersion===3 ? band.label : band.bandId; }).join(', ');
}

// Receiver-only grade: never included in the student payload or delivery receipt.
function teacherGradeCells(data) {
  var basis = 'v1: eight equal levels; 60% accuracy + 40% fluency';
  var bands = data.bandResults || [];
  var complete = data.schemaVersion === 3 && data.finalReason === 'Completed the selected fact groups.' &&
    bands.length === 8 && new Set(bands.map(function(b){return b.bandId;})).size === 8 &&
    bands.every(function(b){return /^[A-H]$/.test(b.bandId) && b.questions >= (b.bandId === 'H' ? 18 : b.verdict === 'fail' ? 6 : 8);});
  if(!complete) return ['', 'Not graded: unfinished assessment', '', ''];
  var accuracy = bands.reduce(function(sum,b){return sum+b.correct/b.questions;},0)/8;
  var standard = data.conditions.mode === 'standard' && data.conditions.input === 'student';
  if(!standard) return ['', 'Accuracy only: accommodated conditions; eight equal levels', accuracy, ''];
  var fluency = bands.reduce(function(sum,b){return sum+b.fluent/b.questions;},0)/8;
  if(data.skipped || data.timeout) basis += '; includes unanswered items as zero';
  return [0.6*accuracy+0.4*fluency, basis, accuracy, fluency];
}

function formatTeacherGrade(summary, row) {
  summary.getRange(row,23,1,1).setNumberFormat('0%');
  summary.getRange(row,25,1,2).setNumberFormat('0%');
}

// Editor-only maintenance. Updates grade columns for current schema-3 snapshots,
// matched by assessment ID; historical evidence and student verdicts stay intact.
function refreshTeacherGrades() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ['ip5/8','ip5/9'].forEach(function(key){
      var ss = SpreadsheetApp.openById(CLASS_SPREADSHEET_IDS[key]);
      var summary = ensureCheckSummarySheet(ss,true);
      var raw = ss.getSheetByName('FactFlow Quiz Raw') || ss.getSheetByName('Check Raw v3');
      var records = {};
      if(raw && raw.getLastRow()>1) raw.getRange(2,15,raw.getLastRow()-1,2).getValues().forEach(function(r){records[r[0]]=r[1];});
      var rows = summary.getDataRange().getValues();
      for(var i=1;i<rows.length;i++) {
        var cells = ['', 'Not graded: saved evidence unavailable', '', ''];
        if(records[rows[i][10]]) {
          var data = JSON.parse(records[rows[i][10]]);
          validateCheck(data);
          cells = teacherGradeCells(data);
        }
        summary.getRange(i+1,23,1,4).setValues([cells]);
        formatTeacherGrade(summary,i+1);
      }
      Logger.log(key + ': grade columns ready; ' + (rows.length-1) + ' current snapshots updated.');
    });
    safeFlush();
  } finally { lock.releaseLock(); }
}

function appendCheckRaw(rawSheet, data, studentName) {
  rawSheet.appendRow([
    new Date(data.completedAt), studentName, data.code || '', data.assessmentName || '',
    data.verifiedBand || '', data.developingBand || '', data.accuracy, data.fluent,
    data.slow, data.wrong, data.timeout, data.totalQuestions, data.missedFacts.join(', '),
    data.durationSec || 0, data.assessmentId, JSON.stringify(data)
  ].map(checkCell));
}

function upsertCheckSummary(summary, data, studentName) {
  var row = findCheckSummaryRow(summary, studentName);
  // A late retry must not replace a more recent snapshot.
  if (row > 0 && new Date(summary.getRange(row, 2).getValue()).getTime() > Date.parse(data.completedAt)) return;
  var values = [studentName, new Date(data.completedAt), data.code || '', data.verifiedBand || '',
    data.developingBand || '', data.accuracy + '%', data.fluent, data.slow,
    data.wrong + data.timeout, data.missedFacts.join(', '), data.assessmentId,
    checkBandsWithVerdict(data, 'incomplete'), checkBandsWithVerdict(data, 'not_assessed'), data.finalReason || ''
  ].map(checkCell);
  if(data.schemaVersion===3)values=values.concat([data.appVersion,data.conditions.mode,data.conditions.input,
    checkBandsWithVerdict(data,'accuracy_only'),checkBandsWithVerdict(data,'slow'),data.wrong+' / '+data.timeout+' / '+data.skipped,
    data.startedAt,data.breaks.length+' / '+data.interruptions.length].map(checkCell)).concat(teacherGradeCells(data));
  if (row > 0) summary.getRange(row, 1, 1, values.length).setValues([values]);
  else { summary.appendRow(values); row = summary.getLastRow(); }
  if(data.schemaVersion===3)formatTeacherGrade(summary,row);
  safeSortRange(summary, 2, 1, summary.getLastRow() - 1, summary.getLastColumn(), 1, true);
}

function handleFactFlowCheck(data, e) {
  var lock = null;
  var spreadsheetId;
  try {
    validateCheck(data);
    spreadsheetId = resolveTargetSpreadsheetId(data, e);
    assertExpectedSpreadsheetId(data, spreadsheetId);
    // Legacy clients lack IDs; use a deterministic key for their timestamped result.
    if (!data.assessmentId) data.assessmentId = 'legacy-' + normalizeName(data.studentName) + '-' + data.completedAt;
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var rawSheet = ensureCheckRawSheet(ss,data.schemaVersion===3);
    var summary = ensureCheckSummarySheet(ss,data.schemaVersion===3);
    var count = rawSheet.getLastRow() - 1;
    var existing = count > 0 ? rawSheet.getRange(2, 15, count, 2).getValues() : [];
    var stored = null;
    for (var i = 0; i < existing.length; i += 1) {
      if (String(existing[i][0]) === data.assessmentId) { stored = JSON.parse(existing[i][1]); break; }
    }
    if (stored) data = stored;
    else appendCheckRaw(rawSheet, data, normalizeName(data.studentName));
    // Also repairs a summary write that failed after the raw result was saved.
    upsertCheckSummary(summary, data, normalizeName(data.studentName));
    safeFlush();
    return json({ ok: true, receiver: 'factflow-check-v2', buildVersion: BUILD_VERSION,
      student: normalizeName(data.studentName), spreadsheetId: spreadsheetId, assessmentId: data.assessmentId });
  } catch (err) {
    return json({ ok: false, receiver: 'factflow-check-v2', buildVersion: BUILD_VERSION,
      error: err && err.message ? err.message : String(err), spreadsheetId: spreadsheetId });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) {} }
  }
}
