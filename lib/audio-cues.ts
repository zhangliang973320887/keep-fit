// Synthesised audio cues using Web Audio API — no external assets.
// Volumes deliberately punchy so users hear them with phone in pocket.
//
// Architecture: low-level synth primitives (tone/sweep/drum/chord) → multiple
// "sound packs" each implementing the same cue interface → an active pack
// resolved at call time. UI lets the user switch packs and persists the choice.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function unlock(): void {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

// ============== Synth primitives ==============

interface ToneOpts {
  freq: number;
  durationMs: number;
  gain?: number;
  type?: OscillatorType;
  attackMs?: number;
  releaseMs?: number;
}

function tone({
  freq,
  durationMs,
  gain = 0.25,
  type = "sine",
  attackMs = 8,
  releaseMs = 60,
}: ToneOpts): void {
  const c = getCtx();
  if (!c || !masterGain) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.value = freq;
  osc.type = type;
  const now = c.currentTime;
  const attack = attackMs / 1000;
  const release = releaseMs / 1000;
  const sustain = Math.max(0.01, durationMs / 1000 - attack - release);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + attack);
  g.gain.setValueAtTime(gain, now + attack + sustain);
  g.gain.linearRampToValueAtTime(0, now + attack + sustain + release);
  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + attack + sustain + release + 0.05);
}

function sweep(
  freqStart: number,
  freqEnd: number,
  durationMs: number,
  gain = 0.25,
  type: OscillatorType = "sawtooth",
): void {
  const c = getCtx();
  if (!c || !masterGain) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  const now = c.currentTime;
  osc.frequency.setValueAtTime(freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(20, freqEnd),
    now + durationMs / 1000,
  );
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.05);
}

function drum(durationMs = 80, gain = 0.4, lowpassHz = 2000): void {
  const c = getCtx();
  if (!c || !masterGain) return;
  const buffer = c.createBuffer(1, c.sampleRate * (durationMs / 1000), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = lowpassHz;
  const g = c.createGain();
  const now = c.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  src.connect(filt).connect(g).connect(masterGain);
  src.start(now);
  src.stop(now + durationMs / 1000 + 0.02);
}

function chord(
  freqs: number[],
  durationMs: number,
  gain = 0.18,
  type: OscillatorType = "triangle",
): void {
  freqs.forEach((f) =>
    tone({ freq: f, durationMs, gain, type, attackMs: 12, releaseMs: 100 }),
  );
}

// ============== Sound packs ==============

export type CueName =
  | "countdownTick"
  | "go"
  | "tempoBeep"
  | "setDone"
  | "restEnding"
  | "workoutDone";

interface CueImpl {
  countdownTick: () => void;
  go: () => void;
  tempoBeep: () => void;
  setDone: () => void;
  restEnding: () => void;
  workoutDone: () => void;
}

export interface SoundPack {
  id: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  cues: CueImpl;
}

// Helper: alternating note generator for tempo beeps that should sound musical
const makeAlt = (notes: number[], durationMs: number, gain: number, type: OscillatorType) => {
  let i = 0;
  return () => {
    tone({ freq: notes[i % notes.length], durationMs, gain, type, attackMs: 5, releaseMs: 50 });
    i++;
  };
};

// ---- Pack: Gym (default — punchy with drums) ----
const gym: CueImpl = {
  countdownTick: () => {
    drum(40, 0.35, 4000);
    tone({ freq: 1320, durationMs: 70, gain: 0.3, type: "square" });
  },
  go: () => {
    sweep(220, 880, 200, 0.35, "sawtooth");
    setTimeout(() => chord([523, 659, 784], 250, 0.22, "triangle"), 120);
    setTimeout(() => drum(60, 0.4, 5000), 120);
  },
  tempoBeep: makeAlt([523, 659], 90, 0.2, "triangle"),
  setDone: () => {
    drum(80, 0.3, 1800);
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, durationMs: 140, gain: 0.25, type: "triangle" }), i * 90),
    );
  },
  restEnding: () => {
    tone({ freq: 660, durationMs: 120, gain: 0.25, type: "triangle" });
    setTimeout(() => tone({ freq: 880, durationMs: 200, gain: 0.25, type: "triangle" }), 130);
  },
  workoutDone: () => {
    drum(120, 0.5, 1500);
    const arp = [392, 523, 659, 784, 1047];
    arp.forEach((f, i) =>
      setTimeout(() => tone({ freq: f, durationMs: 130, gain: 0.28, type: "triangle" }), i * 90),
    );
    setTimeout(() => chord([523, 659, 784, 1047], 800, 0.3, "triangle"), arp.length * 90);
    setTimeout(() => drum(150, 0.45, 1200), arp.length * 90);
  },
};

// ---- Pack: Arcade (8-bit chiptune, all square waves) ----
const arcade: CueImpl = {
  countdownTick: () => tone({ freq: 1320, durationMs: 80, gain: 0.3, type: "square" }),
  go: () => {
    // Coin pickup style: rising blippy notes
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(
        () => tone({ freq: f, durationMs: 60, gain: 0.3, type: "square", releaseMs: 30 }),
        i * 50,
      ),
    );
  },
  tempoBeep: () => tone({ freq: 880, durationMs: 50, gain: 0.22, type: "square", releaseMs: 30 }),
  setDone: () => {
    // 1-up sound: classic Mario style
    [659, 784, 1047, 1319, 1568].forEach((f, i) =>
      setTimeout(
        () => tone({ freq: f, durationMs: 80, gain: 0.28, type: "square", releaseMs: 50 }),
        i * 70,
      ),
    );
  },
  restEnding: () => tone({ freq: 1047, durationMs: 100, gain: 0.25, type: "square" }),
  workoutDone: () => {
    // Big 8-bit fanfare
    const melody = [
      [523, 100], [523, 100], [523, 100], [523, 250],
      [415, 250], [466, 250], [523, 100], [466, 100], [523, 250],
    ] as const;
    let t = 0;
    melody.forEach(([f, d]) => {
      setTimeout(() => tone({ freq: f, durationMs: d, gain: 0.28, type: "square", releaseMs: 40 }), t);
      t += d + 40;
    });
  },
};

// ---- Pack: Zen (soft bells, triangles, calm) ----
const zen: CueImpl = {
  countdownTick: () => tone({ freq: 880, durationMs: 200, gain: 0.18, type: "sine", releaseMs: 180 }),
  go: () => {
    // Soft bell + airy chord
    chord([523, 659, 784], 700, 0.15, "sine");
  },
  tempoBeep: () => tone({ freq: 659, durationMs: 200, gain: 0.13, type: "sine", releaseMs: 180 }),
  setDone: () => {
    // Gentle bell pair
    tone({ freq: 784, durationMs: 500, gain: 0.18, type: "sine", releaseMs: 400 });
    setTimeout(
      () => tone({ freq: 1047, durationMs: 700, gain: 0.18, type: "sine", releaseMs: 600 }),
      150,
    );
  },
  restEnding: () => tone({ freq: 784, durationMs: 300, gain: 0.18, type: "sine", releaseMs: 280 }),
  workoutDone: () => {
    // Long shimmer chord, layered
    chord([392, 523, 659, 784, 1047], 1500, 0.16, "sine");
    setTimeout(() => chord([523, 659, 784, 1047], 1200, 0.13, "sine"), 400);
  },
};

// ---- Pack: Whistle (sharp coach whistle vibes) ----
const whistle: CueImpl = {
  countdownTick: () => tone({ freq: 1500, durationMs: 100, gain: 0.32, type: "sine", releaseMs: 50 }),
  go: () => {
    // Sharp whistle blast: short rising whoosh
    sweep(1800, 2400, 150, 0.4, "sine");
    setTimeout(() => sweep(2400, 1800, 100, 0.35, "sine"), 150);
  },
  tempoBeep: () => tone({ freq: 1200, durationMs: 60, gain: 0.22, type: "sine", releaseMs: 40 }),
  setDone: () => {
    // Two ascending whistle blasts
    sweep(1500, 2200, 200, 0.35, "sine");
    setTimeout(() => sweep(1800, 2600, 200, 0.35, "sine"), 220);
  },
  restEnding: () => sweep(1200, 1800, 150, 0.3, "sine"),
  workoutDone: () => {
    // Triple blast
    [0, 250, 500].forEach((delay) =>
      setTimeout(() => sweep(1600, 2400, 200, 0.4, "sine"), delay),
    );
    setTimeout(() => sweep(1800, 2800, 400, 0.45, "sine"), 800);
  },
};

// ---- Pack: Synth (80s pad / sawtooth chord stabs) ----
const synth: CueImpl = {
  countdownTick: () => tone({ freq: 660, durationMs: 100, gain: 0.25, type: "sawtooth", releaseMs: 70 }),
  go: () => {
    sweep(110, 440, 250, 0.3, "sawtooth"); // bass swell
    setTimeout(() => chord([523, 659, 784], 350, 0.2, "sawtooth"), 100); // chord stab
  },
  tempoBeep: makeAlt([440, 554, 659], 100, 0.18, "sawtooth"),
  setDone: () => {
    chord([523, 659, 784], 400, 0.22, "sawtooth");
    setTimeout(() => chord([587, 740, 880], 500, 0.2, "sawtooth"), 200);
  },
  restEnding: () => chord([440, 554], 250, 0.2, "sawtooth"),
  workoutDone: () => {
    // Big 80s anthem feel
    chord([392, 523, 659], 600, 0.22, "sawtooth");
    setTimeout(() => chord([440, 554, 659], 600, 0.22, "sawtooth"), 250);
    setTimeout(() => chord([523, 659, 784, 1047], 1200, 0.25, "sawtooth"), 500);
    setTimeout(() => drum(180, 0.5, 1500), 500);
  },
};

export const SOUND_PACKS: SoundPack[] = [
  { id: "gym", nameZh: "健身房", nameEn: "Gym", emoji: "💪", cues: gym },
  { id: "arcade", nameZh: "复古游戏", nameEn: "Arcade", emoji: "🎮", cues: arcade },
  { id: "zen", nameZh: "禅意", nameEn: "Zen", emoji: "🧘", cues: zen },
  { id: "whistle", nameZh: "教练哨", nameEn: "Whistle", emoji: "📣", cues: whistle },
  { id: "synth", nameZh: "合成器", nameEn: "Synth", emoji: "🎹", cues: synth },
];

// ============== Active pack management ==============

let activePackId: string = SOUND_PACKS[0].id;

export function setSoundPack(id: string): void {
  if (SOUND_PACKS.some((p) => p.id === id)) activePackId = id;
}

export function getActivePackId(): string {
  return activePackId;
}

function activePack(): CueImpl {
  return SOUND_PACKS.find((p) => p.id === activePackId)?.cues ?? gym;
}

// Public: cue interface that delegates to the active pack at call time.
export const cues = {
  countdownTick: () => activePack().countdownTick(),
  go: () => activePack().go(),
  tempoBeep: () => activePack().tempoBeep(),
  setDone: () => activePack().setDone(),
  restEnding: () => activePack().restEnding(),
  workoutDone: () => activePack().workoutDone(),

  // Demo sequence — plays a representative slice of the active pack.
  test: () => {
    cues.countdownTick();
    setTimeout(() => cues.countdownTick(), 400);
    setTimeout(() => cues.countdownTick(), 800);
    setTimeout(() => cues.go(), 1200);
    setTimeout(() => cues.tempoBeep(), 1700);
    setTimeout(() => cues.tempoBeep(), 2000);
    setTimeout(() => cues.tempoBeep(), 2300);
    setTimeout(() => cues.setDone(), 2700);
    setTimeout(() => cues.workoutDone(), 3500);
  },
};
