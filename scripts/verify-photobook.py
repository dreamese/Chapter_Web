"""Check photo/caption/story retention and page/link coverage for all project books."""
from pathlib import Path
from html import unescape
import json,re,sys
ROOT=Path(__file__).resolve().parent.parent
baseline=json.loads((ROOT/'scripts/photobook-content.json').read_text())
known=None
if len(sys.argv)>1:known={x['path'] for x in json.loads(Path(sys.argv[1]).read_text())['tree']}
all_images=0;all_pages=0
for filename,expected in baseline.items():
 page=(ROOT/filename).read_text();match=re.search(r'<script type="application/json" id="photobookData">(.*?)</script>',page,re.S);assert match,filename
 data=json.loads(match[1]);urls=[x['src'] for x in data['photos']]
 assert urls==expected['photos'],f'{filename}: lost or reordered photos'
 assert len(urls)==len(set(urls)),f'{filename}: duplicated photos'
 assert len(re.findall(r'<section class="book-sheet ',page))==expected['pages'],filename
 rendered=set(int(x) for x in re.findall(r'data-photo-index="(\d+)"',page))
 assert rendered==set(range(len(urls))),f'{filename}: a photo is missing from the printed pages'
 visible=unescape(re.sub('<[^>]+>',' ',page));visible=re.sub(r'\s+',' ',visible)
 for text in expected['paragraphs']+expected['facts']:
  assert text in visible,f'{filename}: missing project copy'
 if expected['quote']:assert expected['quote'] in visible,filename
 if expected.get('partner'):assert expected['partner'] in visible,filename
 assert [x['description'] for x in data['photos'] if x['description']]==expected['captionDescriptions'],filename
 for url in urls:
  assert url in known if known is not None else (ROOT/url).is_file(),url
 assert 'CSS/photobook.css?v=1.0.0' in page and 'JS/photobook.js?v=1.0.0' in page,filename
 assert 'JS/Project-Site.js' not in page,filename
 all_images+=len(urls);all_pages+=expected['pages']
print(f'PASS: {len(baseline)} project photobooks; {all_images} photos; {all_pages} pages; all source stories, metadata and image descriptions retained.')
