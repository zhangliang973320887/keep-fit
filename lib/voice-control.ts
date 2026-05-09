// Continuous SpeechRecognition listener that fires callbacks when the user says
// configured keywords (e.g. "暂停", "pause"). Browser support is limited
// (Chrome / Edge / Safari behind a flag); falls back to a no-op elsewhere.

import type { Lang } from "./types";

interface MinimalRecognitionResult {
  transcript: string;
}
interface MinimalRecognitionAlt {
  [index: number]: MinimalRecognitionResult;
}
interface MinimalRecognitionEvent {
  resultIndex: number;
  results: { [index: number]: MinimalRecognitionAlt & { isFinal: boolean } };
}
interface MinimalRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: MinimalRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface VoiceWindow extends Window {
  SpeechRecognition?: new () => MinimalRecognition;
  webkitSpeechRecognition?: new () => MinimalRecognition;
}

const KEYWORDS: Record<Lang, { pause: string[]; resume: string[]; skip: string[] }> = {
  zh: {
    pause: ["暂停", "停一下", "停下"],
    resume: ["继续", "开始", "走"],
    skip: ["跳过", "下一个"],
  },
  en: {
    pause: ["pause", "stop", "hold on"],
    resume: ["resume", "continue", "go", "start"],
    skip: ["skip", "next"],
  },
};

export function isSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as VoiceWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface Handlers {
  onPause?: () => void;
  onResume?: () => void;
  onSkip?: () => void;
}

export interface VoiceListener {
  stop: () => void;
}

export function listen(lang: Lang, handlers: Handlers): VoiceListener | null {
  if (!isSupported()) return null;
  const w = window as unknown as VoiceWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang === "zh" ? "zh-CN" : "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  const kws = KEYWORDS[lang];
  const matchAny = (text: string, words: string[]) =>
    words.some((w) => text.includes(w));

  let stopped = false;

  rec.onresult = (e) => {
    // Iterate new results since last index
    for (let i = e.resultIndex; i < Object.keys(e.results).length; i++) {
      const alt = e.results[i];
      if (!alt) continue;
      const transcript = (alt[0]?.transcript ?? "").toLowerCase().trim();
      if (!transcript) continue;
      if (matchAny(transcript, kws.pause)) handlers.onPause?.();
      else if (matchAny(transcript, kws.resume)) handlers.onResume?.();
      else if (matchAny(transcript, kws.skip)) handlers.onSkip?.();
    }
  };

  rec.onerror = () => {
    // ignore — we'll restart in onend
  };

  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start();
      } catch {
        // ignore; some Chrome versions throw if start() is called too quickly
      }
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    },
  };
}
