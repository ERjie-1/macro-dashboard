"""Real pandas/numpy calculation, offline chains with independent known peaks."""
import ast
from pathlib import Path
import pandas as pd
import numpy as np
root = ast.parse(Path('data/fetch_positioning.py').read_text())
names = {'compute_expiry_details','compute_key_levels','compute_max_pain'}
ns = {'np': np}
exec(compile(ast.Module(body=[n for n in root.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), '<real-functions>', 'exec'), ns)
fn = ns['compute_expiry_details']
def frame(oi):
    return pd.DataFrame({'expiry':['2026-11-23']*2+['2026-12-18']*2,'strike':[100.,110.,100.,110.], 'openInterest':oi,'volume':[10.,20.,30.,40.]})
c,p = frame([10.,20.,30.,10.]), frame([20.,10.,10.,30.])
r=fn(c,p)
assert r['2026-11-23']['keyLevels']['callWall']['strike']==110
assert r['2026-12-18']['keyLevels']['callWall']['strike']==100
assert r['2026-11-23']['keyLevels']['putWall']['strike']==100
assert r['2026-12-18']['keyLevels']['putWall']['strike']==110
bad=p.copy();bad.loc[2,'openInterest']=np.nan
r=fn(c,bad);assert r['2026-12-18'] is None and r['2026-11-23'] is not None
zero=c.copy();zero.loc[2:,'openInterest']=0
r=fn(zero,p);assert r['2026-12-18']['keyLevels']['callWall'] is None
assert r['2026-12-18']['pcr']['oiRatio'] is None
pz=p.copy();pz.loc[2:,'openInterest']=0
r=fn(zero,pz);assert r['2026-12-18']['maxPain'] is None and r['2026-12-18']['keyLevels']['topLevels']==[]
cv=c.copy();cv.loc[2,'volume']=np.nan
assert fn(cv,p)['2026-12-18']['pcr']['volRatio'] is None
assert fn(c,p.iloc[:2])['2026-12-18'] is None
assert fn(c,pz)['2026-12-18']['pcr']['oiRatio']==0
print('real calculation: two expiry peaks, NaN isolation, one-sided missing, true zero, absent peak, invalid PCR/MaxPain passed')
# Ranking must be combined across sides, without a hidden five-per-side quota.
many=pd.DataFrame({'expiry':['2026-12-18']*9,'strike':range(100,109),'openInterest':range(100,109),'volume':[1]*9})
one=pd.DataFrame({'expiry':['2026-12-18'],'strike':[200],'openInterest':[1],'volume':[1]})
levels=fn(one,many)['2026-12-18']['keyLevels']['topLevels']
assert [x['strike'] for x in levels[:8]]==list(range(108,100,-1))
print('combined top eight retains more than five rows from one side')
