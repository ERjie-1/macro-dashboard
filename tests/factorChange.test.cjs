const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
function load(path,imports={}) { const s={exports:{},require:k=>imports[k]};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,s);return s.exports; }
const {factorChange:calc}=load('lib/factorChange.ts',{'./scoreMetrics':load('lib/scoreMetrics.ts')});
const data=JSON.parse(fs.readFileSync('public/data/dashboard.json'));const factors=data.modules.flatMap(m=>m.factors);const byId=id=>factors.find(f=>f.id===id);
assert.equal(calc(byId('vix'),data.asOfTradingDate).label,'+16.59 点');
assert.ok(calc(byId('bank-reserves'),data.asOfTradingDate).label.endsWith('十亿美元'));
assert.ok(calc(byId('real-rate-level'),data.asOfTradingDate).label.endsWith('百分点'));
for(const f of factors) assert.notEqual(calc(f,data.asOfTradingDate).label,'N/A',f.id);
assert.equal(calc(byId('vix')).label,'N/A');
assert.equal(calc({...byId('vix'),trendData:[{date:'11/20',value:5}]},'2026-11-20').label,'N/A');
assert.equal(calc({...byId('vix'),trendData:[{date:'11/13',value:5},{date:'11/20',value:5}]},'2026-11-20').delta,0);
console.log('factorChange: all 46 real factors, VIX points, dollar/rate units, missing baseline, true zero passed');
