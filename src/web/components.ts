import { el, button } from './dom.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import type { TimerLedger } from '../shared/openui/timer-store.js';
/** One mark per timed move, in order ("done", "skipped", plus "current"); `current` is the 1-based move on screen (0 when none is). */
export type SessionTally = { done: number; skipped: number; total: number; current: number; seconds: number; started: boolean; marks: string[] };
export type Context = { send: (text:string)=>void; timers: TimerLedger; timerAction: (id:string, action:'start'|'pause'|'reset'|'finish')=>void; updates: (()=>void)[]; paused: boolean; session: ()=>SessionTally; primaryPrompt?: string };
const STATUS = { stopped: 'ready', running: 'running', paused: 'paused', done: 'done' } as const;
const about = (seconds:number) => seconds < 60 ? `${seconds} seconds` : `about ${Math.round(seconds/60)} min`;
// Trusted DOM ports of the source component signatures; no model-generated code.
export const renderers: Record<string,(node:StatementNode,context:Context)=>HTMLElement> = {
  Text: ({props:p}) => el(p.variant==='title'?'h3':p.variant==='subtitle'?'h4':'p',String(p.text),'block block-'+String(p.variant??'body')),
  Keyword: ({props:p}) => {const n=el('div','','keyword');n.append(el('strong',String(p.text)));if(p.caption)n.append(el('p',String(p.caption)));return n;},
  Alert: ({props:p}) => el('aside',String(p.text),'block alert'),
  List: ({props:p},c) => {const n=el('ul','','block');for(const row of p.items as StatementNode[])n.append(renderComponent(row,c));return n;},
  ListItem: ({props:p}) => el('li',String(p.text)),
  // Prompts are secondary chips; the screen's main action lives on the Next button, so it is not repeated here.
  FollowUps: ({props:p},c) => {const n=el('div','','row follow');for(const text of p.prompts as string[])if(text!==c.primaryPrompt)n.append(button(text,()=>c.send(text),'chip'));return n;},
  // The coach runs Aira's clock: one filled action per state (Start the clock, then Resume), the rest quiet.
  Timer: ({key,props:p},c) => {
    const n=el('section','','timer');n.setAttribute('aria-label',String(p.label));
    const value=el('strong'),status=el('span','','micro timer-status'),row=el('div','','row timer-actions');
    const start=button('Start the clock',()=>c.timerAction(key,'start'),'primary'),pause=button('Pause',()=>c.timerAction(key,'pause')),finish=button('Finish early',()=>c.timerAction(key,'finish'),'chip');
    row.append(start,pause,finish);n.append(el('p','YOU RUN THE CLOCK','eyebrow'),value,status,row);
    const update=()=>{const entry=c.timers.list().find(t=>t.id===key);if(!entry)return;const seconds=Math.ceil(entry.remaining);value.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;status.textContent=STATUS[entry.status];n.dataset.status=entry.status;
      start.hidden=entry.status!=='stopped';pause.hidden=entry.status==='stopped'||entry.status==='done';pause.textContent=entry.status==='paused'?'Resume':'Pause';pause.className=entry.status==='paused'?'primary':'';finish.hidden=pause.hidden;for(const b of [start,pause,finish])b.disabled=c.paused;};
    c.updates.push(update);update();return n;
  },
  // Beats are spoken in the text lane by app.ts at the right moment; nothing shows on the screen itself.
  Beats: () => {const n=el('span');n.hidden=true;return n;},
  // The one progress indicator. Counts come from the local timer ledger, never from model text, so they stay truthful between turns.
  Progress: ({props:p},c) => {
    const n=el('section','','block tally');n.setAttribute('role','progressbar');n.setAttribute('aria-label',String(p.label));n.setAttribute('aria-valuemin','0');
    const bar=el('div','','tally-bar'),caption=el('p','','tally-caption');n.append(el('p',String(p.label),'eyebrow'),bar,caption);
    const update=()=>{const s=c.session();n.setAttribute('aria-valuemax',String(s.total));n.setAttribute('aria-valuenow',String(s.done));
      if(bar.childElementCount!==s.total){bar.replaceChildren();for(let i=0;i<s.total;i++)bar.append(el('span'));}
      [...bar.children].forEach((span,i)=>{span.className=s.marks[i]??'';});
      const tally=[...(s.done?[`${s.done} done`]:[]),...(s.skipped?[`${s.skipped} skipped`]:[])];
      caption.textContent=!s.total?'No moves yet':s.current?[`Move ${s.current} of ${s.total}`,...tally].join(' · '):!s.started?`${s.total} move${s.total===1?'':'s'} · ${about(s.seconds)}`:[`${s.done} of ${s.total} done`,...(s.skipped?[`${s.skipped} skipped`]:[])].join(' · ');
      n.setAttribute('aria-valuetext',caption.textContent);};
    c.updates.push(update);update();return n;
  },
};
export function renderComponent(node:StatementNode,context:Context):HTMLElement {
  if(!Object.hasOwn(renderers,node.name))throw new Error('No renderer for '+node.name);
  const n=renderers[node.name](node,context);n.dataset.statement=node.key;
  if(typeof node.props.color==='string' && /^#[0-9a-fA-F]{6}$/.test(node.props.color))n.style.color=node.props.color;
  return n;
}
