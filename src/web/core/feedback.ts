import { store } from './store.js';

// Short, quiet cues for timer moments. Created on first use after a user gesture (browsers require it).
let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!store.prefs.sound) return null;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch { return null; }
}

function tone(frequency: number, start: number, duration: number, gain = 0.08) {
  const ctx = audio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  amp.gain.setValueAtTime(0, ctx.currentTime + start);
  amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

/** Call from a click handler so later cues are allowed to play. */
export function primeAudio() { audio(); }

export function cue(kind: 'rest-done' | 'hold-done' | 'countdown' | 'finish') {
  if (kind === 'countdown') tone(880, 0, 0.12, 0.05);
  else if (kind === 'finish') { tone(523, 0, 0.35); tone(659, 0.12, 0.35); tone(784, 0.24, 0.5); }
  else { tone(784, 0, 0.22); tone(1046, 0.16, 0.32); }
  if (store.prefs.vibration && 'vibrate' in navigator) {
    try { navigator.vibrate(kind === 'countdown' ? 40 : [120, 60, 120]); } catch { /* unsupported */ }
  }
}
