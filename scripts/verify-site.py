"""Check copied assets, project routes, service steps and static dependencies."""
import json
import pathlib
import re
from urllib.parse import unquote, urlsplit
ROOT = pathlib.Path(__file__).resolve().parent.parent
config = json.loads((ROOT / 'site-config.json').read_text())
manifest = json.loads((ROOT / 'scripts/dreamese-assets.json').read_text())
errors = []
assert len(config['projects']) == 14
for entry in manifest['files']:
    if not (ROOT / entry['target']).is_file():
        errors.append('Missing copied asset: ' + entry['target'])
for item in config['projects'] + config['service']['items']:
    for variant in [item, item.get('mobile', {})]:
        for key in ['image','href']:
            value = variant.get(key,'')
            if not value or value == '#' or 'dreamesestudio' in value or not (ROOT/value).is_file():
                errors.append('Invalid ' + key + ': ' + value)
for name,count in [('TKTC',7),('QLDA',7),('TKKT',7),('TKNT',6)]:
    content = (ROOT/f'Qtr_{name}.html').read_text()
    assert len(re.findall(r'<article class="milestone"',content)) == count
    assert len(re.findall(r'<dialog ',content)) == count
    assert 'dreamesestudio/' not in content
files = list(ROOT.glob('*.html')) + list((ROOT/'CSS').glob('*.css')) + [ROOT/'css/service-journey.css']
for path in files:
    if path.name == 'manager.html': continue
    text = path.read_text()
    for pair in re.findall(r'''(?:src|href|data-src)=["']([^"']+)["']|url\(["']?([^\)'"\s]+)''', text):
        value = pair[0] or pair[1]
        if not value or value.startswith(('#','data:','//')) or urlsplit(value).scheme: continue
        local = unquote(urlsplit(value).path)
        if not local: continue
        target = path.parent / local
        if not target.is_file(): errors.append(f'{path.relative_to(ROOT)}: {value}')
if errors: raise SystemExit('\n'.join(sorted(set(errors))))
print(f'PASS: {len(config["projects"])} projects, 4 services, 27 steps, {len(manifest["files"])} copied assets; static links resolve.')
