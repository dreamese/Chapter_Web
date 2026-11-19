const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/site.js'), 'utf8');
const elements = {};
const timers = new Map();
const handlers = {};
let timerId = 0;
function element(id) {
  return {id, src:'about:blank', hidden:true, dataset:{}, textContent:'', disabled:false,
    contentWindow:{}, listeners:{}, attrs:{},
    classList:{toggle(){}},
    querySelector(){return elements.label;},
    setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,f){this.listeners[k]=f;},
    cloneNode(){return element(id);},
    replaceWith(next){elements['#'+id]=next;},
    click(){this.clicked=(this.clicked||0)+1;}
  };
}
for(const id of ['mediaOverlayPlayer','mediaPlayerPoster','mediaOverlayPlay','mediaPlayerMessage','mediaOverlay','mediaOverlayLink','mediaEyebrow','mediaTitle']) elements['#'+id]=element(id);
elements.label=element('label');
const context={URL,URLSearchParams,console,
  q:selector=>elements[selector]||null, qa:()=>[],
  window:{location:{protocol:'https:',href:'https://dreamese.github.io/Chapter_Web/'},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),addEventListener:(type,fn)=>{handlers[type]=fn;}},
  activeMediaSourceUrl:'https://www.tiktok.com/@dreamese.studio/photo/7707139553760414983',
  activeMediaVideoId:'7707139553760414983',
  activeMediaPlayerUrl:'https://www.tiktok.com/player/v1/7707139553760414983',
  mediaPlayerReady:false,mediaPlayerState:'poster',mediaPlayerLoadTimer:0,blogPreviewController:null,getTikTokVideoId:()=> '7707139553760414983',
  closeOverlays:()=>{},deviceValue:(item,key,fallback)=>item[key]??fallback,
  escapeHtml:value=>String(value).replace(/[<>&"']/g,'_'),normalizeMediaUrl:value=>value,
  enableHorizontalWheel:()=>{},MEDIA_POSTER:'assets/blog/dreamese-poster.svg',
  mediaRail:{innerHTML:''},config:{media:{eyebrow:'Blog',title:'Journal',items:[{title:'Photo <01>',url:'https://www.tiktok.com/@dreamese.studio/photo/7707139553760414983'}]}}
};
vm.createContext(context);
function extract(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
vm.runInContext(extract('  function setMediaPlayerState(','  function deviceValue('),context);
vm.runInContext(extract('  function renderMedia()','  function renderNews()'),context);
vm.runInContext(extract("    window.addEventListener('message', (event) => {\n      const player",'    enableMobileProjectSectionSwipe();'),context);
context.renderMedia();
assert(!context.mediaRail.innerHTML.includes('<iframe'),'Card markup must not eagerly mount players; the preview queue owns requests');
assert(context.mediaRail.innerHTML.includes('assets/blog/dreamese-poster.svg'),'Missing covers use a local poster');
assert.equal(timers.size,0);
context.startMediaPlayback();
let player=elements['#mediaOverlayPlayer'];
assert.equal(context.mediaPlayerState,'loading');
assert.equal(timers.size,1);
assert.equal(player.listeners.load,undefined,'Iframe load must never be treated as TikTok readiness');
const message=(origin,sourceWindow,type,value)=>handlers.message({origin,source:sourceWindow,data:{'x-tiktok-player':true,type,value}});
message('https://www.tiktok.com',{},'onPlayerReady');
message('https://www.tiktok.com.evil.example',player.contentWindow,'onPlayerReady');
assert.equal(context.mediaPlayerState,'loading','Ignore stale or spoofed messages');
message('https://www.tiktok.com',player.contentWindow,'onPlayerReady');
assert.equal(context.mediaPlayerState,'player');
assert.equal(timers.size,0);
message('https://www.tiktok.com',player.contentWindow,'onError',1);
message('https://www.tiktok.com',player.contentWindow,'onPlayerError',{errorCode:3002,errorType:'AUTOPLAY_ERROR'});
assert.equal(context.mediaPlayerState,'player','Blocked music autoplay must preserve the ready photo player');
assert.notEqual(player.src,'about:blank');
message('https://www.tiktok.com',player.contentWindow,'onPlayerError',{errorCode:1001,errorType:'INVALID_VIDEO'});
assert.equal(context.mediaPlayerState,'external');
assert.equal(elements['#mediaOverlayPlayer'].src,'about:blank','Errors must unload the broken frame');
assert.equal(elements.label.textContent,'MỞ TRÊN TIKTOK');
context.startMediaPlayback();
assert.equal(elements['#mediaOverlayLink'].clicked,1,'Fallback uses the direct link without opening two tabs');
context.setMediaPlayerState('poster');context.startMediaPlayback();
const pending=elements['#mediaOverlayPlayer'];
message('https://www.tiktok.com',player.contentWindow,'onPlayerReady');
assert.equal(context.mediaPlayerState,'loading','A previous post cannot mark a new iframe ready');
[...timers.values()][0]();
assert.equal(context.mediaPlayerState,'external','No TikTok ready signal must time out to a usable fallback');
assert.equal(pending.src,'about:blank');
context.setMediaPlayerState('poster');context.startMediaPlayback();context.resetMediaPlayer();
assert.equal(timers.size,0,'Closing or switching posts clears the pending timeout');
assert.equal(elements['#mediaOverlayPlayer'].src,'about:blank');
console.log('PASS: no background embeds; one player per click; strict ready/error messages; expired/auth pages time out; stale events ignored; closing unloads playback; direct-link fallback.');
