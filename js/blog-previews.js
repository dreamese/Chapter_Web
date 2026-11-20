(() => {
  'use strict';

  window.createDreameseBlogPreviews = function (rail) {
    // ── Cấu hình ─────────────────────────────────────────────────────────────
    const CONFIG = {
      MAX_PENDING: 2,                 // số player TikTok được tải tự động cùng lúc (2 để 1 player kẹt không chặn cả hàng đợi)
      MAX_FRAMES: 4,                  // số player TikTok "sống" tối đa trên trang
      GAP: 1200,                      // ms tối thiểu giữa 2 lần tải tự động
      VISIBLE_DELAY: 450,             // thẻ phải nằm trong màn hình ngần này ms mới tải (tránh tải khi lướt nhanh)
      LOAD_TIMEOUT: 12000,            // quá thời gian này coi là lỗi
      RETRY_DELAYS: [4000, 12000, 30000], // tự thử lại tối đa 3 lần, rồi chờ người dùng bấm
      BREAKER_FAILS: 3,               // lỗi liên tiếp ngần này lần thì nghỉ chung một lúc
      BREAKER_PAUSE: 20000,
      AUTOLOAD_WITH_THUMB: false      // true: thẻ đã có ảnh thumbnail vẫn tự tải player; false: chỉ tải khi bấm
    };

    const conn = navigator.connection;
    const lowData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));

    const slots = [...rail.querySelectorAll('.blog-preview-slot')].map(element => ({
      element,
      cover: element.querySelector('.blog-cover'),
      notice: element.querySelector('.blog-preview-status'),
      id: element.dataset.postId,
      valid: /^\d{15,22}$/.test(element.dataset.postId || ''),
      visible: false,
      visibleSince: 0,
      state: 'idle',          // idle | loading | ready | failed
      frame: null,
      timer: 0,
      used: 0,
      attempts: 0,
      retryAt: 0
    }));

    let destroyed = false;
    let suspended = false;
    let pending = 0;
    let nextRequest = 0;
    let breakerUntil = 0;
    let consecutiveFails = 0;
    let pumpTimer = 0;
    const PAUSE = { type: 'pause', 'x-tiktok-player': true };

    function pause(slot) {
      slot.frame?.contentWindow?.postMessage(PAUSE, 'https://www.tiktok.com');
    }

    function release(slot, state = 'idle') {
      clearTimeout(slot.timer);
      slot.timer = 0;
      if (slot.state === 'loading') pending--;
      pause(slot);
      slot.frame?.remove();
      slot.frame = null;
      slot.state = state;
      slot.cover.hidden = false;
      slot.cover.disabled = false;
      if (state !== 'failed') slot.notice.hidden = true;
      slot.element.classList.remove('is-preview-loading', 'is-preview-ready');
      slot.element.setAttribute('aria-busy', 'false');
    }

    function schedule(delay = 0) {
      clearTimeout(pumpTimer);
      if (destroyed || suspended || document.hidden) return;
      pumpTimer = setTimeout(pump, delay);
    }

    function canAuto(slot) {
      if (lowData) return false;
      return CONFIG.AUTOLOAD_WITH_THUMB || slot.cover.classList.contains('is-branded-cover');
    }

    function fail(slot) {
      if (!slot.frame) return;
      release(slot, 'failed');
      slot.attempts++;
      consecutiveFails++;
      const auto = slot.attempts <= CONFIG.RETRY_DELAYS.length;
      slot.retryAt = Date.now() + (CONFIG.RETRY_DELAYS[slot.attempts - 1] || 0);
      slot.notice.textContent = auto
        ? 'TikTok chưa phản hồi. Đang tự thử lại…'
        : 'TikTok chưa tải được. Chạm để thử xem trước.';
      slot.notice.hidden = false;
      const label = slot.cover.querySelector('.blog-cover-label');
      if (label) label.textContent = 'Thử xem trước TikTok';
      if (consecutiveFails >= CONFIG.BREAKER_FAILS) {
        breakerUntil = Date.now() + CONFIG.BREAKER_PAUSE;
        consecutiveFails = 0;
      }
      schedule(300);
    }

    function makeRoom(force = false) {
      const frames = slots.filter(slot => slot.frame);
      if (frames.length < CONFIG.MAX_FRAMES) return true;
      const candidates = frames
        .filter(slot => slot.state !== 'loading' && (force || !slot.visible))
        .sort((a, b) => (a.visible - b.visible) || (a.used - b.used));
      const oldest = candidates[0];
      if (!oldest) return false;
      release(oldest);
      return true;
    }

    function load(slot, force = false) {
      if (!makeRoom(force)) return false;
      slot.state = 'loading';
      slot.used = Date.now();
      pending++;
      slot.cover.disabled = true;
      slot.notice.hidden = false;
      slot.notice.textContent = 'Đang tải xem trước TikTok…';
      slot.element.classList.add('is-preview-loading');
      slot.element.setAttribute('aria-busy', 'true');

      const frame = document.createElement('iframe');
      frame.className = 'blog-preview-frame';
      frame.title = 'Xem trước TikTok: ' + slot.element.dataset.title;
      frame.allow = 'encrypted-media; fullscreen; picture-in-picture';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'origin';
      frame.hidden = false;
      slot.frame = frame;
      frame.addEventListener('load', () => {
        if (slot.frame === frame && slot.state === 'loading') ready(slot);
      }, { once: true });
      frame.addEventListener('error', () => { if (slot.frame === frame) fail(slot); }, { once: true });
      frame.src = `https://www.tiktok.com/player/v1/${slot.id}?autoplay=0&controls=1&play_button=1&music_info=1&description=1&rel=0&muted=0&native_context_menu=1`;
      slot.element.append(frame);
      slot.timer = setTimeout(() => {
        if (slot.frame === frame && slot.state === 'loading') fail(slot);
      }, CONFIG.LOAD_TIMEOUT);
      nextRequest = Date.now() + CONFIG.GAP;
      return true;
    }

    // Chọn thẻ tiếp theo cần tải. Trả về { slot } hoặc { wait } (ms tới lúc có thẻ đến lượt).
    function pickSlot(now) {
      let soonest = Infinity;
      for (const slot of slots) {
        if (!slot.visible || !slot.valid || !canAuto(slot)) continue;
        let at;
        if (slot.state === 'idle') at = slot.visibleSince + CONFIG.VISIBLE_DELAY;
        else if (slot.state === 'failed' && slot.attempts <= CONFIG.RETRY_DELAYS.length) at = slot.retryAt;
        else continue;
        if (at <= now) return { slot };
        soonest = Math.min(soonest, at);
      }
      return { wait: soonest - now };
    }

    function pump() {
      if (destroyed || suspended || document.hidden || pending >= CONFIG.MAX_PENDING) return;
      const now = Date.now();
      const gate = Math.max(nextRequest, breakerUntil);
      if (gate > now) { schedule(gate - now); return; }
      const { slot, wait } = pickSlot(now);
      if (slot) { if (load(slot)) schedule(CONFIG.GAP); }
      else if (wait < Infinity) schedule(wait);
    }

    // Người dùng bấm vào thẻ: luôn được ưu tiên, bỏ qua hàng đợi và thời gian chờ.
    function activate(slot) {
      if (destroyed || suspended || slot.state === 'loading' || !slot.valid) return;
      slot.visible = true;
      if (slot.state === 'ready') { slot.frame?.focus(); return; }
      slot.attempts = 0;
      consecutiveFails = 0;
      breakerUntil = 0;
      slot.state = 'idle';
      load(slot, true);
      schedule(CONFIG.GAP);
    }

    const clickHandlers = new Map();
    slots.forEach(slot => {
      const handler = () => activate(slot);
      slot.cover.addEventListener('click', handler);
      clickHandlers.set(slot, handler);
    });

    function ready(slot) {
      clearTimeout(slot.timer);
      slot.timer = 0;
      pending--;
      slot.state = 'ready';
      slot.used = Date.now();
      slot.attempts = 0;
      consecutiveFails = 0;
      slot.frame.hidden = false;
      slot.cover.hidden = true;
      slot.cover.disabled = false;
      slot.notice.hidden = true;
      slot.element.classList.remove('is-preview-loading');
      slot.element.classList.add('is-preview-ready');
      slot.element.setAttribute('aria-busy', 'false');
      if (suspended || !slot.visible || document.hidden) pause(slot);
      schedule(CONFIG.GAP);
    }

    function receive(event) {
      if (destroyed) return;
      try {
        const u = new URL(event.origin);
        if (u.protocol !== 'https:' || !['www.tiktok.com', 'tiktok.com'].includes(u.hostname)) return;
      } catch { return; }
      const slot = slots.find(slot => slot.frame && slot.frame.contentWindow === event.source);
      if (!slot) return;
      let payload = event.data;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { return; } }
      if (!payload || payload['x-tiktok-player'] !== true) return;
      if (payload.type === 'onPlayerReady' && slot.state === 'loading') {
        ready(slot);
      } else if (payload.type === 'onPlayerError' || payload.type === 'onError') {
        // Bài ảnh vẫn dùng được khi nhạc bị chặn tự phát.
        const code = Number(payload.type === 'onError' ? payload.value : payload.value?.errorCode);
        if ((payload.type === 'onError' && code === 1) ||
            (payload.type === 'onPlayerError' && code === 3002)) return;
        fail(slot);
      } else if (payload.type === 'onStateChange' && Number(payload.value) === 1) {
        if (suspended || !slot.visible || document.hidden) pause(slot);
        else slots.forEach(other => { if (other !== slot) pause(other); });
      }
    }
    window.addEventListener('message', receive);

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const slot = slots.find(slot => slot.element === entry.target);
        if (!slot) return;
        const was = slot.visible;
        slot.visible = entry.isIntersecting && entry.intersectionRatio >= .12;
        if (slot.visible && !was) slot.visibleSince = Date.now();
        if (!slot.visible) {
          pause(slot);
          if (slot.state === 'loading') release(slot);
        }
      });
      schedule(100);
    }, { threshold: [0, .12, .5] });
    slots.forEach(slot => observer.observe(slot.element));

    function visibility() {
      if (document.hidden) slots.forEach(pause);
      else schedule(100);
    }
    document.addEventListener('visibilitychange', visibility);

    return {
      suspend() {
        suspended = true;
        clearTimeout(pumpTimer);
        slots.forEach(slot => { pause(slot); if (slot.state === 'loading') release(slot); });
      },
      resume() { suspended = false; schedule(100); },
      destroy() {
        destroyed = true;
        clearTimeout(pumpTimer);
        observer.disconnect();
        slots.forEach(slot => {
          slot.cover.removeEventListener('click', clickHandlers.get(slot));
          release(slot);
        });
        window.removeEventListener('message', receive);
        document.removeEventListener('visibilitychange', visibility);
      }
    };
  };
})();
