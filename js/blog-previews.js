(() => {
  'use strict';
  window.createDreameseBlogPreviews = function (rail) {
    const slots = [...rail.querySelectorAll('.blog-preview-slot')].map(element => ({
      element, cover:element.querySelector('.blog-cover'), notice:element.querySelector('.blog-preview-status'),
      id:element.dataset.postId, visible:false, state:'idle', frame:null, timer:0, used:0
    }));
    let destroyed = false;
    let suspended = false;
    let pending = 0;
    let nextRequest = 0;
    let cooldown = 0;
    let pumpTimer = 0;
    const MAX_PENDING = 2;
    const MAX_FRAMES = 6;
    const PAUSE = {type:'pause','x-tiktok-player':true};

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
      slot.element.classList.remove('is-preview-loading','is-preview-ready');
      slot.element.setAttribute('aria-busy','false');
    }
    function schedule(delay = 0) {
      clearTimeout(pumpTimer);
      if (destroyed || suspended || document.hidden) return;
      pumpTimer = setTimeout(pump, delay);
    }
    function fail(slot) {
      if (!slot.frame) return;
      release(slot,'failed');
      slot.notice.textContent = 'TikTok chưa tải được. Chạm để thử xem trước.';
      slot.notice.hidden = false;
      slot.cover.querySelector('.blog-cover-label').textContent = 'Thử xem trước TikTok';
      cooldown = Date.now() + 30000;
      schedule(30000);
    }
    function makeRoom() {
      const frames = slots.filter(slot => slot.frame);
      if (frames.length < MAX_FRAMES) return true;
      const oldest = frames.filter(slot => !slot.visible && slot.state !== 'loading').sort((a,b)=>a.used-b.used)[0];
      if (!oldest) return false;
      release(oldest);
      oldest.notice.hidden = true;
      return true;
    }
    function load(slot) {
      if (!makeRoom()) return false;
      slot.state = 'loading';
      slot.used = Date.now();
      pending++;
      slot.cover.disabled = true;
      slot.notice.hidden = false;
      slot.notice.textContent = 'Đang tải xem trước TikTok…';
      slot.element.classList.add('is-preview-loading');
      slot.element.setAttribute('aria-busy','true');
      const frame = document.createElement('iframe');
      frame.className = 'blog-preview-frame';
      frame.title = 'Xem trước TikTok: ' + slot.element.dataset.title;
      frame.allow = 'encrypted-media; fullscreen; picture-in-picture';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'origin';
      frame.hidden = false;
      slot.frame = frame;
      frame.addEventListener('load', () => { if (slot.frame === frame && slot.state === 'loading') ready(slot); }, {once:true});
      frame.addEventListener('error', () => { if (slot.frame === frame) fail(slot); }, {once:true});
      frame.src = `https://www.tiktok.com/player/v1/${slot.id}?autoplay=0&controls=1&play_button=1&music_info=1&description=1&rel=0&muted=0&native_context_menu=1`;
      slot.element.append(frame);
      slot.timer = setTimeout(() => { if (slot.frame === frame && slot.state === 'loading') fail(slot); }, 12000);
      nextRequest = Date.now() + 700;
      return true;
    }
    function pump() {
      if (destroyed || suspended || document.hidden || pending >= MAX_PENDING) return;
      const wait = Math.max(nextRequest,cooldown) - Date.now();
      if (wait > 0) { schedule(wait); return; }
      const slot = slots.find(slot => slot.visible && slot.state === 'idle' && /^\d{15,22}$/.test(slot.id));
      if (slot && load(slot)) schedule(700);
    }
    function activate(slot) {
      if (destroyed || suspended || slot.state === 'loading') return;
      slot.visible = true;
      if (slot.state === 'ready') {slot.frame?.focus();return;}
      cooldown = 0;
      slot.state = 'idle';
      if (pending < MAX_PENDING && Date.now() >= nextRequest) load(slot);
      schedule(700);
    }
    const clickHandlers = new Map();
    slots.forEach(slot => {
      const handler = () => activate(slot);
      slot.cover.addEventListener('click',handler);
      clickHandlers.set(slot,handler);
    });
    function ready(slot) {
      clearTimeout(slot.timer);slot.timer=0;pending--;
      slot.state='ready';slot.used=Date.now();
      slot.frame.hidden=false;slot.cover.hidden=true;slot.cover.disabled=false;
      slot.notice.hidden=true;
      slot.element.classList.remove('is-preview-loading');
      slot.element.classList.add('is-preview-ready');
      slot.element.setAttribute('aria-busy','false');
      if(suspended || !slot.visible || document.hidden)pause(slot);
      schedule(700);
    }
    function receive(event) {
      if (destroyed) return;
      try {const u=new URL(event.origin);if(u.protocol!=='https:' || !['www.tiktok.com','tiktok.com'].includes(u.hostname))return;} catch {return;}
      const slot = slots.find(slot => slot.frame && slot.frame.contentWindow === event.source);
      if (!slot) return;
      let payload=event.data;
      if(typeof payload==='string'){try{payload=JSON.parse(payload);}catch{return;}}
      if(!payload || payload['x-tiktok-player']!==true)return;
      if (payload.type === 'onPlayerReady' && slot.state === 'loading') {
        ready(slot);
      } else if (payload.type === 'onPlayerError' || payload.type === 'onError') {
        // A photo carousel stays usable when its music is aborted or autoplay is blocked.
        const code = Number(payload.type === 'onError' ? payload.value : payload.value?.errorCode);
        if ((payload.type === 'onError' && code === 1) ||
            (payload.type === 'onPlayerError' && code === 3002)) return;
        fail(slot);
      } else if (payload.type === 'onStateChange' && Number(payload.value) === 1) {
        if (suspended || !slot.visible || document.hidden) pause(slot);
        else slots.forEach(other=>{if(other!==slot)pause(other);});
      }
    }
    window.addEventListener('message',receive);
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const slot=slots.find(slot=>slot.element===entry.target);
        if(!slot)return;
        slot.visible=entry.isIntersecting && entry.intersectionRatio >= .12;
        if(!slot.visible){pause(slot);if(slot.state==='loading')release(slot);}
      });
      schedule(100);
    },{threshold:[0,.12,.5]});
    slots.forEach(slot=>observer.observe(slot.element));
    function visibility(){if(document.hidden)slots.forEach(pause);else schedule(100);}
    document.addEventListener('visibilitychange',visibility);
    return {
      suspend(){suspended=true;clearTimeout(pumpTimer);slots.forEach(slot=>{pause(slot);if(slot.state==='loading')release(slot);});},
      resume(){suspended=false;schedule(100);},
      destroy(){destroyed=true;clearTimeout(pumpTimer);observer.disconnect();slots.forEach(slot=>{slot.cover.removeEventListener('click',clickHandlers.get(slot));release(slot);});window.removeEventListener('message',receive);document.removeEventListener('visibilitychange',visibility);}
    };
  };
})();

