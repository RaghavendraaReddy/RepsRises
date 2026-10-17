import { exerciseById } from '../../shared/fitness/exercises.js';
import type { Equipment, Pattern } from '../../shared/fitness/types.js';
import { prefersReducedMotion, s } from '../core/dom.js';

// Articulated demonstration figures. Each movement pattern has two key poses (start and end);
// trusted code interpolates joint angles between them. Angles are degrees measured from straight
// down, turning toward the direction the figure faces (+x): 0 = down, 90 = forward, 180 = up.

type Limb = [number, number];
type Anchor = { kind: 'ankle' | 'ankleFar' | 'hand' | 'hip'; x: number; y: number };
type Pose = { anchor: Anchor; torso: number; armN: Limb; armF: Limb; legN: Limb; legF: Limb; footN?: number; footF?: number };
type Kit = 'none' | 'dumbbells' | 'barbell' | 'kettlebell' | 'bench' | 'bar' | 'cable' | 'band' | 'frame';

const L = { torso: 46, neck: 5, head: 8.5, upper: 26, fore: 24, thigh: 38, shin: 37, foot: 10 };
const GROUND = 180;
const v = (deg: number, len: number) => { const r = (deg * Math.PI) / 180; return [Math.sin(r) * len, Math.cos(r) * len] as const; };
const add = (p: readonly [number, number], d: readonly [number, number]) => [p[0] + d[0], p[1] + d[1]] as [number, number];
const sub = (p: readonly [number, number], d: readonly [number, number]) => [p[0] - d[0], p[1] - d[1]] as [number, number];

const stand = (overrides: Partial<Pose> = {}): Pose => ({ anchor: { kind: 'ankle', x: 100, y: 177 }, torso: 180, armN: [4, 6], armF: [-4, -2], legN: [2, 0], legF: [-2, 0], ...overrides });

const POSES: Record<Pattern, { a: Pose; b: Pose; frame?: [number, number, number, number] }> = {
  squat: { a: stand({ armN: [80, 92], armF: [76, 90] }), b: stand({ torso: 145, armN: [86, 96], armF: [82, 94], legN: [80, -20], legF: [76, -22] }) },
  hinge: { a: stand(), b: stand({ torso: 100, armN: [-2, 0], armF: [2, 2], legN: [14, -6], legF: [10, -6] }) },
  lunge: {
    a: stand({ anchor: { kind: 'ankle', x: 122, y: 177 }, legN: [18, 0], legF: [-22, -22], footF: 40 }),
    b: stand({ anchor: { kind: 'ankle', x: 122, y: 177 }, torso: 176, legN: [85, -10], legF: [-8, -95], footF: 30, armN: [10, 10], armF: [-10, -6] }),
  },
  'push-floor': {
    a: { anchor: { kind: 'hand', x: 140, y: 177 }, torso: 112, armN: [0, 0], armF: [2, 2], legN: [-68, -68], legF: [-70, -70], footN: 10, footF: 10 },
    b: { anchor: { kind: 'hand', x: 140, y: 177 }, torso: 98, armN: [-80, 50], armF: [-78, 52], legN: [-82, -82], legF: [-84, -84], footN: 10, footF: 10 },
  },
  'press-bench': {
    a: { anchor: { kind: 'hip', x: 96, y: 131 }, torso: 90, armN: [180, 180], armF: [178, 178], legN: [-72, -8], legF: [-68, -6] },
    b: { anchor: { kind: 'hip', x: 96, y: 131 }, torso: 90, armN: [-75, 150], armF: [-72, 152], legN: [-72, -8], legF: [-68, -6] },
  },
  'press-overhead': { a: stand({ armN: [30, 175], armF: [26, 172] }), b: stand({ armN: [176, 180], armF: [172, 178] }) },
  'pull-vertical': {
    a: { anchor: { kind: 'hand', x: 110, y: 34 }, torso: 180, armN: [180, 180], armF: [178, 178], legN: [-4, -28], legF: [-8, -32] },
    b: { anchor: { kind: 'hand', x: 110, y: 34 }, torso: 184, armN: [14, 176], armF: [10, 174], legN: [8, -22], legF: [4, -26] },
  },
  row: { a: stand({ torso: 118, armN: [0, 0], armF: [4, 2], legN: [16, -8], legF: [12, -8] }), b: stand({ torso: 118, armN: [-62, 12], armF: [-58, 14], legN: [16, -8], legF: [12, -8] }) },
  curl: { a: stand({ armN: [2, 2], armF: [-2, -2] }), b: stand({ armN: [8, 162], armF: [4, 158] }) },
  raise: { a: stand({ armN: [4, 4], armF: [-2, -2] }), b: stand({ armN: [92, 94], armF: [88, 90] }) },
  extension: { a: stand({ armN: [172, 176], armF: [168, 174] }), b: stand({ armN: [172, -22], armF: [168, -26] }) },
  plank: {
    a: { anchor: { kind: 'hip', x: 96, y: 156 }, torso: 96, armN: [0, 90], armF: [2, 90], legN: [-84, -84], legF: [-86, -86], footN: 6, footF: 6 },
    b: { anchor: { kind: 'hip', x: 96, y: 155 }, torso: 97, armN: [0, 90], armF: [2, 90], legN: [-83, -84], legF: [-85, -86], footN: 6, footF: 6 },
  },
  crunch: {
    a: { anchor: { kind: 'hip', x: 96, y: 170 }, torso: 92, armN: [-84, -86], armF: [-80, -84], legN: [-150, -22], legF: [-146, -20] },
    b: { anchor: { kind: 'hip', x: 96, y: 170 }, torso: 122, armN: [-58, -60], armF: [-54, -58], legN: [-150, -22], legF: [-146, -20] },
  },
  bridge: {
    a: { anchor: { kind: 'ankle', x: 62, y: 177 }, torso: 87, armN: [-86, -90], armF: [-84, -90], legN: [-140, -10], legF: [-136, -12] },
    b: { anchor: { kind: 'ankle', x: 62, y: 177 }, torso: 66, armN: [-70, -88], armF: [-68, -88], legN: [-105, -10], legF: [-101, -12] },
  },
  calf: { a: stand({ footN: 90, footF: 90 }), b: stand({ anchor: { kind: 'ankle', x: 100, y: 169 }, footN: 52, footF: 52 }) },
  cardio: {
    a: stand({ anchor: { kind: 'ankleFar', x: 100, y: 177 }, legN: [4, 0], legF: [-2, 0], armN: [-30, 40], armF: [30, 120] }),
    b: stand({ anchor: { kind: 'ankleFar', x: 100, y: 177 }, legN: [92, 0], legF: [-2, 0], armN: [40, 140], armF: [-34, 20] }),
  },
  carry: {
    a: { anchor: { kind: 'hip', x: 100, y: 103 }, torso: 180, armN: [2, 0], armF: [-2, 0], legN: [16, 2], legF: [-14, -8] },
    b: { anchor: { kind: 'hip', x: 100, y: 101 }, torso: 180, armN: [-2, 0], armF: [2, 0], legN: [-14, -8], legF: [16, 2] },
  },
  mobility: {
    a: stand({ anchor: { kind: 'ankle', x: 122, y: 177 }, torso: 130, legN: [85, -10], legF: [-8, -95], footF: 30, armN: [6, 6], armF: [10, 8] }),
    b: stand({ anchor: { kind: 'ankle', x: 122, y: 177 }, torso: 140, legN: [85, -10], legF: [-8, -95], footF: 30, armN: [6, 6], armF: [176, 180] }),
  },
};

// Exercises whose general pattern draws poorly get a better-fitting one.
const OVERRIDES: Record<string, Pattern> = { 'pike-push-up': 'push-floor', 'diamond-push-up': 'push-floor', 'hanging-knee-raise': 'crunch', 'doorway-row': 'row', 'inverted-row': 'row', superman: 'plank', 'prone-y-raise': 'raise', 'wall-sit': 'squat', 'burpee': 'squat' };

function kitFor(pattern: Pattern, equipment: Equipment[], id: string): Kit[] {
  const kit: Kit[] = [];
  if (equipment.includes('bench') && ['press-bench', 'bridge', 'extension'].includes(pattern)) kit.push('bench');
  if (equipment.includes('pullup-bar') && pattern === 'pull-vertical') kit.push('bar');
  if (id === 'doorway-row') kit.push('frame');
  if (equipment.includes('barbell')) kit.push('barbell');
  else if (equipment.includes('dumbbells')) kit.push('dumbbells');
  else if (equipment.includes('kettlebell')) kit.push('kettlebell');
  else if (equipment.includes('cable')) kit.push('cable');
  else if (equipment.includes('bands')) kit.push('band');
  return kit.length ? kit : ['none'];
}

type Joints = Record<'hip' | 'shoulder' | 'head' | 'elbowN' | 'handN' | 'elbowF' | 'handF' | 'kneeN' | 'ankleN' | 'toeN' | 'kneeF' | 'ankleF' | 'toeF', [number, number]>;

function solve(pose: Pose): Joints {
  let hip: [number, number];
  const { anchor } = pose;
  if (anchor.kind === 'hip') hip = [anchor.x, anchor.y];
  else if (anchor.kind === 'ankle') hip = sub(sub([anchor.x, anchor.y], v(pose.legN[1], L.shin)), v(pose.legN[0], L.thigh));
  else if (anchor.kind === 'ankleFar') hip = sub(sub([anchor.x, anchor.y], v(pose.legF[1], L.shin)), v(pose.legF[0], L.thigh));
  else hip = sub(sub(sub([anchor.x, anchor.y], v(pose.armN[1], L.fore)), v(pose.armN[0], L.upper)), v(pose.torso, L.torso));
  const shoulder = add(hip, v(pose.torso, L.torso));
  const head = add(shoulder, v(pose.torso, L.neck + L.head));
  const elbowN = add(shoulder, v(pose.armN[0], L.upper)), handN = add(elbowN, v(pose.armN[1], L.fore));
  const elbowF = add(shoulder, v(pose.armF[0], L.upper)), handF = add(elbowF, v(pose.armF[1], L.fore));
  const kneeN = add(hip, v(pose.legN[0], L.thigh)), ankleN = add(kneeN, v(pose.legN[1], L.shin)), toeN = add(ankleN, v(pose.footN ?? 90, L.foot));
  const kneeF = add(hip, v(pose.legF[0], L.thigh)), ankleF = add(kneeF, v(pose.legF[1], L.shin)), toeF = add(ankleF, v(pose.footF ?? 90, L.foot));
  return { hip, shoulder, head, elbowN, handN, elbowF, handF, kneeN, ankleN, toeN, kneeF, ankleF, toeF };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function blend(a: Pose, b: Pose, t: number): Pose {
  const limb = (x: Limb, y: Limb): Limb => [mix(x[0], y[0], t), mix(x[1], y[1], t)];
  return {
    anchor: { kind: a.anchor.kind, x: mix(a.anchor.x, b.anchor.x, t), y: mix(a.anchor.y, b.anchor.y, t) }, torso: mix(a.torso, b.torso, t),
    armN: limb(a.armN, b.armN), armF: limb(a.armF, b.armF), legN: limb(a.legN, b.legN), legF: limb(a.legF, b.legF),
    footN: mix(a.footN ?? 90, b.footN ?? 90, t), footF: mix(a.footF ?? 90, b.footF ?? 90, t),
  };
}

const pts = (...points: [number, number][]) => points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

type Parts = { far: SVGPolylineElement[]; near: SVGPolylineElement[]; torso: SVGLineElement; head: SVGCircleElement; joints: SVGCircleElement[]; kit: SVGGElement };

function drawKit(group: SVGGElement, kit: Kit[], j: Joints) {
  group.replaceChildren();
  for (const item of kit) {
    if (item === 'barbell') for (const hand of [j.handN]) group.append(s('circle', { cx: hand[0], cy: hand[1], r: 13, class: 'kit', 'stroke-width': 3 }), s('circle', { cx: hand[0], cy: hand[1], r: 3, class: 'kit-fill' }));
    if (item === 'dumbbells') for (const hand of [j.handF, j.handN]) group.append(s('line', { x1: hand[0] - 7, y1: hand[1], x2: hand[0] + 7, y2: hand[1], class: 'kit', 'stroke-width': 3 }), s('rect', { x: hand[0] - 9, y: hand[1] - 5, width: 4, height: 10, class: 'kit-fill' }), s('rect', { x: hand[0] + 5, y: hand[1] - 5, width: 4, height: 10, class: 'kit-fill' }));
    if (item === 'kettlebell') group.append(s('circle', { cx: j.handN[0], cy: j.handN[1] + 10, r: 7, class: 'kit-fill' }), s('path', { d: `M${j.handN[0] - 5} ${j.handN[1] + 5} Q${j.handN[0]} ${j.handN[1] - 4} ${j.handN[0] + 5} ${j.handN[1] + 5}`, class: 'kit', 'stroke-width': 2.5 }));
    if (item === 'bench') group.append(s('path', { d: 'M56 138 H150 M66 138 V180 M140 138 V180', class: 'kit', 'stroke-width': 3 }));
    if (item === 'bar') group.append(s('path', { d: 'M60 34 H160 M70 34 V180 M150 34 V180', class: 'kit', 'stroke-width': 2.5 }));
    if (item === 'frame') group.append(s('path', { d: 'M152 20 V180', class: 'kit', 'stroke-width': 3 }));
    if (item === 'cable') group.append(s('line', { x1: j.handN[0], y1: j.handN[1], x2: 176, y2: 60, class: 'kit', 'stroke-width': 1.5 }), s('circle', { cx: 176, cy: 60, r: 4, class: 'kit-fill' }));
    if (item === 'band') group.append(s('path', { d: `M${j.handN[0]} ${j.handN[1]} L${j.ankleN[0]} ${GROUND - 2}`, class: 'kit', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
  }
}

function render(parts: Parts, kit: Kit[], j: Joints) {
  const [armF, legF] = parts.far, [legN, armN] = parts.near;
  armF.setAttribute('points', pts(j.shoulder, j.elbowF, j.handF));
  legF.setAttribute('points', pts(j.hip, j.kneeF, j.ankleF, j.toeF));
  legN.setAttribute('points', pts(j.hip, j.kneeN, j.ankleN, j.toeN));
  armN.setAttribute('points', pts(j.shoulder, j.elbowN, j.handN));
  parts.torso.setAttribute('x1', j.hip[0].toFixed(1)); parts.torso.setAttribute('y1', j.hip[1].toFixed(1));
  parts.torso.setAttribute('x2', j.shoulder[0].toFixed(1)); parts.torso.setAttribute('y2', j.shoulder[1].toFixed(1));
  parts.head.setAttribute('cx', j.head[0].toFixed(1)); parts.head.setAttribute('cy', j.head[1].toFixed(1));
  [j.kneeN, j.elbowN, j.hip, j.shoulder].forEach((point, index) => { parts.joints[index].setAttribute('cx', point[0].toFixed(1)); parts.joints[index].setAttribute('cy', point[1].toFixed(1)); });
  drawKit(parts.kit, kit, j);
}

type Live = { el: SVGSVGElement; parts: Parts; kit: Kit[]; a: Pose; b: Pose; offset: number; visible: boolean };
const live = new Set<Live>();
let frame = 0;
const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
  for (const entry of entries) for (const item of live) if (item.el === entry.target) item.visible = entry.isIntersecting;
}) : null;

function loop(now: number) {
  frame = 0;
  const reduced = prefersReducedMotion();
  for (const item of [...live]) {
    if (!item.el.isConnected) { live.delete(item); observer?.unobserve(item.el); continue; }
    if (!item.visible || reduced) continue;
    // 2.8 s cycle: ease out, hold, ease back, hold.
    const phase = ((now + item.offset) % 2800) / 2800;
    const raw = phase < 0.42 ? phase / 0.42 : phase < 0.5 ? 1 : phase < 0.92 ? 1 - (phase - 0.5) / 0.42 : 0;
    const t = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2;
    render(item.parts, item.kit, solve(blend(item.a, item.b, t)));
  }
  if (live.size) frame = requestAnimationFrame(loop);
}

export type FigureOptions = { animate?: boolean; title?: string; ground?: boolean; className?: string; strokeScale?: number };

export function patternFor(exerciseId: string): { pattern: Pattern; equipment: Equipment[] } {
  const exercise = exerciseById(exerciseId);
  return { pattern: OVERRIDES[exerciseId] ?? exercise?.pattern ?? 'squat', equipment: exercise?.equipment ?? [] };
}

/** An animated demonstration for an exercise. Shows the end position still when motion is reduced. */
export function figure(exerciseId: string, options: FigureOptions = {}): HTMLElement {
  const { pattern, equipment } = patternFor(exerciseId);
  return figureFor(pattern, equipment, exerciseId, options);
}

export function figureFor(pattern: Pattern, equipment: Equipment[], id = '', options: FigureOptions = {}): HTMLElement {
  const spec = POSES[pattern];
  const kit = kitFor(pattern, equipment, id);
  const w = options.strokeScale ?? 1;
  const limb = (cls: string) => s('polyline', { class: `limb ${cls}`, 'stroke-width': 6.5 * w });
  const parts: Parts = {
    far: [limb('far'), limb('far')], near: [limb(''), limb('')],
    torso: s('line', { class: 'limb', 'stroke-width': 9 * w }), head: s('circle', { r: L.head, fill: 'currentColor' }),
    joints: Array.from({ length: 4 }, () => s('circle', { r: 2.1 * w, class: 'joint', 'stroke-width': 1.2 })), kit: s('g'),
  };
  const svg = s('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': options.title ?? 'Exercise demonstration', preserveAspectRatio: 'xMidYMid meet' },
    options.ground === false ? null : s('line', { x1: 14, y1: GROUND, x2: 186, y2: GROUND, class: 'ground' }),
    parts.kit, parts.far[0], parts.far[1], parts.torso, parts.head, parts.near[0], parts.near[1], ...parts.joints);
  render(parts, kit, solve(prefersReducedMotion() || options.animate === false ? spec.b : spec.a));
  if (options.animate !== false) {
    const item: Live = { el: svg, parts, kit, a: spec.a, b: spec.b, offset: Math.random() * 2800, visible: true };
    live.add(item);
    observer?.observe(svg);
    if (!frame) frame = requestAnimationFrame(loop);
  }
  const wrap = document.createElement('div');
  wrap.className = `figure ${options.className ?? ''}`.trim();
  wrap.append(svg);
  return wrap;
}
