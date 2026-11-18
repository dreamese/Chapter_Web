const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
let now=0,nextTimer=0,observerCallback;
const timers=new Map(),listeners=new Map(),frames=[];
function element(){return {hidden:false,disabled:false,dataset:{},textContent:'',attrs:{},events:new Map(),classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.events.set(k,f);},removeEventListener(k){this.events.delete(k);}};}
const slots=Array.from({length:8},(_,i)=>{
 const e=element();e.dataset={postId:String(7707139553760414983n+BigInt(i)),title:'Post '+i};
 e.cover=element();e.notice=element();e.label=element();e.notice.hidden=true;
 e.cover.querySelector=()=>e.label;e.querySelector=s=>s==='.blog-cover'?e.cover:e.notice;
 e.append=f=>{f.parent=e;};return e;
});
const rail={querySelectorAll:()=>slots};
const context={console,URL,Date:{now:()=>now},setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,time:now+delay});return nextTimer;},clearTimeout:id=>timers.delete(id),
 document:{hidden:false,addEventListener(k,f){listeners.set('doc:'+k,f);},removeEventListener(k){listeners.delete('doc:'+k);},createElement(){const f=element();f.hidden=true;f.contentWindow={messages:[],postMessage(m){this.messages.push(m);}};f.remove=()=>{f.removed=true;};f.focus=()=>{};frames.push(f);return f;}},
 window:{addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}},
 IntersectionObserver:class{constructor(fn){observerCallback=fn;}observe(){}disconnect(){}}
};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/blog-previews.js'),'utf8'),context);
const controller=context.window.createDreameseBlogPreviews(rail);
function tick(ms){const end=now+ms;let n=0;while(true){const entry=[...timers].filter(([,v])=>v.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];if(!entry)break;assert(++n<1000);now=entry[1].time;timers.delete(entry[0]);entry[1].fn();}now=end;}
function visible(indices){observerCallback(slots.map((target,i)=>({target,isIntersecting:indices.includes(i),intersectionRatio:indices.includes(i)?1:0})));}
function mounted(){return frames.filter(f=>!f.removed);}
function pending(){return mounted().filter(f=>!f.parent.cover.hidden);}
function message(frame,type,origin='https://www.tiktok.com',value){listeners.get('message')({origin,source:frame.contentWindow,data:{'x-tiktok-player':true,type,value}});}
assert.equal(frames.length,0,'No requests while the Blog is outside the viewport');
visible([0,1,2,3,4]);tick(100);assert.equal(pending().length,1);tick(700);assert.equal(pending().length,2);tick(700);assert.equal(pending().length,2,'Never load more than two previews at once');
const first=mounted()[0];message(first,'onPlayerReady','https://www.tiktok.com.evil.example');assert.equal(slots[0].cover.hidden,false,'Ignore spoofed origin');
first.events.get('load')();assert.equal(first.hidden,false);assert.equal(slots[0].cover.hidden,true);
for(let i=0;i<8;i++){pending().forEach(f=>message(f,'onPlayerReady'));tick(700);}
assert.equal(mounted().length,5,'Visible cards get real inline players');
visible([1,2,3,4]);tick(100);visible([0,1,2,3,4]);tick(100);assert(mounted().includes(first),'Do not reload a ready preview when scrolling back');
visible([0,1,2,3,4,5]);tick(700);pending().forEach(f=>message(f,'onPlayerReady'));tick(700);assert.equal(mounted().length,6);
visible([2,3,4,5,6]);tick(700);assert(mounted().length<=6,'Bound the number of retained iframes');assert(first.removed,'Evict an offscreen player before loading another');pending().forEach(f=>message(f,'onPlayerReady'));
const playing=mounted().find(f=>f.parent===slots[2]);message(playing,'onStateChange','https://www.tiktok.com',1);
assert(mounted().filter(f=>f!==playing).every(f=>f.contentWindow.messages.some(m=>m.type==='pause')),'Pause other players when one starts');
visible([7]);tick(700);const failing=pending().find(f=>f.parent===slots[7]);assert(failing);tick(12000);assert(failing.removed,'Failed authentication without a ready event times out');assert(slots[7].notice.textContent.includes('Chạm'));assert.equal(slots[7].cover.hidden,false);
const count=frames.length;tick(1000);assert.equal(frames.length,count,'No automatic retry loop for failed posts');slots[7].cover.events.get('click')();const retry=pending().find(f=>f.parent===slots[7]);assert(retry && retry!==failing,'A deliberate tap can retry');
controller.suspend();assert(retry.removed,'Opening the popup cancels pending inline loads');const suspendedCount=frames.length;tick(30000);assert.equal(frames.length,suspendedCount);controller.resume();tick(100);assert(mounted().length<=6);
controller.destroy();assert.equal(mounted().length,0);assert.equal(timers.size,0);assert(!listeners.has('message'));
console.log('PASS: real visible inline previews; max 2 pending / 6 cached; no viewport churn; stale/spoofed events ignored; timeout and explicit retry; popup suspension; cleanup.');
