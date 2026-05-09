"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { appendHistory, getSettings, getWorkout, saveSettings, uid } from "@/lib/storage";
import type { AppSettings, HistoryEntry, Workout, WorkoutExercise } from "@/lib/types";
import { localizeName } from "@/lib/exercise-translations";
import { cancel as cancelSpeech, setMuted as setSpeechMuted, speak, warmUp } from "@/lib/speech";
import { cues, setSoundPack, SOUND_PACKS, unlock as unlockAudio } from "@/lib/audio-cues";
import { acquire as acquireWakeLock, release as releaseWakeLock } from "@/lib/wake-lock";
import { isSupported as voiceCtlSupported, listen as listenVoice, type VoiceListener } from "@/lib/voice-control";

type Phase = "idle" | "preparing" | "active" | "rest" | "done";

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function repDuration(p: WorkoutExercise): number {
  // For time-based: reps already represents seconds.
  // For rep-based: secondsPerRep × reps (default 3s/rep).
  if (p.isTimeBased) return p.reps;
  return Math.round((p.secondsPerRep ?? 3) * p.reps);
}

export default function RunPage({ params }: { params: { id: string } }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(0); // generic countdown for all timed phases
  const [settings, setSettingsState] = useState<AppSettings>(() => ({
    voiceEnabled: true,
    beatEnabled: false,
    voiceControlEnabled: false,
    prepareSeconds: 10,
    soundPackId: "gym",
  }));
  const startedAtRef = useRef<number>(Date.now());
  const completedSetsRef = useRef<{ exerciseId: string; exerciseName: string; sets: number }[]>(
    [],
  );
  const voiceListenerRef = useRef<VoiceListener | null>(null);

  // Load workout + settings on mount
  useEffect(() => {
    const w = getWorkout(params.id);
    if (!w) {
      router.replace("/workouts");
      return;
    }
    setWorkout(w);
    setSettingsState(getSettings());
    startedAtRef.current = Date.now();
  }, [params.id, router]);

  // Sync mute state with voice setting
  useEffect(() => {
    setSpeechMuted(!settings.voiceEnabled);
  }, [settings.voiceEnabled]);

  // Push selected sound pack into the audio module so cue calls use it
  useEffect(() => {
    setSoundPack(settings.soundPackId);
  }, [settings.soundPackId]);

  // Acquire wake lock while page is mounted; release on unmount or visibility change
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await acquireWakeLock();
    })();
    const onVis = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void releaseWakeLock();
    };
  }, []);

  // Voice control wiring (opt-in)
  useEffect(() => {
    if (!settings.voiceControlEnabled) {
      voiceListenerRef.current?.stop();
      voiceListenerRef.current = null;
      return;
    }
    voiceListenerRef.current = listenVoice(lang, {
      onPause: () => setPaused(true),
      onResume: () => setPaused(false),
      onSkip: () => {
        // Skip current phase: rest → active, active → set complete
        if (phase === "rest") setRemaining(0);
        else if (phase === "active") finishCurrentSet();
      },
    });
    return () => {
      voiceListenerRef.current?.stop();
      voiceListenerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.voiceControlEnabled, lang, phase]);

  const currentEx: WorkoutExercise | undefined = workout?.exercises[exIdx];

  // Master tick — drives every timed phase
  useEffect(() => {
    if (phase === "idle" || phase === "done" || paused || !currentEx) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          handlePhaseEnd();
          return 0;
        }
        // Audio cue: tick 3-2-1 at the end of preparing or rest (always on, this is core feedback)
        if ((phase === "preparing" || phase === "rest") && r <= 4 && r > 1) {
          cues.countdownTick();
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, currentEx]);

  // Tempo metronome — beeps every `secondsPerRep` during a rep-based active set so
  // the user can pace reps without looking at the screen.
  useEffect(() => {
    if (
      phase !== "active" ||
      paused ||
      !settings.beatEnabled ||
      !currentEx ||
      currentEx.isTimeBased
    ) {
      return;
    }
    const interval = Math.max(1, currentEx.secondsPerRep ?? 3) * 1000;
    const id = window.setInterval(() => cues.tempoBeep(), interval);
    return () => window.clearInterval(id);
  }, [phase, paused, settings.beatEnabled, currentEx]);

  const announceExercise = useCallback(
    (ex: WorkoutExercise, secondsBefore: number) => {
      if (!settings.voiceEnabled) return;
      const name = localizeName(ex.exerciseName, lang);
      const cueKey = ex.isTimeBased ? "prepareCueTime" : "prepareCue";
      speak(
        t(cueKey, { seconds: secondsBefore, name, sets: ex.sets, reps: ex.reps }),
        { lang, interrupt: true },
      );
    },
    [lang, settings.voiceEnabled, t],
  );

  const startWorkout = useCallback(() => {
    if (!workout || workout.exercises.length === 0) return;
    // Critical: this click is the user gesture that unlocks audio + tts
    unlockAudio();
    warmUp();
    setExIdx(0);
    setSetIdx(0);
    setPhase("preparing");
    setRemaining(settings.prepareSeconds);
    startedAtRef.current = Date.now();
    announceExercise(workout.exercises[0], settings.prepareSeconds);
  }, [workout, settings.prepareSeconds, announceExercise]);

  const recordSetCompletion = useCallback((count: number) => {
    if (!currentEx) return;
    const log = completedSetsRef.current;
    const last = log[log.length - 1];
    if (last && last.exerciseId === currentEx.exerciseId) {
      last.sets += count;
    } else {
      log.push({
        exerciseId: currentEx.exerciseId,
        exerciseName: currentEx.exerciseName,
        sets: count,
      });
    }
  }, [currentEx]);

  const finishWorkout = useCallback(() => {
    setPhase("done");
    cues.workoutDone();
    if (settings.voiceEnabled) speak(t("cueWorkoutDone"), { lang, interrupt: true });
    if (!workout) return;
    const completedAt = new Date();
    const entry: HistoryEntry = {
      id: uid(),
      workoutId: workout.id,
      workoutName: workout.name,
      startedAt: new Date(startedAtRef.current).toISOString(),
      completedAt: completedAt.toISOString(),
      durationSeconds: Math.round(
        (completedAt.getTime() - startedAtRef.current) / 1000,
      ),
      completedSets: [...completedSetsRef.current],
    };
    appendHistory(entry);
  }, [workout, settings.voiceEnabled, lang, t]);

  const finishCurrentSet = useCallback(() => {
    if (!workout || !currentEx) return;
    recordSetCompletion(1);
    cues.setDone();
    const isLastSet = setIdx >= currentEx.sets - 1;
    const isLastEx = exIdx === workout.exercises.length - 1;
    if (isLastSet && isLastEx) {
      finishWorkout();
      return;
    }
    if (isLastSet) {
      // Move to next exercise: rest first, then a fresh "preparing" announce of next exercise
      const nextEx = workout.exercises[exIdx + 1];
      if (currentEx.restSeconds > 0) {
        setPhase("rest");
        setRemaining(currentEx.restSeconds);
        if (settings.voiceEnabled) {
          speak(t("cueRest", { n: currentEx.restSeconds }), { lang, interrupt: true });
          speak(t("cueNextExercise", { name: localizeName(nextEx.exerciseName, lang) }), { lang });
        }
      } else {
        // No rest: jump straight into preparing for the next exercise
        setExIdx((i) => i + 1);
        setSetIdx(0);
        setPhase("preparing");
        setRemaining(settings.prepareSeconds);
        announceExercise(nextEx, settings.prepareSeconds);
      }
    } else {
      // Same exercise, next set
      if (currentEx.restSeconds > 0) {
        setPhase("rest");
        setRemaining(currentEx.restSeconds);
        if (settings.voiceEnabled)
          speak(t("cueRest", { n: currentEx.restSeconds }), { lang, interrupt: true });
      } else {
        setSetIdx((s) => s + 1);
        setPhase("active");
        setRemaining(repDuration(currentEx));
        if (settings.voiceEnabled) speak(t("cueGo"), { lang, interrupt: true });
        cues.go();
      }
    }
  }, [
    workout, currentEx, setIdx, exIdx, settings.voiceEnabled, settings.prepareSeconds, lang, t,
    recordSetCompletion, finishWorkout, announceExercise,
  ]);

  const handlePhaseEnd = useCallback(() => {
    if (!workout || !currentEx) return;
    if (phase === "preparing") {
      // Preparing → start active phase of current set
      setPhase("active");
      setRemaining(repDuration(currentEx));
      if (settings.voiceEnabled) speak(t("cueGo"), { lang, interrupt: true });
      cues.go();
    } else if (phase === "active") {
      // Active phase elapsed: this set is done
      finishCurrentSet();
    } else if (phase === "rest") {
      // Rest finished — was this leading into a new exercise or just next set of same?
      const isLastSet = setIdx >= currentEx.sets - 1;
      if (isLastSet) {
        const nextEx = workout.exercises[exIdx + 1];
        if (!nextEx) {
          finishWorkout();
          return;
        }
        setExIdx((i) => i + 1);
        setSetIdx(0);
        setPhase("preparing");
        setRemaining(settings.prepareSeconds);
        announceExercise(nextEx, settings.prepareSeconds);
      } else {
        setSetIdx((s) => s + 1);
        setPhase("active");
        setRemaining(repDuration(currentEx));
        if (settings.voiceEnabled) speak(t("cueGo"), { lang, interrupt: true });
        cues.go();
      }
    }
  }, [
    workout, currentEx, phase, setIdx, exIdx, settings.voiceEnabled, settings.prepareSeconds,
    lang, t, finishCurrentSet, finishWorkout, announceExercise,
  ]);

  const totalSets = useMemo(
    () => (workout ? workout.exercises.reduce((s, e) => s + e.sets, 0) : 0),
    [workout],
  );

  const setsBeforeCurrent = useMemo(
    () => (workout ? workout.exercises.slice(0, exIdx).reduce((s, e) => s + e.sets, 0) : 0),
    [workout, exIdx],
  );

  const completedSetCount = setsBeforeCurrent + setIdx;
  const progressPct = totalSets > 0 ? (completedSetCount / totalSets) * 100 : 0;

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const abandon = () => {
    if (!confirm(t("confirmAbandon"))) return;
    cancelSpeech();
    router.push("/workouts");
  };

  if (!workout || !currentEx) {
    return <p className="text-slate-500">{t("loading")}</p>;
  }

  // ============== Render ==============

  if (phase === "done") {
    const totalSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-5">
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-bold">{t("workoutComplete")}</h1>
        <p className="text-slate-500">
          {t("totalTime")}: <span className="font-mono">{fmt(totalSeconds)}</span>
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/workouts"
            className="px-5 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700"
          >
            {t("backToWorkouts")}
          </Link>
          <Link
            href="/history"
            className="px-5 py-2 rounded-full border border-slate-300 dark:border-slate-700"
          >
            {t("navHistory")}
          </Link>
        </div>
      </div>
    );
  }

  // Idle screen — show settings + Start button (the user gesture that unlocks audio)
  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/workouts" className="text-sm text-slate-500 hover:underline">
            ← {t("back")}
          </Link>
          <div className="text-sm text-slate-500">{workout.name}</div>
        </div>

        <div className="rounded-3xl border border-brand-300 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="text-center">
            <div className="text-4xl">🏋️</div>
            <h1 className="text-2xl font-bold mt-2">{workout.name}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {t("exerciseCount", { n: workout.exercises.length })} ·{" "}
              {totalSets} {t("sets")}
            </p>
          </div>

          <div className="space-y-2">
            <Toggle
              label={t("voiceOn")}
              checked={settings.voiceEnabled}
              onChange={(v) => updateSettings({ voiceEnabled: v })}
            />
            <Toggle
              label={t("beatOn")}
              checked={settings.beatEnabled}
              onChange={(v) => updateSettings({ beatEnabled: v })}
            />
            {voiceCtlSupported() && (
              <Toggle
                label={t("micOn")}
                checked={settings.voiceControlEnabled}
                onChange={(v) => updateSettings({ voiceControlEnabled: v })}
              />
            )}
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1.5">{t("soundPack")}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {SOUND_PACKS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    unlockAudio();
                    updateSettings({ soundPackId: p.id });
                    setSoundPack(p.id);
                    // Quick preview: a representative cue
                    cues.go();
                  }}
                  className={`px-2 py-1.5 rounded-lg border text-xs flex items-center justify-center gap-1 transition ${
                    settings.soundPackId === p.id
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30"
                      : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{p.emoji}</span>
                  <span>{lang === "zh" ? p.nameZh : p.nameEn}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                unlockAudio();
                cues.test();
              }}
              className="px-3 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              🔊 {t("testSound")}
            </button>
            <button
              onClick={() => {
                warmUp();
                speak(t("cueGo"), { lang, interrupt: true });
                setTimeout(
                  () => speak(t("cueWorkoutDone"), { lang }),
                  600,
                );
              }}
              className="px-3 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              💬 {t("testVoice")}
            </button>
          </div>

          <button
            onClick={startWorkout}
            className="w-full px-4 py-3 rounded-full bg-brand-600 text-white text-base font-medium hover:bg-brand-700"
          >
            ▶ {t("startNow")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/workouts" className="text-sm text-slate-500 hover:underline">
          ← {t("back")}
        </Link>
        <div className="text-sm text-slate-500">{workout.name}</div>
      </div>

      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-600 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="text-xs text-slate-500 text-center">
        {t("exerciseN", { n: exIdx + 1, total: workout.exercises.length })} ·{" "}
        {t("setN", { n: setIdx + 1, total: currentEx.sets })}
      </div>

      <div
        className={`rounded-3xl border bg-white dark:bg-slate-900 p-6 ${
          phase === "rest"
            ? "border-amber-300 ring-1 ring-amber-300/40"
            : phase === "preparing"
              ? "border-purple-300 ring-1 ring-purple-300/40"
              : "border-brand-300 ring-1 ring-brand-300/40"
        }`}
      >
        <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center mb-4">
          {currentEx.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentEx.imageUrl}
              alt={localizeName(currentEx.exerciseName, lang)}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-6xl opacity-30">🏋️</span>
          )}
        </div>
        <h2 className="text-2xl font-bold">
          {localizeName(currentEx.exerciseName, lang)}
        </h2>

        {phase === "preparing" && (
          <div className="mt-4 text-center">
            <div className="text-xs uppercase tracking-wider text-purple-600 font-medium">
              {t("preparing")}
            </div>
            <div className="text-7xl font-mono mt-1">{remaining}</div>
            <div className="text-sm text-slate-500 mt-2">
              {currentEx.sets} × {currentEx.reps}
              {currentEx.isTimeBased ? "s" : ""}
            </div>
          </div>
        )}

        {phase === "active" && (
          <div className="mt-4 text-center">
            <div className="text-7xl font-mono">{fmt(remaining)}</div>
            <div className="text-sm text-slate-500 mt-2">
              {currentEx.isTimeBased ? t("duration") : `${currentEx.reps} ${t("reps")}`}
            </div>
          </div>
        )}

        {phase === "rest" && (
          <div className="mt-4 text-center">
            <div className="text-xs uppercase tracking-wider text-amber-600 font-medium">
              {t("restNow")}
            </div>
            <div className="text-7xl font-mono mt-1">{fmt(remaining)}</div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPaused((p) => !p)}
          className="flex-1 px-4 py-3 rounded-full border border-slate-300 dark:border-slate-700 text-base"
        >
          {paused ? "▶ " + t("resume") : "❚❚ " + t("pause")}
        </button>
        {phase === "rest" && (
          <button
            onClick={() => setRemaining(0)}
            className="px-4 py-3 rounded-full bg-amber-500 text-white text-base font-medium hover:bg-amber-600"
          >
            ⏭ {t("skipRest")}
          </button>
        )}
        {phase === "active" && (
          <button
            onClick={finishCurrentSet}
            className="px-4 py-3 rounded-full bg-brand-600 text-white text-base font-medium hover:bg-brand-700"
          >
            ✓ {t("nextSet")}
          </button>
        )}
      </div>

      {/* In-session settings — beat toggle + pack switcher always visible */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              unlockAudio();
              const next = !settings.voiceEnabled;
              updateSettings({ voiceEnabled: next });
            }}
            className={`flex-1 px-3 py-2 rounded-full border text-sm transition ${
              settings.voiceEnabled
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30"
                : "border-slate-300 dark:border-slate-700 text-slate-500"
            }`}
          >
            {settings.voiceEnabled ? "🔊" : "🔇"} {t("voiceOn")}
          </button>
          <button
            onClick={() => {
              unlockAudio();
              const next = !settings.beatEnabled;
              updateSettings({ beatEnabled: next });
              // Audible confirmation when turning on
              if (next) cues.tempoBeep();
            }}
            className={`flex-1 px-3 py-2 rounded-full border text-sm transition ${
              settings.beatEnabled
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30"
                : "border-slate-300 dark:border-slate-700 text-slate-500"
            }`}
          >
            {settings.beatEnabled ? "🎵" : "🎵"} {t("beatOn")}
          </button>
        </div>

        {/* Pack switcher: chips, switch any time */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {SOUND_PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                unlockAudio();
                updateSettings({ soundPackId: p.id });
                setSoundPack(p.id);
                cues.tempoBeep(); // quick sample
              }}
              className={`px-2.5 py-1 rounded-full border text-xs transition ${
                settings.soundPackId === p.id
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30"
                  : "border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={lang === "zh" ? p.nameZh : p.nameEn}
            >
              {p.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={abandon}
          className="text-sm text-red-600 hover:underline"
        >
          {t("abandon")}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm">{label}</span>
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-block w-10 h-6 rounded-full transition ${
          checked ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}
