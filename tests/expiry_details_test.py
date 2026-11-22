"""Offline producer routing: every metric receives the same actual expiry key."""
import ast
from pathlib import Path
root = ast.parse(Path('data/fetch_positioning.py').read_text())
fn = next(n for n in root.body if isinstance(n, ast.FunctionDef) and n.name == 'compute_expiry_details')
calls = {'expiry': ['2026-11-23', '2026-12-18', '2026-12-18', '2026-12-25']}
puts = {'expiry': ['2026-11-23', '2026-12-18']}
seen = []
def metric(name):
    def calculate(c, p, expiry):
        assert c is calls and p is puts
        seen.append((name, expiry))
        return name + ':' + expiry
    return calculate
ns = {name: metric(name) for name in ['compute_key_levels', 'compute_max_pain', 'compute_pcr']}
exec(compile(ast.Module(body=[fn], type_ignores=[]), '<offline>', 'exec'), ns)
result = ns['compute_expiry_details'](calls, puts)
assert list(result) == ['2026-11-23', '2026-12-18']
assert len(seen) == 6
for expiry, detail in result.items():
    assert all(value.endswith(expiry) for value in detail.values())
puts['expiry'] = []
assert ns['compute_expiry_details'](calls, puts) == {}
print('producer expiry routing: two dates, duplicates, one-sided missing chain passed; no network')
