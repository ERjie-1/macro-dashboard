const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('lib/factorHistory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const s={exports:{}};vm.runInNewContext(code,s);const calc=s.exports.factorHistory;
const data=JSON.parse(fs.readFileSync('public/data/dashboard.json'));const factor=data.modules.flatMap(m=>m.factors).find(f=>f.name==='Fed Net Liquidity');
const r=calc(factor.trendData);assert.equal(r.points.length,90);assert.equal(r.min,5724.916);assert.equal(r.max,5947.022);assert.ok(r.domain[0]<r.min&&r.domain[0]>5000);assert.ok(r.domain[1]>r.max&&r.domain[1]<6500);
for(const values of [[-3,-1],[.001,.002],[0,0],[5800,5800]]) { const x=calc(values.map((value,i)=>({date:String(i),value})));assert.ok(x.domain[0]<Math.min(...values));assert.ok(x.domain[1]>Math.max(...values)); }
assert.equal(calc([{date:'x',value:NaN}]).points.length,0);
console.log('factorHistory: 90 real observations, tight raw-value scale, negative/small/constant/missing passed');
