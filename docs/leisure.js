'use strict';
// Scene loading and optional life between story locations.
let loading=false,loadTicket=0,activeScene='',loadTimer=null;
const loadedImages=new Set();
function cancelLoading(){loadTicket++;loading=false;clearTimeout(loadTimer);$('#loading-screen').hidden=true;}
function loadScene(block,done){
 const scene=sceneArt(block),names=[scene,...new Set(block.rows.map(r=>PEOPLE[r.who]?.art).filter(Boolean))];
 const pending=names.filter(n=>!loadedImages.has(n));
 if(!pending.length&&activeScene===scene){done();return;}
 const ticket=++loadTicket;loading=true;halt();$('#loading-screen').hidden=false;
 $('#loading-title').textContent=block.place;$('#loading-status').textContent='Подготавливаем локацию и жителей…';
 $('#loading-retry').hidden=true;$('#loading-progress').value=0;$('#loading-progress').max=Math.max(1,pending.length);
 let remaining=pending.length,failed=false;
 const complete=()=>{if(ticket!==loadTicket||failed)return;clearTimeout(loadTimer);activeScene=scene;loading=false;$('#loading-screen').hidden=true;done();};
 const fail=()=>{if(ticket!==loadTicket||failed)return;failed=true;clearTimeout(loadTimer);$('#loading-status').textContent='Не удалось загрузить иллюстрацию. Проверь соединение и попробуй ещё раз.';$('#loading-retry').hidden=false;$('#loading-retry').onclick=()=>loadScene(block,done);};
 if(!remaining){complete();return;}
 loadTimer=setTimeout(fail,20000);
 for(const name of pending){const img=new Image();img.onload=()=>{if(ticket!==loadTicket||failed)return;loadedImages.add(name);remaining--;$('#loading-progress').value=pending.length-remaining;if(!remaining)complete();};img.onerror=fail;img.src=asset(name);}
}
function normalizeLeisure(s){
 s.karma=Number.isFinite(s.karma)?Math.max(0,s.karma):0;
 s.care=Array.isArray(s.care)?s.care:[];s.heard=Array.isArray(s.heard)?s.heard:[];
 s.waits=Number.isInteger(s.waits)?s.waits:0;
 if(!s.pending||!STORY[s.pending.id])s.pending=null;
 return s;
}
function isJourney(id){const a=STORY[state.block],b=STORY[id];return a.bg!==b.bg||a.ch!==b.ch;}
function requestJourney(id,extra){
 halt();auto=false;$('#auto-button').setAttribute('aria-pressed','false');
 state.pending={id,extra:clone(extra),mode:'ask'};renderInterlude();persist();
}
function finishJourney(){if(loading||!state.pending)return;const {id,extra}=state.pending;state.pending=null;moveTo(id,extra);}
function leisureChoice(label,action){const b=el('button',label,'choice');b.onclick=action;$('#choices').append(b);return b;}
function interludeText(who,text){
 halt();$('#speaker').textContent=who;$('#speaker-role').textContent='';$('#line-count').textContent='КАРМА '+state.karma;
 fullText=text;$('#dialogue-text').textContent=text;$('#next-button').hidden=true;$('#scene-hint').textContent='История подождёт твоего решения';
 $('#choices').replaceChildren();$('#activity').replaceChildren();$('#chapter-card').classList.remove('visible');
 $('#portrait').hidden=true;const person=PEOPLE[who];if(person?.art){$('#portrait').hidden=false;$('#portrait-image').src=asset(person.art);$('#portrait-image').alt=who;}
 $('#karma-count').textContent=state.karma;
}
function freeTime(){state.pending.mode='free';state.pending.result=null;renderInterlude();persist();}
function renderInterlude(){
 const p=state.pending;if(!p)return;const here=STORY[state.block];
 if(p.mode==='result'){
  interludeText(p.result.who,p.result.text);leisureChoice('Ещё немного побыть здесь',freeTime);leisureChoice('Теперь идти дальше →',finishJourney);return;
 }
 if(p.mode==='care'){
  interludeText('Вася','У огорода тоже есть планы на меня. С чего начнём?');
  for(const [key,label] of [['water','Полить овощи'],['weed','Убрать сорняки'],['soil','Разрыхлить землю']]){const used=state.care.includes(here.ch+':'+key);const b=leisureChoice(label+(used?' · уже сделано':' · +1 к карме'),()=>careGarden(key));b.disabled=used;}
  leisureChoice('Вернуться к своим делам',freeTime);return;
 }
 if(p.mode==='ask'){
  interludeText('Вася','Пора двигаться дальше. Я готов или ещё немного задержусь здесь?');
  leisureChoice('Да, идти дальше →',finishJourney);leisureChoice('Пока отступить и остаться',freeTime);return;
 }
 interludeText('Вася','Можно немного выдохнуть. Дела никуда не денутся — а вот хороший разговор легко пропустить.');
 leisureChoice('Продолжить путь →',finishJourney);
 leisureChoice('Подождать и осмотреться',waitHere);
 const garden=['home','farm','garden','greenhouse','office'].includes(here.bg);
 if(garden)leisureChoice('Поухаживать за огородом',()=>{p.mode='care';renderInterlude();persist();});
 if(here.ch<5||here.bg==='office'||here.bg==='farm'||here.bg==='garden')leisureChoice('Поговорить с жителями',talkHere);
 leisureChoice('Вернуться к последней реплике',()=>{state.pending=null;render();});
}
function leisureResult(who,text){
 state.pending.mode='result';state.pending.result={who,text};state.log.push({who,text});if(state.log.length>350)state.log.shift();renderInterlude();persist();
}
function careGarden(key){
 const stamp=STORY[state.block].ch+':'+key;if(state.care.includes(stamp)){renderInterlude();return;}
 const lines={water:'Я полил грядки под корень. Земля потемнела, листья перестали изображать трагедию. Иногда помощь выглядит как обычная лейка.',weed:'Я выдернул сорняки и отнёс их в компост. Морковь получила пространство, а я — редкое чувство, что разобрался хотя бы с одной проблемой.',soil:'Я осторожно разрыхлил землю между рядами. На экране это была бы одна кнопка. В жизни — десять минут и весьма убедительная поясница.'};
 state.care.push(stamp);state.karma++;leisureResult('Вася',lines[key]+'\n\nКарма +1. Теперь: '+state.karma+'.');
}
function waitHere(){
 const b=STORY[state.block];state.waits++;
 const quiet=b.ch>=5||['stairs','underground','archive'].includes(b.bg);
 const lines=quiet?['Я остановился и прислушался. За стеной ровно гудели трубы. Пауза помогла собраться с мыслями.','Я проверил карманы и ещё раз вспомнил, куда собирался. Иногда полезно просто не торопиться.']:['Я сел на скамейку. В траве стрекотали кузнечики. Впервые за день от меня никто ничего не требовал. Даже кабачок.','По дорожке прошёл кот с видом председателя ревизионной комиссии. Участок он не одобрил, но лёг именно здесь.','Ветер зашевелил листья. Я решил ещё минуту ничего не улучшать. Удивительно, но мир справился.'];
 leisureResult('Вася',lines[(state.waits-1)%lines.length]);
}
const SMALL_TALK=[
 ['Нюра','У нас кабачки не продают. Их передают. Иногда — против воли получателя.'],
 ['Гриша','Купил вторую перчатку. Теперь не знаю, какая из них рабочая.'],
 ['Варвара','Поливай землю под корнем. Листья красивые, но воду корням за них никто не передаст.'],
 ['Егор','Объявил сорнякам войну. Они пока побеждают числом и отсутствием выходных.'],
 ['Зина','В моём списке дел есть пункт «отдохнуть». Я переношу его уже третий сезон. Очень надёжный пункт.'],
 ['Петрович','Короткая дорога — это когда потом долго объясняешь, где был.'],
 ['Семён','Я посчитал урожай заранее. Теперь у моркови план, и я вижу, что ей это не нравится.'],
 ['Тамара','Выиграла в лотерею лейку. Муж говорит: судьба опять назначила меня поливать.'],
 ['Акакий','Долг за семена можно вернуть урожаем. Только кабачками нельзя. Кабачками у меня уже вернули гараж.'],
 ['Клавдия','В архиве всё подписано. Кроме коробки «разное». В ней, как ты понимаешь, самое важное.'],
 ['Фома','Что растёт без полива, удобрений и солнца? Список дел на даче.'],
 ['Иннокентий','Соревнование по прополке отменили: победитель случайно обработал участок судьи. Теперь он требует пересмотра результатов.'],
 ['Геннадий','Лучший помидор — тот, который ты вырастил сам. Второе место занимает тот, которым поделился сосед.'],
 ['Варвара','Ботва моркови съедобна. Только сперва убедись, что это именно морковь, и хорошо её вымой.'],
 ['Нюра','Хороший сосед отличается от плохого тем, что возвращает ведро. Отличный — возвращает с яблоками.']
];
function talkHere(){
 let pool=SMALL_TALK.map((_,i)=>i).filter(i=>!state.heard.includes(i));if(!pool.length){state.heard=[];pool=SMALL_TALK.map((_,i)=>i);}
 const i=pool[Math.floor(Math.random()*pool.length)];state.heard.push(i);const [who,text]=SMALL_TALK[i];
 // Preload the visitor before showing their optional portrait.
 loadScene({...STORY[state.block],rows:[{who}]},()=>leisureResult(who,text));
}
