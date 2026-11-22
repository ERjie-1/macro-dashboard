const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('lib/positioningReading.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{}};vm.runInNewContext(code,sandbox);const {calendarDte,expiryRows,positioningReading}=sandbox.exports;
assert.equal(calendarDte('2026-11-23','2026-11-20'),3);
assert.equal(calendarDte('2027-01-02','2026-12-31'),2);
assert.equal(calendarDte('2026-02-30','2026-02-01'),null);
assert.equal(calendarDte('2026-11-23'),null);
const real=JSON.parse(fs.readFileSync('public/data/positioning.json'));
assert.equal(expiryRows(real.options.SPY,real.asOfTradingDate).find(x=>x.expiry==='2026-11-23').dte,3);
assert.match(positioningReading(real.options.IWM,real.asOfTradingDate).flipText,/未找到/);
assert.equal(positioningReading(real.options.SPY,real.asOfTradingDate).peak.strike,700);
const synthetic={...real.options.SPY,gex:{byStrike:[],byExpiry:[{expiry:'2026-11-23',gex:100},{expiry:'2026-11-24',gex:-100}],total:0,flipPrice:null}};
assert.equal(positioningReading(synthetic,'2026-11-20').share,.5);
synthetic.gex.byExpiry.forEach(x=>x.gex=0);assert.equal(positioningReading(synthetic,'2026-11-20').share,null);
console.log('positioningReading: date basis, invalid/missing dates, real SPY/IWM, net cancellation and zero mass passed');
const {selectedExpiryDetails,gammaStructure}=sandbox.exports;
const base=real.options.SPY;
assert.equal(selectedExpiryDetails(base,'1900-01-01'),null);
assert.equal(selectedExpiryDetails(base,base.pcr.targetExpiry).keyLevels,base.keyLevels);
const second={keyLevels:{putWall:{strike:123,oi:50},callWall:{strike:456,oi:60},topLevels:[]},pcr:{...base.pcr,targetExpiry:'2026-11-24'},maxPain:234};
const enriched={...base,expiryDetails:{'2026-11-24':second}};
assert.equal(selectedExpiryDetails(enriched,'2026-11-24'),second);
assert.equal(selectedExpiryDetails(enriched,base.pcr.targetExpiry).keyLevels,base.keyLevels);
for(const [values,total,word] of [[[2,8],10,'为正'],[[-2,-8],-10,'为负'],[[-2,8],6,'互相抵消'],[[0,0],0,'没有净敞口'],[[],NaN,'未知']]) {
 const input={gex:{total,byExpiry:values.map((gex,i)=>({expiry:String(i),gex}))}};
 assert.ok(gammaStructure(input).includes(word));
}
console.log('expiry identity/fallback/missing and positive/negative/mixed/zero/unknown narratives passed');
