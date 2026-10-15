'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
for(const name of ['etos-layer-guard.js','etos-living-motion.js'])new vm.Script(read(name),{filename:name});
const pages=['index.html','readmap.html','gagasan.html','profil-awardee.html'];
for(const path of pages){
 const s=read(path);
 for(const asset of ['etos-layer-guard.js','etos-layer-guard.css','etos-living-motion.js','etos-living-motion.css']){
  assert(s.includes('/'+asset+'?v='+(asset==='etos-living-motion.css'?'2':'1')),path+' must load '+asset);
 }
}
const admin=read('readmap-admin.html');
assert(admin.includes('etos-layer-guard.js?v=1'),'Admin forms need scroll isolation');
assert(admin.includes('etos-layer-guard.css?v=1'),'Admin scroll CSS missing');
const lock=read('etos-layer-guard.js'),motion=read('etos-living-motion.js'),css=read('etos-living-motion.css');
for(const selector of ['.modal.open','.drawer.open','.service-dialog:not([hidden])','.login-panel:not([hidden])'])assert(lock.includes(selector),'Missing overlay '+selector);
assert(lock.includes('position='),"Body scroll preservation missing");
assert(lock.includes("window.scrollTo(0,scrollY)"),'Background position must restore');
assert(lock.includes("e.preventDefault()"),'Background wheel/touch must be prevented');
assert(lock.includes('newlyOpened'),'Stacked dialogs must respect activation order');
assert(lock.includes("if(e.key!=='Tab')return"),'Keyboard focus loop missing');
assert(motion.includes('prefers-reduced-motion: reduce'),'Motion accessibility missing');
assert(motion.includes("pointerType!=='mouse'"),'Touch cursor should be disabled');
assert(motion.includes('etos-layer-locked'),'Cursor must disappear during form entry');
assert(motion.includes('requestAnimationFrame(frame)'),'Follower must be smoothly animated');
assert(motion.includes('--etos-pointer-x'),'Blue card fill must originate at pointer');
assert(!css.includes('clip-path:circle('),'Oversized circular hover fill must be removed');
assert(css.includes('opacity:1'),'Blue hover transition must remain');
assert(css.includes('prefers-reduced-motion'),'CSS reduced motion unsupported');
assert(css.includes('#main-app .hero::before,#main-app .hero::after'),'All dashboard hero rings must be disabled');
assert(css.includes('.readmap-app .hero::before,.readmap-app .hero::after'),'READMAP hero rings must be disabled');
assert(css.includes('.editorial-feed .featured-card::before,.editorial-feed .article-card::before'),'Gagasan article light circles must be disabled');
assert(css.includes('.etos-cursor-orbit{display:none!important}'),'Cursor circle must be removed globally');
assert(!css.includes('radial-gradient('),'Giant circular light halo must be removed on all pages');
assert(css.includes('body[data-etos-surface="readmap"]'),'READMAP background must be solid');
assert(!read('index.html').includes('width:420px;height:420px;border:1px'),'Initial loading page oversized circles must be removed');
assert(css.includes('[data-etos-motion-mode="glow"]'),'Statistics need soft blue glow');
assert(css.includes('[data-etos-motion-mode="fill"]'),'Navigation cards need blue fill');
assert(!read('vercel.json').includes('gagasan-etos-palu.vercel.app'),'Do not reintroduce second Vercel project');
/* Behavioral test using a minimal browser DOM model. No real user data or network. */
const handlers={};let pending=[],nextId=0,scrollReturn=null;
class FakeElement{
 constructor(id){this.id=id;this.style={};this.open=false;this.isConnected=true;this.attrs={};this.classList={add:()=>{},remove:()=>{}};this.children=[]}
 closest(selector){if(selector.includes('[hidden]'))return null;if(selector.includes('.modal-card'))return this.id==='field'?'container':null;return null}
 matches(s){return this.id==='modal'||this.id==='drawer'}
 getClientRects(){return this.open?[{}]:[]}
 querySelectorAll(){return this.children}
 contains(el){return this===el||this.children.includes(el)}
 focus(){document.activeElement=this}
 hasAttribute(k){return k in this.attrs}
 setAttribute(k,v){this.attrs[k]=v}
}
const body=new FakeElement('body'),html=new FakeElement('html'),opener=new FakeElement('opener');
const modal=new FakeElement('modal'),drawer=new FakeElement('drawer');
const modalInput=new FakeElement('modalInput'),drawerInput=new FakeElement('drawerInput');
modal.children=[modalInput];drawer.children=[drawerInput];
const document={
 body,documentElement:html,activeElement:opener,readyState:'complete',
 querySelectorAll:()=>[modal,drawer].filter(el=>el.open),
 addEventListener:(name,cb)=>(handlers[name]??=[]).push(cb)
};
const window={scrollY:384,scrollTo:(x,y)=>{scrollReturn=[x,y]},addEventListener:()=>{}};
let observer;
class MutationObserver{constructor(callback){observer=callback}observe(){}}
const requestAnimationFrame=fn=>{pending.push(fn);return ++nextId};
const flush=()=>{const q=pending;pending=[];q.forEach(fn=>fn())};
const sandbox={window,document,HTMLElement:FakeElement,MutationObserver,requestAnimationFrame,getComputedStyle:el=>({display:el.open?'flex':'none',visibility:'visible'})};
vm.runInNewContext(lock,sandbox,{filename:'etos-layer-guard.js'});
flush();
assert.equal(window.ETOSLayerGuard.locked,false,'Initially unlocked');
modal.open=true;window.ETOSLayerGuard.refresh();flush();
assert.equal(window.ETOSLayerGuard.locked,true,'Modal must lock background');
assert.equal(body.style.position,'fixed','Mobile scroll fix missing');
assert.equal(body.style.top,'-384px','Scroll offset not preserved');
const wheel={target:opener,preventDefault(){this.prevented=true}};
for(const fn of handlers.wheel||[])fn(wheel);
assert.equal(wheel.prevented,true,'Wheel on background must be blocked');
drawer.open=true;window.ETOSLayerGuard.refresh();flush();
assert.equal(window.ETOSLayerGuard.count,2,'Stacked dialogs not handled');
modal.open=false;window.ETOSLayerGuard.refresh();flush();
assert.equal(window.ETOSLayerGuard.locked,true,'Closing one of two dialogs must stay locked');
drawer.open=false;window.ETOSLayerGuard.refresh();flush();
assert.equal(window.ETOSLayerGuard.locked,false,'Last close must unlock');
assert.deepEqual(scrollReturn,[0,384],'Scroll position must restore precisely');
assert.equal(body.style.position,undefined,'Original inline body style must restore');
console.log('ETOS MOTION + MODAL ISOLATION: static contracts and 2-layer scroll behavior PASS');