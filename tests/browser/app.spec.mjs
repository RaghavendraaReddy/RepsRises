import { test,expect } from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const shots='evidence/screenshots';
async function send(page,text){await page.locator('#message').fill(text);await page.locator('#send').click();await expect(page.locator('#pending')).toBeHidden();}
async function demo(page){await page.locator('.builder').evaluate(e=>e.open=true);await page.locator('#sample').click();await expect(page.locator('[data-statement="count1"]')).toContainText('8');}
// Filled buttons inside the screen preview (Next included): the experience allows exactly one at a time.
const filled=page=>page.locator('.preview button.primary:visible');
// Existing tests run as a returning visitor; the tour and tips have their own tests below.
const returning=()=>{try{localStorage.setItem('aira-tour-seen','1');localStorage.setItem('aira-tips-off','1');}catch{}};
test.beforeEach(async({page})=>{await page.addInitScript(returning);await page.goto('/');await expect(page.locator('#mode')).toHaveText('MOCK · NO MODEL CALLS');});
test('source stepper, text cues, value patch and local timer continuity',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(shots,{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:shots+'/01-start.png',fullPage:true});await demo(page);
 await expect(page.locator('#spoken')).toContainText('current screen');await send(page,'next');await expect(page.locator('#position')).toHaveText('2 / 4');await page.getByRole('button',{name:'Start the clock',exact:true}).click();
 await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('3 / 4');await page.locator('#back').click();await expect(page.locator('.timer-status')).toHaveText('running');
 await page.locator('#pause').click();await expect(page.locator('.timer-status')).toHaveText('paused');await expect(page.locator('#next')).toBeDisabled();await page.locator('#pause').click();await expect(page.locator('.timer-status')).toHaveText('running');
 await page.getByRole('button',{name:'Finish early',exact:true}).click();await expect(page.locator('.timer-status')).toHaveText('done');await expect(page.locator('#position')).toHaveText('2 / 4');
 await send(page,'change value to 6');await expect(page.locator('#position')).toHaveText('2 / 4');await send(page,'next');await expect(page.locator('[data-statement="count2"]')).toContainText('6');await page.screenshot({path:shots+'/02-workout-state.png',fullPage:true});expect(errors).toEqual([]);
});
test('repeated sends, interruption, reset while pending and post-reset navigation',async({page})=>{
 await page.locator('.builder').evaluate(e=>e.open=true);await page.locator('#fault').selectOption('slow');await page.locator('#message').fill('/demo');await page.locator('#send').click();await page.locator('#message').fill('/demo');await page.locator('#send').click();await expect(page.locator('.message.user')).toHaveCount(1);await page.locator('#reset').click();await page.waitForTimeout(2500);await expect(page.locator('#screen')).toContainText("Hi, I'm Aira");await demo(page);await page.locator('#next').click();await page.locator('#reset').click();await demo(page);await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('2 / 4');
 await page.locator('#fault').selectOption('slow');await page.locator('#message').fill('next');await page.locator('#send').click();await send(page,'back');await expect(page.locator('#position')).toHaveText('1 / 4');
});
for(const fault of ['schema','request'])test(`${fault} failure preserves screen and retry recovers`,async({page})=>{await demo(page);await page.locator('#fault').selectOption(fault);await send(page,'next');await expect(page.locator('#error')).toBeVisible();await expect(page.locator('[data-statement="count1"]')).toContainText('8');await page.locator('#retry').click();await expect(page.locator('#position')).toHaveText('2 / 4');await expect(page.locator('#error')).toBeHidden();});
test('local valid/invalid patches are data and candidate component can be registered',async({page})=>{
 await demo(page);await page.locator('#patch').fill('count1 = Keyword("<img src=x onerror=alert(1)>", "inert")');await page.locator('#apply-patch').click();await expect(page.locator('[data-statement="count1"]')).toContainText('<img src=x');await expect(page.locator('#screen img')).toHaveCount(0);
 await page.locator('#patch').fill('count1 = Function("evil")');await page.locator('#apply-patch').click();await expect(page.locator('#patch-status')).toContainText('Invalid patch');
 // Trusted test code registers a candidate component in all three local seams.
 await page.evaluate(async()=>{const {OPENUI_LIBRARY}=await import('/shared/openui/openui-library.js');const {propValidators}=await import('/shared/openui/validate.js');const {renderers}=await import('/web/components.js');OPENUI_LIBRARY.StatusPill={args:['label','value'],required:2};propValidators.StatusPill=p=>typeof p.label==='string'&&typeof p.value==='string';renderers.StatusPill=({props:p})=>{const n=document.createElement('div');n.textContent=p.label+': '+p.value;return n;};});
 await page.locator('#patch').fill('page1 = Screen([heading1, custom1])\ncustom1 = StatusPill("Sample", "A")');await page.locator('#apply-patch').click();await expect(page.locator('[data-statement="custom1"]')).toHaveText('Sample: A');
});
test('manual export contains screen/events/versions and no token; mobile fits',async({page})=>{
 await page.setViewportSize({width:390,height:844});await demo(page);await page.locator('#note').fill('Tested mock only. TOKEN=do-not-export');const download=page.waitForEvent('download');await page.locator('#export').click();const d=await download;const stream=await d.createReadStream();let content='';for await(const chunk of stream)content+=chunk;const json=JSON.parse(content);expect(json.state.ui_state).toContain('root = Screens');expect(json.events.find(e=>e.result).result.versions.protocolHash).toHaveLength(64);expect(content).not.toContain('do-not-export');expect(content).not.toContain('X-Local-Token');await page.locator('.builder').evaluate(e=>e.open=false);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#reset').click();await send(page,"I'm new, go easy");await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Move 1 of 3');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:shots+'/03-mobile.png',fullPage:true});
});
test('runtime starts mock; Codex blocked; selecting never calls model endpoint',async({page})=>{let turns=0;page.on('request',r=>{if(r.url().includes('/api/turn'))turns++;});await page.locator('#provider').selectOption('codex-cli');await expect(page.locator('#send')).toBeDisabled();await expect(page.locator('#provider-description')).toContainText('no-command/no-private-read');expect(turns).toBe(0);});
test('configured CLI needs explicit consent and records fake provider identity',async({page})=>{
 await page.route('**/api/config',async route=>{const response=await route.fetch();const cfg=await response.json();cfg.providers.find(p=>p.id==='claude-cli').enabled=true;await route.fulfill({json:cfg});});await page.reload();await page.locator('#provider').selectOption('claude-cli');await expect(page.locator('#send')).toBeDisabled();await page.locator('#consent').check();await page.route('**/api/turn',route=>route.fulfill({json:{turn:{reply:'Transport fixture, not a live CLI request.'},versions:{provider:'claude-cli',mode:'live',model:'fixture-only'}}}));await send(page,'hello');await expect(page.locator('#spoken')).toContainText('Transport fixture');
});
test('Progress shows the current move and live tally; finishing early is recorded for the coach',async({page})=>{
 await demo(page);
 await page.locator('#patch').fill('page2 = Screen([prog1, heading2, timer1, cue2])\nprog1 = Progress("Your session")\npage3 = Screen([prog2, heading3, count2, cue3])\nprog2 = Progress("Your session")');await page.locator('#apply-patch').click();await expect(page.locator('#patch-status')).toContainText('Patch accepted');
 await expect(page.locator('#progress')).toBeVisible();await page.locator('#next').click();await expect(page.locator('[data-statement="prog1"]')).toContainText('Move 1 of 1');
 await expect(page.locator('#progress')).toBeHidden();await expect(page.locator('#position')).toBeHidden();
 await page.locator('#next').click();await expect(page.locator('[data-statement="prog2"]')).toContainText('0 of 1 done · 1 skipped');await expect(page.locator('[data-statement="prog2"] .skipped')).toHaveCount(1);
 await page.locator('#back').click();await page.getByRole('button',{name:'Start the clock',exact:true}).click();await page.getByRole('button',{name:'Finish early',exact:true}).click();
 await expect(page.locator('[data-statement="prog1"]')).toContainText('Move 1 of 1 · 1 done');await expect(page.locator('[data-statement="prog1"]')).toHaveAttribute('aria-valuenow','1');
 await expect(page.locator('#state-json')).toContainText('Used Finish early on the timer for Sample timer with');await expect(page.locator('#transcript .event')).toHaveCount(0);
 // The next turn carries a durable per-timer record and names the screen in step events.
 const sent=page.waitForRequest('**/api/turn');await send(page,'next');const events=(await sent).postDataJSON().state.client_events.join('\n');
 expect(events).toContain('Simulated timer timer1 (Sample timer): done (finished early)');expect(events).toContain('Now on step 3 of 4 (screen page3).');
});
test('first screen: Aira introduces the role flip, offers one-tap starts, and the chat stays free of system logs',async({page})=>{
 await expect(page.locator('#screen')).toContainText("Hi, I'm Aira.");await expect(page.locator('#screen .role')).toHaveText("I do the moves, you're my coach and run the clock.");
 await expect(filled(page)).toHaveText(["I'm new, go easy"]);await expect(page.locator('#message')).toHaveAttribute('placeholder',"Say hi, or tell Aira how long you've got");await expect(page.locator('#sample')).toBeHidden();
 await page.getByRole('button',{name:"I've got 5 minutes",exact:true}).click();await expect(page.locator('#pending')).toBeHidden();
 await expect(page.locator('.message.assistant')).toContainText('Five minutes is plenty');await expect(page.locator('.message.assistant .who')).toHaveText('Aira');
 await expect(page.locator('#screen .block-description').first()).toHaveText("I do the moves, you're my coach and run the clock.");await expect(page.locator('#screen')).toContainText('4 moves · about 3 min');
 await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Move 1 of 4');await expect(page.locator('#transcript')).not.toContainText('screen');
 await expect(page.locator('body')).not.toContainText(/mission control|Simulate finish|Start simulation|launch pad|comet|orbit|nebula|\bPip\b/i);
});
test('Mock plays Aira end to end with one filled button per moment and no duplicate actions',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:"I'm new, go easy",exact:true}).click();await expect(page.locator('#screen')).toContainText('Quick Session');await expect(page.locator('#spoken')).toContainText('Tap Next');
 await expect(page.locator('#next')).toHaveText('Next: Arm Circles →');await expect(filled(page)).toHaveText(['Next: Arm Circles →']);
 const moves=['Arm Circles','Side Steps','Reach Up'];
 for(const [i,name] of moves.entries()){
  await page.locator('#next').click();await expect(page.locator('#screen h3').first()).toHaveText(name);await expect(page.locator('#screen')).toContainText(`Move ${i+1} of 3`);
  await expect(filled(page)).toHaveText(['Start the clock']);await page.getByRole('button',{name:'Start the clock',exact:true}).click();
  await expect(filled(page)).toHaveCount(0);await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(filled(page)).toHaveText(['Resume']);await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.getByRole('button',{name:'Finish early',exact:true}).click();await expect(filled(page)).toHaveText([i<2?`Next: ${moves[i+1]} →`:'Next: Finish line →']);
 }
 await page.locator('#next').click();await expect(page.locator('#next')).toHaveText('See how we did →');await expect(page.locator('#screen')).not.toContainText('Every move');await expect(page.locator('#screen button',{hasText:'See how we did'})).toHaveCount(0);
 await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('How we did');await expect(page.locator('#screen')).toContainText('3 of 3 done');await expect(page.locator('#screen')).toContainText('Arm Circles: finished early, with a break');
 await expect(page.locator('#screen')).toContainText('Next time:');await expect(page.locator('#next')).toHaveText('Start a new session →');await expect(page.locator('#screen button',{hasText:'Start a new session'})).toHaveCount(0);await expect(page.locator('#screen button',{hasText:'Add a bonus move'})).toHaveCount(1);
 expect(errors).toEqual([]);
});
for(const [fault,detail] of [['schema','Simulated invalid component schema'],['request','Simulated model request failure']])test(`a failed turn (${fault}) speaks as Aira, keeps the workout usable and recovers on Try again`,async({page})=>{
 await send(page,'hi');await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Move 1 of 4');
 await page.locator('.builder').evaluate(e=>e.open=true);await page.locator('#fault').selectOption(fault);
 await page.getByRole('button',{name:'Skip this move',exact:true}).click();await expect(page.locator('#pending')).toBeHidden();
 await expect(page.locator('#error-friendly')).toHaveText('Aira lost the thread for a second. Your place is kept: keep going, or try again.');await expect(page.locator('#error-message')).toContainText(detail);await expect(page.locator('#status')).toHaveText('Aira missed that one');
 await expect(page.locator('#screen')).toContainText('Move 1 of 4');await page.getByRole('button',{name:'Start the clock',exact:true}).click();await expect(page.locator('.timer-status')).toHaveText('running');
 await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('#error')).toBeHidden();await expect(page.locator('#screen')).toContainText('Move 2 of 4');
});
test('a local guard is not a failed turn: on a break, chips explain instead of offering Try again',async({page})=>{
 await send(page,'hi');await page.locator('#pause').click();await page.getByRole('button',{name:'Make it shorter',exact:true}).click();
 await expect(page.locator('#error-friendly')).toHaveText("You're on a break. Tap I'm back first.");await expect(page.locator('#retry')).toBeHidden();
 await page.locator('#pause').click();await expect(page.locator('#error')).toBeHidden();
});
test('Aira speaks at the right moment: arrival, going quiet, clock start, half time and the end',async({page})=>{
 await page.clock.install();await page.reload();await send(page,'hi');await page.locator('#next').click();await page.clock.runFor(200);
 await expect(page.locator('#spoken')).toHaveText("Arm Circles first. Start the clock and I'm off.");
 await page.clock.runFor(21000);await expect(page.locator('#spoken')).toHaveText("Whenever you're ready, coach.");
 await page.getByRole('button',{name:'Start the clock',exact:true}).click();await expect(page.locator('#spoken')).toHaveText('Here I go.');
 await page.clock.runFor(21000);await expect(page.locator('#spoken')).toHaveText('Halfway. Still smiling.');
 await page.clock.runFor(20000);await expect(page.locator('.timer-status')).toHaveText('done');await expect(page.locator('#spoken')).toHaveText('Done. That one goes in the log.');
 await expect(page.locator('#screen')).not.toContainText('Halfway');
});
test('a timer tap during a slow coach reply keeps the reply; navigation would still interrupt it',async({page})=>{
 await send(page,'hi');await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Move 1 of 4');
 await page.locator('.builder').evaluate(e=>e.open=true);await page.locator('#fault').selectOption('slow');
 await page.getByRole('button',{name:'Skip this move',exact:true}).click();await expect(page.locator('#pending')).toBeVisible();
 await page.getByRole('button',{name:'Start the clock',exact:true}).click();await expect(page.locator('#pending')).toBeHidden({timeout:5000});
 await expect(page.locator('#screen')).toContainText('Move 2 of 4');await expect(page.locator('#transcript')).not.toContainText('cut short');
});

test('"Aira says" sits right under the move title, inside the screen',async({page})=>{
 await send(page,"I'm new, go easy");await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Move 1 of 3');
 const order=await page.evaluate(()=>{const kids=[...document.querySelectorAll('#screen > *')];return kids.map(n=>n.matches('.spoken')?'says':n.tagName==='H3'?'title':'other');});
 expect(order.indexOf('says')).toBe(order.indexOf('title')+1);await expect(page.locator('#screen .spoken h2')).toHaveText('Aira says');await expect(page.locator('#screen .spoken')).toContainText('No microphone, audio, TTS or physical exertion.');
});
test('first visit: a 3-step tour, then one tip at a time that never covers its button and goes once pressed',async({browser})=>{
 for(const width of [1366,390]){
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4320',viewport:{width,height:width>800?768:844}});const page=await context.newPage();await page.goto('/');
  const guide=page.locator('.guide');
  await expect(guide).toContainText('Chat with Aira here. Tell her how much time you have.');await guide.getByRole('button',{name:'Next'}).click();
  await expect(guide).toContainText('This is your workout. Aira does the moves, you run her clock.');await guide.getByRole('button',{name:'Next'}).click();
  await expect(guide).toContainText('Aira reacts here as you go.');await guide.getByRole('button',{name:'Done'}).click();
  // Tips: each one points at the next press, sits outside the button, and is gone after the press.
  const clear=async label=>{const target=page.getByRole('button',{name:label,exact:true});const [b,t]=await Promise.all([guide.boundingBox(),target.boundingBox()]);expect(b.x+b.width<=t.x||b.x>=t.x+t.width||b.y+b.height<=t.y||b.y>=t.y+t.height,'tip does not cover '+label).toBe(true);expect(b.x>=0&&b.x+b.width<=width).toBe(true);};
  await expect(guide).toHaveText(/Tap here to start/);await clear("I'm new, go easy");await page.getByRole('button',{name:"I'm new, go easy",exact:true}).click();await expect(page.locator('#pending')).toBeHidden();
  await page.locator('#next').click();await expect(guide).toHaveText(/Start the clock for Aira/);await clear('Start the clock');
  {const [b,t]=await Promise.all([guide.boundingBox(),page.locator('#screen .timer strong').boundingBox()]);expect(b.x+b.width<=t.x||b.x>=t.x+t.width||b.y+b.height<=t.y||b.y>=t.y+t.height,'tip does not cover the time').toBe(true);}
  await page.getByRole('button',{name:'Start the clock',exact:true}).click();await expect(guide).toBeHidden();await page.getByRole('button',{name:'Finish early',exact:true}).click();
  await expect(guide).toHaveText(/Next move/);await clear('Next: Side Steps →');await page.locator('#next').click();
  await expect(guide).toBeHidden();await page.getByRole('button',{name:'Start the clock',exact:true}).click();await page.getByRole('button',{name:'Finish early',exact:true}).click();await expect(guide).toBeHidden();
  await page.reload();await expect(guide).toBeHidden();await expect(page.locator('#tour-again')).toHaveText('Show tour again');
  await page.locator('#tour-again').click();await expect(guide).toContainText('Chat with Aira here.');await guide.getByRole('button',{name:'Skip'}).click();await expect(guide).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
 }
});
test('Hide tips turns tips off and Show tips brings them back',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:4320'});await context.addInitScript(()=>{try{localStorage.setItem('aira-tour-seen','1');}catch{}});const page=await context.newPage();await page.goto('/');
 await expect(page.locator('.guide')).toHaveText(/Tap here to start/);await page.locator('#tips-toggle').click();await expect(page.locator('.guide')).toBeHidden();await expect(page.locator('#tips-toggle')).toHaveText('Show tips');
 await page.locator('#tips-toggle').click();await expect(page.locator('.guide')).toHaveText(/Tap here to start/);await context.close();
});
