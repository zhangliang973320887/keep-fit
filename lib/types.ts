// Domain types used across the app.

export type Lang = "zh" | "en";

// Normalized exercise shape consumed by UI (assembled from free-exercise-db).
export interface Exercise {
  id: string; // stable string id, e.g. "Barbell_Squat"
  name: string;
  instructions: string[]; // step-by-step instructions
  category: string; // primary muscle group (used for "部位" filter): chest, back, legs, abdominals...
  type: string; // movement type: strength / cardio / plyometrics / stretching / ...
  level: string; // beginner / intermediate / expert
  mechanic: string | null; // compound / isolation / null
  force: string | null; // push / pull / static / null
  muscles: string[]; // primary muscle names (raw EN keys)
  musclesSecondary: string[];
  equipment: string[]; // equipment names (raw EN keys)
  imageUrl: string | null;
  imageUrls: string[];
}

// User-built workout plan, persisted in localStorage.
export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  imageUrl: string | null;
  sets: number;
  reps: number; // for time-based exercises, treat as seconds (toggle below)
  isTimeBased: boolean;
  restSeconds: number;
  secondsPerRep?: number; // tempo for rep-based auto-advance; default 3
}

// Follow-along settings (persisted globally, not per-workout).
export interface AppSettings {
  voiceEnabled: boolean;
  beatEnabled: boolean;
  voiceControlEnabled: boolean;
  prepareSeconds: number; // pre-workout countdown, default 10
  soundPackId: string; // ID of the audio cue pack, e.g. "gym"
}

export interface Workout {
  id: string;
  name: string;
  description?: string;
  exercises: WorkoutExercise[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// Completed run, saved to history.
export interface HistoryEntry {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  completedSets: { exerciseId: string; exerciseName: string; sets: number }[];
}
