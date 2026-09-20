// Run with node test-receiver.cjs; all Google services are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const receiverSource = fs.readFileSync(__dirname + '/factflow-practice-apps-script.gs', 'utf8');
const posted = {app:'FactFlowCheck',schemaVersion:2,assessmentId:'ffc-test-1',teacherKey:'IP5/8',studentName:'Test Student',totalQuestions:8,correct:8,fluent:8,slow:0,wrong:0,timeout:0,accuracy:100,missedFacts:[],bandResults:[]};
  // In-memory Apps Script services exercise the actual shared receiver.
  let locked=false, flushes=0, failFlush=false, failSummary=false;
  const sheets=new Map();
  class Sheet {
    constructor(name){this.name=name;this.rows=[];}
    getName(){return this.name;} setName(name){sheets.delete(this.name);this.name=name;sheets.set(name,this);return this;}
    hideSheet(){} getLastRow(){return this.rows.length;} getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
    appendRow(row){assert.ok(locked);this.rows.push(row.slice());}
    getDataRange(){return {getValues:()=>this.rows.map(r=>r.slice())};}
    getRange(row,col,n=1,m=1){return {
      getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.rows[row+i-1]?.[col+j-1]??'')),
      getValue:()=>this.rows[row-1]?.[col-1]??'',
      setValues:values=>{assert.ok(locked);if(failSummary&&this.name==='Check'&&row>1)throw Error('Summary unavailable');for(let i=0;i<n;i++){this.rows[row+i-1]??=[];for(let j=0;j<m;j++)this.rows[row+i-1][col+j-1]=values[i][j];}},
      sort(){},setNumberFormat(){}
    };}
  }
  const rx={console,Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){locked=true;},releaseLock(){locked=false;}})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>sheets.get(name),insertSheet:name=>{assert.ok(locked);const sheet=new Sheet(name);sheets.set(name,sheet);return sheet;}}),flush(){flushes++;if(failFlush)throw Error('Flush unavailable');}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}};
  vm.createContext(rx);vm.runInContext(receiverSource,rx);
  const payload=Object.assign({},posted,{completedAt:'2026-09-20T03:00:00Z'});
  assert.equal(rx.handleFactFlowCheck(payload).ok,true);
  assert.equal(flushes,1);assert.equal(locked,false);
  assert.equal(rx.handleFactFlowCheck(payload).ok,true);
  assert.equal(sheets.get('Raw Data').getLastRow(),2);
  const newer=Object.assign({},payload,{assessmentId:'ffc-newer',completedAt:'2026-09-21T03:00:00Z'});
  assert.equal(rx.handleFactFlowCheck(newer).ok,true);
  assert.equal(rx.handleFactFlowCheck(payload).ok,true);
  assert.equal(sheets.get('Check').rows[1][10],'ffc-newer');
  failSummary=true;
  const retry=Object.assign({},payload,{assessmentId:'ffc-repair',completedAt:'2026-09-22T03:00:00Z'});
  assert.equal(rx.handleFactFlowCheck(retry).ok,false);failSummary=false;
  assert.equal(rx.handleFactFlowCheck(retry).ok,true);
  assert.equal(sheets.get('Raw Data').getLastRow(),4);
  assert.equal(sheets.get('Check').rows[1][10],'ffc-repair');
  failFlush=true;assert.equal(rx.handleFactFlowCheck(retry).ok,false);failFlush=false;
  assert.equal(rx.handleFactFlowCheck(retry).ok,true);
  for(const bad of [{teacherKey:'TYPO'},{correct:50},{expectedSpreadsheetId:'WRONG'},{assessmentId:''},{studentName:''},{missedFacts:[{}]}]) {
    assert.equal(rx.handleFactFlowCheck(Object.assign({},payload,bad)).ok,false);
  }
  assert.equal(sheets.get('Raw Data').getLastRow(),4);
  const legacy=Object.assign({},payload,{classCode:'IP5/8'});delete legacy.app;delete legacy.teacherKey;delete legacy.assessmentId;
  assert.equal(rx.handleFactFlowCheck(legacy).ok,true);
  assert.equal(rx.handleFactFlowCheck(legacy).ok,true);
  assert.equal(sheets.get('Raw Data').getLastRow(),5);
  assert.equal(rx.checkCell('=1+1'),"'=1+1");
  const practice=rx.doPost({postData:{contents:JSON.stringify({app:'FactFlowPractice',teacherKey:'IP5/8',roundId:'round-1',studentName:'Practice Student'})}});
  assert.equal(practice.ok,true);assert.equal(practice.receiver,'factflow-practice-v1');assert.ok(practice.spreadsheetId);
  assert.equal(sheets.get('Raw Data').getLastRow(),5);
  assert.ok(sheets.has('FactFlow Practice'));

console.log('PASS: shared receiver routing, retries, latest snapshots, failure recovery, and separate practice reporting.');
