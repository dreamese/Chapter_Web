#!/usr/bin/env node
// Tải ảnh xem trước (thumbnail) của các bài TikTok về assets/blog/thumbs/
// và điền vào các trường "image" còn trống trong js/default-data.js (và site-config.json nếu có).
//
// Chạy từ thư mục gốc của repo (cần Node 18 trở lên):
//   node scripts/fetch-tiktok-thumbs.mjs
//   node scripts/fetch-tiktok-thumbs.mjs js/default-data.js site-config.json   (chỉ định file)
//   node scripts/fetch-tiktok-thumbs.mjs --dry                                 (chỉ báo cáo, không ghi)
//
// Vì sao phải tải về: link thumbnail do TikTok oEmbed trả về có chữ ký và hết hạn,
// nên không thể dán thẳng link đó vào web. Ảnh phải được lưu trong repo.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const files = args.filter(a => !a.startsWith('--'));
const TARGETS = files.length ? files : ['js/default-data.js', 'site-config.json'];
const OUT_DIR = 'assets/blog/thumbs';
const DELAY_MS = 700;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => access(p).then(() => true, () => false);
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

async function fetchJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return await res.json();
      if (res.status === 404 || res.status === 400) return null;   // bài riêng tư / đã xoá
    } catch { /* thử lại */ }
    await sleep(1500 * i);
  }
  return null;
}

async function downloadImage(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const type = (res.headers.get('content-type') || '').split(';')[0].trim();
        return { buffer: Buffer.from(await res.arrayBuffer()), ext: EXT[type] || 'jpg' };
      }
    } catch { /* thử lại */ }
    await sleep(1500 * i);
  }
  return null;
}

const texts = new Map();
for (const file of TARGETS) {
  if (await exists(file)) texts.set(file, await readFile(file, 'utf8'));
}
if (!texts.size) { console.error('Không tìm thấy file nào trong:', TARGETS.join(', ')); process.exit(1); }

// Gom các bài TikTok (id -> url)
const posts = new Map();
const urlRe = /https:\/\/www\.tiktok\.com\/@[\w.]+\/(?:photo|video)\/(\d{15,22})/g;
for (const text of texts.values()) {
  for (const m of text.matchAll(urlRe)) posts.set(m[1], m[0]);
}
console.log(`Tìm thấy ${posts.size} bài TikTok trong: ${[...texts.keys()].join(', ')}`);
if (DRY) { console.log('(--dry) dừng tại đây.'); process.exit(0); }

await mkdir(OUT_DIR, { recursive: true });
const saved = new Map();   // id -> đường dẫn tương đối
let failed = 0;

for (const [id, url] of posts) {
  let found = null;
  for (const ext of ['jpg', 'webp', 'png']) {
    if (await exists(`${OUT_DIR}/${id}.${ext}`)) { found = `${OUT_DIR}/${id}.${ext}`; break; }
  }
  if (found) { saved.set(id, found); continue; }          // đã có từ lần chạy trước

  const info = await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  const thumb = info?.thumbnail_url;
  const img = thumb ? await downloadImage(thumb) : null;
  if (!img) { failed++; console.warn(`✗ ${id}: không lấy được thumbnail`); await sleep(DELAY_MS); continue; }

  const rel = `${OUT_DIR}/${id}.${img.ext}`;
  await writeFile(rel, img.buffer);
  saved.set(id, rel);
  console.log(`✓ ${id} → ${rel} (${Math.round(img.buffer.length / 1024)} KB)`);
  await sleep(DELAY_MS);
}

// Điền vào "image": "" đứng ngay trước "description" và "url" của từng bài (cả bản desktop lẫn "mobile")
const fieldRe = /("image"\s*:\s*)""(\s*,\s*"description"\s*:\s*"(?:[^"\\]|\\.)*"\s*,\s*"url"\s*:\s*"[^"]*?\/(\d{15,22})")/g;
for (const [file, text] of texts) {
  let count = 0;
  const next = text.replace(fieldRe, (all, head, tail, id) => {
    const rel = saved.get(id);
    if (!rel) return all;
    count++;
    return `${head}"${rel}"${tail}`;
  });
  if (count) await writeFile(file, next, 'utf8');
  console.log(`${file}: điền ${count} trường image`);
}

console.log(`Xong. Có ảnh: ${saved.size}/${posts.size}${failed ? `, lỗi: ${failed} (chạy lại script để thử lại các bài lỗi)` : ''}.`);
