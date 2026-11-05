const fs=require('fs'),vm=require('vm'),assert=require('assert');
class E{constructor(){this.children=[];this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.open=false;this.hidden=false;this.disabled=false;this._text='';}set textContent(v){this._text=v;this.children=[];}get textContent(){return this._text;}append(...e){this.children.push(...e);}replaceChildren(...e){this.children=e;}setAttribute(){}addEventListener(){}showModal(){this.open=true;}close(){this.open=false;}scrollIntoView(){}get lastElementChild(){return this.children.at(-1);}}
const els=new Map(),storage=new Map();const doc={querySelector(s){if(!els.has(s))els.set(s,new E);return els.get(s);},querySelectorAll(){return[]},createElement(){return new E},body:new E,addEventListener(){}};
class FakeAudio{constructor(src){this.src=src;this.paused=true;}addEventListener(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
class FakeImage{set src(v){this.onload();}}
const ctx=vm.createContext({Image:FakeImage,Audio:FakeAudio,console,document:doc,window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:false}),setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){},confirm:()=>true});
vm.runInContext(fs.readFileSync('docs/story.js','utf8')+'\n'+fs.readFileSync('docs/leisure.js','utf8')+'\n'+fs.readFileSync('docs/game.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
run('settings.speed=0;newGame()');
function untilDecision(low=false){for(let n=0;n<400;n++){if(run('state.pending')){run('finishJourney()');continue;}if(run('state.block')==='decision')return;if(run('!!current().choices')){let c=doc.querySelector('#choices').children; c[low?c.length-1:0].onclick();}else if(run('!!current().activity')){const type=run('current().activity');let root=doc.querySelector('#activity');if(type==='archive'){if(!low)root.children[0].children.forEach(b=>b.onclick());root.children.at(-1).onclick();}else{const order=run('PUZZLES[current().activity].order');for(const i of order){doc.querySelector('#activity').children[0].children[i].onclick();}doc.querySelector('#activity').children.at(-1).onclick();}}else run('advance()');}throw Error('No decision');}
untilDecision();assert.equal(run('state.clues.length'),7);assert.ok(run('state.trust')>=2);const decision=run('JSON.stringify(state)');
for(let ending=0;ending<3;ending++){run('state='+decision+';render()');const c=doc.querySelector('#choices').children[ending];assert.equal(c.disabled,false);c.onclick();for(let n=0;n<70&&run('view')!=='ending';n++){if(run('state.pending')){run('finishJourney()');continue;}if(run('!!current().activity')){for(const i of run('PUZZLES[current().activity].order'))doc.querySelector('#activity').children[0].children[i].onclick();doc.querySelector('#activity').children.at(-1).onclick();}else run('advance()');}assert.equal(run('view'),'ending');assert.ok(run('saved().state.screen')==='ending');run('loadGame(saved().state)');assert.equal(run('view'),'ending');}
assert.equal(run("rawGet(':endings').length"),3);
run('newGame()');untilDecision(true);assert.equal(doc.querySelector('#choices').children[2].disabled,true);assert.equal(doc.querySelector('#choices').children[0].disabled,false);assert.equal(doc.querySelector('#choices').children[1].disabled,false);
run('newGame();advance();advance()');let before=run('state.line');doc.querySelector('#back-button').onclick();assert.equal(run('state.line'),before-1);run('loadGame(saved().state)');assert.equal(run('state.line'),before-1);
run("state.block='garden_task';state.line=0;render()");doc.querySelector('#activity').children[0].children[2].onclick();assert.equal(run('state.activities.garden||0'),0);assert.ok(doc.querySelector('#activity').children[1].textContent.includes('рыхления'));
console.log('PASS: 3 endings, clue collection, earned ending lock, activities, wrong-order recovery, autosave/reload, rewind');

run("menu();toggleSound();toggleSound()");assert.equal(run('musicTrack'),'menu');
for(const [block,track] of [['arrival','day'],['water','pump'],['loop','night'],['threshold','dungeon']]){run(`state.block='${block}';state.line=0;render()`);assert.equal(run('musicTrack'),track);assert.ok(fs.existsSync('docs/'+run('music.src')));const prev=run('music');run('advance()');assert.equal(run('music'),prev);}
run('toggleSound()');assert.equal(run('music.paused'),true);assert.equal(run("rawGet(':muted')"),true);run('newGame()');assert.equal(run('sound'),false);
run("state.block='firstlook';state.line=2;render()");assert.equal(doc.querySelector('#portrait').hidden,false);
for(const block of run('Object.values(STORY)')){assert.ok(fs.existsSync('docs/assets/'+run(`sceneArt(STORY['${block.id}'])`)+'.webp'));}
run("panel('about')");const about=doc.querySelector('#panel-body').children.map(x=>x.textContent).join(' ');assert.ok(!/концов|эксперимент|лаборатор|развязк/i.test(about));
console.log('PASS: original soundtrack routing, same-track continuity, mute persistence, portraits, all background mappings, spoiler-free about');

// Optional breaks must not advance the story or apply choice rewards early.
run("$('#panel').close();newGame();settings.speed=0;state.block='gate';state.line=8;render();go('firstlook',{trust:2})");
assert.equal(run('state.block'),'gate');assert.equal(run('state.trust'),0);assert.equal(run('state.pending.mode'),'ask');
run('advance()');assert.equal(run('state.block'),'gate');
run("freeTime();careGarden('water')");assert.equal(run('state.karma'),1);assert.equal(run('state.block'),'gate');
run("freeTime();careGarden('water')");assert.equal(run('state.karma'),1);
run("freeTime();careGarden('weed');freeTime();careGarden('soil')");assert.equal(run('state.karma'),3);
run('loadGame(saved().state)');assert.equal(run('state.karma'),3);assert.equal(run('state.pending.mode'),'result');
run('freeTime();waitHere()');assert.equal(run('state.karma'),3);assert.equal(run('state.waits'),1);
run('freeTime();talkHere()');const firstHeard=run('state.heard[0]');run('freeTime();talkHere()');assert.notEqual(run('state.heard[1]'),firstHeard);
run('finishJourney()');assert.equal(run('state.block'),'firstlook');assert.equal(run('state.trust'),2);assert.equal(run('state.karma'),3);assert.equal(run('state.pending'),null);
// Old saves have no leisure fields; migration retains their chapter and clues.
run("const legacy=clone(state);delete legacy.karma;delete legacy.care;delete legacy.heard;delete legacy.pending;loadGame(legacy)");assert.equal(run('state.karma'),0);assert.equal(run('state.block'),'firstlook');
// Hold image requests to exercise blocked input, error/retry and stale callbacks.
const requests=[];ctx.Image=class{set src(v){this.url=v;requests.push(this);}};
run("loadedImages.clear();state.block='water';state.line=0;render()");assert.equal(run('loading'),true);assert.equal(doc.querySelector('#loading-screen').hidden,false);
run('advance()');assert.equal(run('state.line'),0);
requests[0].onerror();assert.equal(doc.querySelector('#loading-retry').hidden,false);
const beforeRetry=requests.length;doc.querySelector('#loading-retry').onclick();requests.slice(beforeRetry).forEach(img=>img.onload());assert.equal(run('loading'),false);assert.equal(doc.querySelector('#loading-screen').hidden,true);
run("loadedImages.clear();state.block='archive_road';state.line=0;render()");run('menu()');requests.forEach(img=>img.onload());assert.equal(run('view'),'title');assert.equal(run('loading'),false);
ctx.Image=FakeImage;
console.log('PASS: transition confirmation, delayed choice rewards, care karma limits, saved interludes, nonrepeating talks, old saves, loading errors/retry/cancellation');
