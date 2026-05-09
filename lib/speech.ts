// Thin wrapper around Web Speech API speechSynthesis.
// Designed for use during a follow-along workout: language-aware voice picking,
// a serial queue, cancel-on-demand, and a global mute toggle.

import type { Lang } from "./types";

const LANG_CODE: Record<Lang, string> = {
  zh: "zh-CN",
  en: "en-US",
};

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let muted = false;

function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function getVoices(): SpeechSynthesisVoice[] {
  if (!isSupported()) return [];
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

// Some browsers populate voices asynchronously. Listen once.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const voices = getVoices();
  const target = LANG_CODE[lang];
  // Prefer a local-service voice that matches the exact code, then any starting with the prefix.
  return (
    voices.find((v) => v.lang === target && v.localService) ||
    voices.find((v) => v.lang === target) ||
    voices.find((v) => v.lang.startsWith(target.split("-")[0])) ||
    null
  );
}

export function setMuted(value: boolean): void {
  muted = value;
  if (value && isSupported()) window.speechSynthesis.cancel();
}

export function isMuted(): boolean {
  return muted;
}

export function cancel(): void {
  if (!isSupported()) return;
  window.speechSynthesis.cancel();
}

interface SpeakOptions {
  lang: Lang;
  rate?: number; // 0.1 – 10, default 1
  pitch?: number; // 0 – 2, default 1
  interrupt?: boolean; // cancel queued utterances first
}

export function speak(text: string, opts: SpeakOptions): void {
  if (!isSupported() || muted || !text) return;
  if (opts.interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG_CODE[opts.lang];
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  const voice = pickVoice(opts.lang);
  if (voice) u.voice = voice;
  // Some browsers throw if speechSynthesis is paused; resume defensively.
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  window.speechSynthesis.speak(u);
}

// Helper: warm up the synthesiser. Some browsers gate speech behind a user gesture;
// calling this in response to a click ensures subsequent speak() calls work.
export function warmUp(): void {
  if (!isSupported()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}
