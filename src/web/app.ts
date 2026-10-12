import { Conversation } from '../shared/controller.js';
import { APP_VERSION, SCHEMA_VERSION, type Provider, type ProviderStatus, type RequestData, type Result } from '../shared/contracts.js';
import { TimerLedger, type TimerListEntry } from '../shared/openui/timer-store.js';
import { activityClientEvents, timerTransitionEvent } from '../shared/openui/activity-client-events.js';
import { createRunNav } from '../shared/openui/run-nav.js';
import { splitReply } from '../shared/openui/document.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import { redactValue } from '../shared/redact.js';
import { renderComponent, type SessionTally } from './components.js';
import { button,byId,el,svg } from './dom.js';

type Config={providers:ProviderStatus[];token:string};let config:Config|undefined;
// A local guard (on a break, provider not ready) is not a failed turn: it gets its own line and no Try again.
let guard='';
// Aira's spoken line follows the moment: the Cue on arrival, then the move's Beats as the clock starts, passes half time
// and ends, or a nudge once the coach has gone quiet. A Cue the model rewrites is spoken as soon as it arrives.
const QUIET_MS=20000;let spoken={key:'',phase:'',cue:'',line:''},landedOn='',landedAt=Date.now();
const timers=new TimerLedger();let previousTimers=new Map<string,TimerListEntry>(),updates:(()=>void)[]=[],paused=false,pausedTimers:string[]=[],renderKey='',lastClear=0;
// Per-timer record that outlives a turn's client_events, so a later summary still knows how each move went.
const history=new Map<string,{fast:boolean;pauses:number}>();
const draft=byId<HTMLTextAreaElement>('message');
// "Aira says" (avatar + spoken line) is placed under the screen's title on every render, so it is seen without scrolling.
const says=document.querySelector<HTMLElement>('.spoken')!,spokenText=byId('spoken'),avatar=byId('pip');let hadScreens=false;
function placeSays(surface:HTMLElement){const anchor=surface.querySelector('.welcome .role')??surface.querySelector('h3');if(anchor)anchor.after(says);else surface.prepend(says);}
const c=new Conversation(async(request:RequestData,signal:AbortSignal):Promise<Result>=>{
  const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,request.provider==='claude-cli'?85000:48000);
  try{const response=await fetch('/api/turn',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':config!.token},body:JSON.stringify(request),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error??'Request failed.');return data;}
  catch(error){if(error instanceof Error && error.name==='AbortError')throw new Error('Request cancelled or timed out. Retry when ready.');throw error;}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
},render,()=>[...(paused?['Preview is currently paused.']:[]),...timers.list().map(timerLine)]);
function timerLine(t:TimerListEntry){const h=history.get(t.id),how=t.status==='done'?(h?.fast?' (finished early)':' (ran its full time)'):'',breaks=h?.pauses?`, paused ${h.pauses} time${h.pauses===1?'':'s'}`:'';return `Simulated timer ${t.id} (${t.label}): ${t.status}${how}${breaks}, ${Math.ceil(t.remaining)} of ${t.seconds} seconds remaining.`;}
function makeNav(){return createRunNav({index:()=>c.document.screens.findIndex(s=>s.key===c.document.cursor),stepCount:()=>c.document.screens.length,isConsumed:()=>false,awaiting:()=>false,leave:()=>{if(c.pending)c.cancel('interrupted');},land:(from,to)=>{c.document.move(to);c.localEvent(to<from?activityClientEvents.wentBack(`step ${from+1}`,`step ${to+1} (screen ${c.document.screens[to]?.key})`):activityClientEvents.nowOnStep(`step ${to+1} of ${c.document.screens.length} (screen ${c.document.screens[to]?.key})`));},phase:()=>{},finish:()=>{c.localEvent('Reached the final screen. This is not evidence of physical completion.');const next=finalAction();if(next)send(next);}},{outMs:30,inMs:30});}
let nav=makeNav();
const childrenOf=(screen?:StatementNode)=>(screen?.props.children as StatementNode[]|undefined)??[];
// On the last screen the primary button sends that screen's first FollowUp, so Finish is never a dead end.
function finalAction(){const follow=childrenOf(c.document.current).find(n=>n.name==='FollowUps');return (follow?.props.prompts as string[]|undefined)?.[0];}
// A tapped FollowUp records which screen it was tapped on, so the reply acts on that screen.
function tap(text:string){send(text,true);}
function send(text:string,tapped=false){if(!config)return;guard='';landedAt=Date.now();const provider=config.providers.find(p=>p.id===c.provider)!;if(!provider.enabled||(c.provider!=='mock'&&!c.consent)){guard='This runtime is not set up yet. Agree to usage, or select Mock.';render();return;}if(paused){guard="You're on a break. Tap I'm back first.";render();return;}if(tapped)c.localEvent(`Tapped "${text}" on screen ${c.document.cursor}.`,false);const f=byId<HTMLSelectElement>('fault');const fault=f.value as RequestData['fault'];f.value='none';void c.send(text,fault);}
function syncTimers(){
  if(lastClear!==c.document.clearVersion){nav.dispose();nav=makeNav();timers.forget();previousTimers.clear();history.clear();lastClear=c.document.clearVersion;}
  const ids=new Set<string>();for(const s of c.document.screens)for(const node of childrenOf(s))if(node.name==='Timer'){ids.add(node.key);timers.ensure(node.key,{label:String(node.props.label),seconds:Number(node.props.seconds)});}
  for(const t of timers.list())if(!ids.has(t.id)){timers.forget(t.id);previousTimers.delete(t.id);history.delete(t.id);}
}
// Moves are the timed screens. A move is done when its timer finished, skipped when the reader moved past it without finishing.
// Marks are positional, so the bar shows which move was skipped and where the reader is.
function session():SessionTally{const screens=c.document.screens,index=screens.findIndex(s=>s.key===c.document.cursor),list=timers.list(),marks:string[]=[];let done=0,skipped=0,current=0,seconds=0,first=-1;
  screens.forEach((s,i)=>{for(const node of childrenOf(s))if(node.name==='Timer'){if(first<0)first=i;seconds+=Number(node.props.seconds);const status=list.find(t=>t.id===node.key)?.status;let mark='';
    if(status==='done'){done++;mark='done';}else if(i<index&&status!=='running'){skipped++;mark='skipped';}
    if(i===index){current=marks.length+1;mark=(mark+' current').trim();}marks.push(mark);}});
  return {done,skipped,total:marks.length,current,seconds,started:first>=0&&(index>first||done>0),marks};}
function titleOf(screen?:StatementNode){const kids=childrenOf(screen),node=kids.find(n=>n.name==='Text'&&n.props.variant==='title')??kids.find(n=>n.name==='Timer');const text=String(node?.props.text??node?.props.label??'');return text.length>28?text.slice(0,27)+'…':text;}
// One filled action at a time: Next is the main button when there is no clock to run, or once it has finished.
function syncNav(){const screens=c.document.screens,index=screens.findIndex(s=>s.key===c.document.cursor),last=index===screens.length-1,next=byId<HTMLButtonElement>('next');
  const timer=childrenOf(c.document.current).find(n=>n.name==='Timer'),status=timer?timers.list().find(t=>t.id===timer.key)?.status:undefined,title=titleOf(screens[index+1]);
  const label=last?`${finalAction()??'Finish'} →`:title?`Next: ${title} →`:'Next →';if(next.textContent!==label)next.textContent=label;next.classList.toggle('primary',!timer||status==='done'||last);}
function tick(){const snapshot=timers.list();for(const entry of snapshot){const before=previousTimers.get(entry.id);previousTimers.set(entry.id,{...entry});if(before && before.status!=='done'&&entry.status==='done')c.localEvent(activityClientEvents.finishedTimer(entry.label),false);}updates.forEach(fn=>fn());if(c.document.screens.length)syncNav();syncSpoken();syncGuide();}
// Aira, drawn once by trusted code: a hand-drawn blob whose mood follows the moment. CSS animates it; nothing is model-generated.
function drawPip(){const path=(d:string,cls='')=>svg('path',cls?{d,class:cls}:{d});const s=svg('svg',{viewBox:'0 0 56 56'});
  s.append(path('M20 50 L19 54'),path('M36 50 L37 54'),path('M8 31 L2 27','arm'),path('M48 31 L54 27','arm'),path('M28 6 C40 5 50 14 50 28 C51 41 41 50 28 50 C15 51 6 41 6 28 C5 15 16 7 28 6 Z','body'),path('M28 6 Q26 1 31 2'),
    svg('ellipse',{cx:'21',cy:'25',rx:'2.6',ry:'3.4',class:'eye'}),svg('ellipse',{cx:'35',cy:'25',rx:'2.6',ry:'3.4',class:'eye'}),path('M21 34 Q28 40 35 34','smile'),path('M23 36 L33 36','flat'),
    svg('polygon',{points:'48,0 49.5,3.5 53,4 50.5,6.5 51,10 48,8 45,10 45.5,6.5 43,4 46.5,3.5',class:'star'}));avatar.append(s);}
function syncPip(){const timer=childrenOf(c.document.current).find(n=>n.name==='Timer'),status=timer?timers.list().find(t=>t.id===timer.key)?.status:undefined;
  const mood=c.pending?'thinking':c.error?'oops':paused||status==='paused'?'resting':status==='running'?'moving':status==='done'?'done':'idle';if(avatar.dataset.mood!==mood)avatar.dataset.mood=mood;}
function syncSpoken(){syncPip();const screen=c.document.current,kids=childrenOf(screen),cue=kids.filter(n=>n.name==='Cue').map(n=>String(n.props.text)).join(' ');
  if(!screen){spoken={key:'',phase:'',cue:'',line:''};spokenText.textContent=c.document.prose||"Psst. Pick one and I'll start stretching.";return;}
  if(screen.key!==landedOn){landedOn=screen.key;landedAt=Date.now();}
  const beats=kids.find(n=>n.name==='Beats')?.props,timer=kids.find(n=>n.name==='Timer'),entry=timer?timers.list().find(t=>t.id===timer.key):undefined;
  const phase=!beats||!entry?'':entry.status==='done'?'done':entry.status==='stopped'?(!paused&&entry.remaining>=entry.seconds&&Date.now()-landedAt>=QUIET_MS?'waiting':''):entry.remaining<=entry.seconds/2?'halfway':'going';
  const beat=phase&&typeof beats?.[phase]==='string'?String(beats[phase]):'';
  // A phase without a line keeps the last thing Aira said; a missing or dropped Beats leaves the Cue.
  const line=screen.key!==spoken.key?beat||cue:phase!==spoken.phase?beat||(phase?spoken.line:cue)||cue:cue!==spoken.cue?cue:spoken.line;
  spoken={key:screen.key,phase,cue,line};const text=line||c.document.prose||'';if(spokenText.textContent!==text)spokenText.textContent=text;}
function timerAction(id:string,action:'start'|'pause'|'reset'|'finish'){
  const before=timers.list().find(t=>t.id===id);if(!before||paused)return;landedAt=Date.now();
  if(action==='start')timers.start(id);if(action==='pause')timers.pause(id);if(action==='reset')timers.reset(id);if(action==='finish')timers.finish(id);
  const after=timers.list().find(t=>t.id===id)!;previousTimers.set(id,{...after});
  const early=action==='finish'&&before.status!=='done'&&before.remaining>=1,h=history.get(id)??{fast:false,pauses:0};
  if(action==='reset'||(action==='start'&&before.status==='done'))history.delete(id);else{if(early)h.fast=true;if(action==='pause'&&before.status==='running')h.pauses++;history.set(id,h);}
  const event=action==='reset'?activityClientEvents.resetTimer(after.label,after.seconds):action==='start'&&before.status==='stopped'?activityClientEvents.startedTimer(after.label,after.seconds):early?activityClientEvents.finishedEarly(after.label,before.remaining):timerTransitionEvent(before,after);
  // Timer taps keep the reader on the same screen, so a pending coach reply stays valid; navigation still interrupts.
  c.localEvent(event??`Simulated ${action} for ${after.label}.`,false);tick();
}
// Before the first message: Aira says who she is and flips the roles in one line, with one-tap starts.
function welcome(){const n=el('div','','empty welcome');n.append(el('p','MEET AIRA','eyebrow'),el('h3',"Hi, I'm Aira."),el('p',"I do the moves, you're my coach and run the clock.",'role'),el('p',"I'm a tiny cartoon in training. Pick a session, or tell me how long you've got.",'micro'));
  const row=el('div','','row follow');["I'm new, go easy","I've got 5 minutes",'Give me a challenge'].forEach((text,i)=>row.append(button(text,()=>send(text),i===0?'primary':'chip')));n.append(row);return n;}
function render(){
  if(config){const selected=config.providers.find(p=>p.id===c.provider)!;byId('mode').textContent=c.provider==='mock'?'MOCK · NO MODEL CALLS':selected.enabled?'LIVE WHEN SENT':'SETUP / BLOCKED';byId('provider-description').textContent=selected.message;byId('consent-wrap').hidden=c.provider==='mock'||!selected.enabled;byId('consent-label').textContent=c.provider==='claude-cli'?'Use my subscription quota on Send/Retry; I reviewed the host-policy limits.':'Use my API budget on Send/Retry.';byId<HTMLInputElement>('consent').checked=c.consent;byId<HTMLButtonElement>('send').disabled=!selected.enabled||(c.provider!=='mock'&&!c.consent)||paused;byId('mock-controls').hidden=c.provider!=='mock';byId('sample').hidden=c.provider!=='mock';}
  byId('send').textContent=c.pending?'Send update ↗':'Send ↗';syncSend();byId<HTMLButtonElement>('cancel').disabled=!c.pending;byId('pending').hidden=!c.pending;byId('status').textContent=c.pending?'Aira is thinking…':c.error?'Aira missed that one':'Ready when you are';
  // A failed turn never breaks the workout: the screen, timers and Next keep working. The technical reason stays visible for builders.
  const failed=Boolean(c.error)&&!c.pending,slow=/timed out|cancelled/i.test(c.error);byId('error').hidden=!failed&&!guard;
  byId('error-friendly').textContent=failed?`${slow?'Aira took too long to answer.':'Aira lost the thread for a second.'} Your place is kept: keep going, or try again.`:guard;byId('error-message').textContent=failed?c.error:'';byId('retry').hidden=!failed;
  // The chat shows what was said. Client events stay in Builder tools and exports, where they are model context.
  const transcript=byId('transcript');transcript.replaceChildren();if(!c.events.some(e=>e.kind==='input'))transcript.append(el('p','Say hi to Aira, or pick a session.','micro'));
  for(const event of c.events){if(event.kind==='input'||event.kind==='response'){const n=el('div','','message '+(event.kind==='input'?'user':'assistant'));n.append(el('span',event.kind==='input'?'You':'Aira','who'),el('p',event.text??splitReply(event.result!.turn.reply).prose??''));transcript.append(n);}else if(event.kind==='interrupted')transcript.append(el('p',"Aira's reply was cut short when you moved on.",'event'));else if(event.kind==='cancelled')transcript.append(el('p','Reply cancelled.','event'));}
  transcript.scrollTop=transcript.scrollHeight;syncTimers();
  const screens=c.document.screens,index=screens.findIndex(s=>s.key===c.document.cursor),key=c.document.echo()+String(paused);
  if(key!==renderKey || !byId('screen').childNodes.length){renderKey=key;updates=[];const surface=byId('screen');surface.replaceChildren();const current=c.document.current;
    if(!current)surface.append(welcome());
    else{const primaryPrompt=index===screens.length-1?finalAction():undefined;for(const node of childrenOf(current))if(node.name!=='Cue'&&node.name!=='Beats')surface.append(renderComponent(node,{send:tap,timers,timerAction,updates,paused,session,primaryPrompt}));}
    placeSays(surface);
    const progress=byId('progress');progress.replaceChildren();if(screens.length>1)for(let i=0;i<screens.length;i++){const n=el('span','',''+(i===index?'active':i<index?'past':''));n.setAttribute('aria-label',`Screen ${i+1}${i===index?', current':''}`);progress.append(n);}
  }
  if(screens.length&&!hadScreens)document.querySelector(innerWidth<=760?'.preview':'.workspace')?.scrollIntoView({behavior:'smooth',block:'start'});hadScreens=screens.length>0;
  // One progress indicator: a screen that carries Progress hides the stepper strip and the step count.
  const ownProgress=childrenOf(c.document.current).some(n=>n.name==='Progress');byId('progress').hidden=ownProgress;byId('position').hidden=ownProgress;
  byId('navigation').hidden=screens.length<2;byId('position').textContent=`${index+1} / ${screens.length}`;byId<HTMLButtonElement>('back').disabled=paused||index<=0;byId<HTMLButtonElement>('next').disabled=paused;if(screens.length)syncNav();
  byId<HTMLButtonElement>('pause').disabled=!screens.length;byId('pause').textContent=paused?"I'm back":'Take a break';byId('paused').hidden=!paused;
  syncSpoken();syncGuide();
  byId('state-json').textContent=JSON.stringify({ui_state:c.document.echo(),client_events:c.clientEvents,timers:timers.list()},null,2);byId<HTMLButtonElement>('export').disabled=c.pending||!c.events.length;
}
// ── First-visit tour and guided tips: trusted copy, one bubble at a time, remembered in localStorage (best effort). ──
const store={get:(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k:string,v:string|null)=>{try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{/* storage blocked: the tour and tips simply show again */}}};
const TOUR:[()=>HTMLElement,string][]=[[()=>document.querySelector<HTMLElement>('.conversation')!,'Chat with Aira here. Tell her how much time you have.'],[()=>document.querySelector<HTMLElement>('.preview')!,'This is your workout. Aira does the moves, you run her clock.'],[()=>says,'Aira reacts here as you go.']];
type Hint={id:string;target:HTMLElement;text:string;side?:'right'};
let tourStep=store.get('aira-tour-seen')?-1:0,guideKey='',activeHint:Hint|undefined;
const guide=el('div','','guide'),guideArrow=el('span','','guide-arrow'),guideText=el('p','','guide-text'),guideRow=el('div','','guide-row');guide.hidden=true;guide.setAttribute('role','status');guide.append(guideArrow,guideText,guideRow);document.body.append(guide);
const hintsDone=()=>new Set((store.get('aira-tips-done')??'').split(',').filter(Boolean));
function markHint(id:string){const done=hintsDone();done.add(id);store.set('aira-tips-done',[...done].join(','));}
function showStep(step:number){tourStep=step;if(step<0)store.set('aira-tour-seen','1');else TOUR[step][0]().scrollIntoView({behavior:'smooth',block:'center'});guideKey='';syncGuide();}
// The one press a first-timer needs next. Each tip shows until its button is pressed, then never again.
function nextHint():Hint|undefined{
  if(c.pending||paused||store.get('aira-tips-off')==='1')return;const done=hintsDone(),screens=c.document.screens,current=c.document.current;
  if(!current){const start=document.querySelector<HTMLElement>('#screen .welcome button.primary');return start&&!done.has('start')?{id:'start',target:start,text:'👉 Tap here to start'}:undefined;}
  const kids=childrenOf(current);if(!kids.some(n=>n.name==='Progress'))return;
  const timer=kids.find(n=>n.name==='Timer'),status=timer?timers.list().find(t=>t.id===timer.key)?.status:undefined,next=byId('next'),last=current.key===screens.at(-1)?.key;
  if(current.key===screens[0]?.key&&!timer)return done.has('start')?undefined:{id:'start',target:next,text:'👉 Tap here to start'};
  if(status==='stopped'){const start=[...document.querySelectorAll<HTMLElement>('#screen .timer button.primary')].find(b=>!b.hidden);return start&&!done.has('clock')?{id:'clock',target:start,text:'👉 Start the clock for Aira',side:'right'}:undefined;}
  if(status==='done'&&!last)return done.has('next')?undefined:{id:'next',target:next,text:'👉 Next move'};
  if(last&&!timer&&/how (we|aira|it) (did|went)/i.test(finalAction()??''))return done.has('summary')?undefined:{id:'summary',target:next,text:'👉 See how Aira did'};
  return undefined;
}
function syncGuide(){
  const step=tourStep>=0?TOUR[tourStep]:undefined,hint=step?undefined:nextHint(),target=step?step[0]():hint?.target;activeHint=hint;
  if(!target||!target.isConnected||target.offsetParent===null){guide.hidden=true;guideKey='';return;}
  const key=step?'tour'+tourStep:'hint:'+hint!.id;
  if(key!==guideKey){guideKey=key;guide.className='guide '+(step?'tour':'hint');guideText.textContent=step?step[1]:hint!.text;guideRow.replaceChildren();
    if(step)guideRow.append(button('Skip',()=>showStep(-1),'chip'),button(tourStep===TOUR.length-1?'Done':'Next',()=>showStep(tourStep>=TOUR.length-1?-1:tourStep+1),'primary'));
    else guideRow.append(button('Hide tips',()=>{store.set('aira-tips-off','1');syncTipsLink();syncGuide();},'link'));}
  guide.hidden=false;
  // Sit beside the target when asked and there is room, else just above it (below when there is no room): never on top of it.
  const r=target.getBoundingClientRect(),w=guide.offsetWidth,h=guide.offsetHeight,width=document.documentElement.clientWidth;
  if(hint?.side==='right'&&r.right+14+w<=width-8){guide.dataset.side='right';guide.style.left=(r.right+scrollX+14)+'px';guide.style.top=(r.top+scrollY+r.height/2-h/2)+'px';guideArrow.style.left='-6px';guideArrow.style.top=(h/2-6)+'px';return;}
  const left=Math.max(scrollX+8,Math.min(r.left+scrollX+r.width/2-w/2,scrollX+width-w-8)),above=r.top-h-14>=0;guide.dataset.side=above?'above':'below';
  guide.style.left=left+'px';guide.style.top=(above?r.top+scrollY-h-12:r.bottom+scrollY+12)+'px';guideArrow.style.top='';guideArrow.style.left=Math.max(14,Math.min(w-26,r.left+scrollX+r.width/2-left-6))+'px';}
function syncTipsLink(){byId('tips-toggle').textContent=store.get('aira-tips-off')==='1'?'Show tips':'Hide tips';}
document.addEventListener('click',event=>{if(activeHint&&activeHint.target.contains(event.target as Node))markHint(activeHint.id);},true);
window.addEventListener('resize',()=>syncGuide());
byId('tour-again').addEventListener('click',()=>showStep(0));
byId('tips-toggle').addEventListener('click',()=>{if(store.get('aira-tips-off')==='1'){store.set('aira-tips-off',null);store.set('aira-tips-done',null);}else store.set('aira-tips-off','1');syncTipsLink();guideKey='';syncGuide();});
syncTipsLink();
// Send stays quiet until there is something to send, so the screen's main action is the only filled button.
function syncSend(){byId('send').classList.toggle('primary',Boolean(draft.value.trim()));}
draft.addEventListener('input',syncSend);
byId<HTMLFormElement>('composer').addEventListener('submit',event=>{event.preventDefault();const text=draft.value.trim();if(text){draft.value='';send(text);}});
draft.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();byId<HTMLFormElement>('composer').requestSubmit();}});
byId('sample').addEventListener('click',()=>send('Load wiring sample'));byId('cancel').addEventListener('click',()=>c.cancel());byId('retry').addEventListener('click',()=>{if(!paused)void c.retry();});
byId('reset').addEventListener('click',()=>{nav.dispose();paused=false;pausedTimers=[];timers.forget();previousTimers.clear();history.clear();draft.value='';c.reset();});
byId('back').addEventListener('click',()=>nav.back());byId('next').addEventListener('click',()=>nav.next());
byId('pause').addEventListener('click',()=>{paused=!paused;guard='';if(paused){pausedTimers=timers.list().filter(t=>t.status==='running').map(t=>t.id);for(const id of pausedTimers){timers.pause(id);const h=history.get(id)??{fast:false,pauses:0};h.pauses++;history.set(id,h);}}else{for(const id of pausedTimers)timers.start(id);pausedTimers=[];}c.localEvent(paused?'User paused the preview.':'User resumed the preview.');tick();});
byId<HTMLSelectElement>('provider').addEventListener('change',event=>{guard='';c.selectProvider((event.target as HTMLSelectElement).value as Provider);});
byId<HTMLInputElement>('consent').addEventListener('change',event=>{c.consent=(event.target as HTMLInputElement).checked;if(!c.consent)c.cancel();render();});
byId('apply-patch').addEventListener('click',()=>{try{const raw=byId<HTMLTextAreaElement>('patch').value;c.document.apply(raw.includes('```')?raw:'```openui\n'+raw+'\n```');c.localEvent('Builder applied local OpenUI data: '+raw);byId('patch-status').textContent='Patch accepted. This is local fixture evidence, not a model run.';}catch{byId('patch-status').textContent='Invalid patch. Previous screen kept. Check names, arguments and catalog.';}});
byId('export').addEventListener('click',()=>{const label=byId<HTMLSelectElement>('run-label').value;const payload={format:'aira-workout-run-v1',label,appVersion:APP_VERSION,schemaVersion:SCHEMA_VERSION,selectedProvider:c.provider,note:byId<HTMLTextAreaElement>('note').value,events:c.events,state:{ui_state:c.document.echo(),client_events:c.clientEvents},timers:timers.list()};const url=URL.createObjectURL(new Blob([JSON.stringify(redactValue(payload),null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download=label+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);byId('export-status').textContent=`Downloaded ${label}.json. Review and move it into runs/.`;});
async function start(){render();try{const response=await fetch('/api/config');if(!response.ok)throw new Error();config=await response.json();const select=byId<HTMLSelectElement>('provider');select.replaceChildren();for(const p of config!.providers){const option=el('option',p.label+(p.enabled?'':' · setup / blocked'));option.value=p.id;select.append(option);}select.value='mock';select.disabled=false;render();}catch{byId('status').textContent='Could not connect. Restart the local server and reload.';}}
drawPip();setInterval(tick,250);void start();
