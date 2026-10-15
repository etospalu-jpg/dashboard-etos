// Integration smoke: SKI route must render only after PIN authentication.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const el=()=>({style:{},hidden:false,dataset:{},textContent:'',innerHTML:'',
 classList:{add(){},remove(){},toggle(){},contains(){return false;}},
 setAttribute(){},removeAttribute(){},querySelector(){return null;}});
const root=el(),sidebar=el(),body=el(),nav={...el(),dataset:{view:'ski'}};
const elements={'view-ski':root,sidebar,'page-title':el(),'ski-nav':nav};
let loginPrompt=0,loads=0;
const ctx={console,setTimeout(){},clearTimeout(){},
 document:{body,activeElement:null,addEventListener(){},
  getElementById(name){return elements[name]||null},
  querySelectorAll(sel){if(sel==='.view')return[root];if(sel==='.nav-btn'||sel==='.nav-btn[data-view]')return[nav];return[]},
  querySelector(){return null}},
 innerWidth:1280,addEventListener(){},openPinAccess(){loginPrompt++},toast(){},
 loadSki(){loads++;root.innerHTML='PRIVATE SKI CONTENT READY'}};
ctx.window=ctx;
const context=vm.createContext(ctx);
for(const name of ['app-core.js','app-interaction-fix.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context,{filename:name});
const run=async code=>vm.runInContext(code,context);
(async()=>{
 await run("window.goView('ski')");
 assert.equal(loads,0,'Public must not load SKI');
 assert.equal(vm.runInContext('state.view',context),'dashboard','Public must not enter blank SKI');
 assert.equal(loginPrompt,1,'Public must be prompted to authenticate');
 await run("state.auth=true;state.session={kind:'user',role:'superadmin'};state.role='superadmin';window.goView('ski')");
 assert.equal(loads,0,'An account superadmin is not authorized for this PIN-only workspace');
 await run("state.auth=true;state.session={kind:'pin',role:'superadmin'};state.role='superadmin';window.goView('ski')");
 assert.equal(loads,1,'PIN session must load native SKI content');
 assert.equal(root.innerHTML,'PRIVATE SKI CONTENT READY');
 assert.equal(vm.runInContext('state.view',context),'ski');
 await run("state.auth=false;state.session={kind:'pin',role:'superadmin'};window.goView('ski')");
 assert.equal(loads,1,'Stale PIN session without authenticated state must be denied');
 console.log('ETOS SKI NAVIGATION: PUBLIC DENIED, ACCOUNT DENIED, PIN RENDERS: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});