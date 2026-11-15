"""Copy every Dreamese project/process image at the pinned revision into this repo.
Preserve folder structure and source resolution; encode web images at WebP quality 88.
No running page requests resources from the source repository.
"""
import concurrent.futures
import hashlib
import io
import json
import pathlib
import time
import urllib.parse
import urllib.request
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'scripts/dreamese-assets.json').read_text())

def copy(entry):
    destination = ROOT / entry['target']
    if destination.exists():
        return None
    url = 'https://raw.githubusercontent.com/' + MANIFEST['repository'] + '/' + MANIFEST['commit'] + '/' + urllib.parse.quote(entry['source'])
    for attempt in range(4):
        try:
            data = urllib.request.urlopen(url, timeout=120).read()
            digest = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            if digest != entry['sha']:
                raise ValueError('Source blob checksum mismatch: ' + entry['source'])
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(destination.suffix + '.tmp')
            if destination.suffix == '.webp':
                image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
                if image.mode not in ('RGB', 'RGBA'):
                    image = image.convert('RGB')
                image.save(temporary, 'WEBP', quality=MANIFEST['quality'], method=4)
            else:
                temporary.write_bytes(data)
            temporary.replace(destination)
            return None
        except Exception as error:
            if attempt == 3:
                return entry['source'] + ': ' + str(error)
            time.sleep(attempt + 1)

if __name__ == '__main__':
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for index, error in enumerate(pool.map(copy, MANIFEST['files']), 1):
            if error:
                errors.append(error)
            if index % 25 == 0:
                print(f'{index}/{len(MANIFEST["files"])} assets copied', flush=True)
    if errors:
        raise SystemExit('\n'.join(errors))
    print('All assets are available inside Chapter_Web.')
