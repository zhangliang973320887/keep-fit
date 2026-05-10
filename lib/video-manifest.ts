// Video URL lookup keyed by exercise ID (e.g. "Barbell_Squat").
// Add entries here as you generate videos via scripts/seedance-batch.mjs,
// or run scripts/build-video-manifest.mjs (TODO) to auto-fill from
// public/exercise-videos/*.mp4.
//
// All videos are assumed to be VIDEO_DURATION_SEC long, single-rep loopable.
// If you generate at a different duration, bump the constant.

export const VIDEO_DURATION_SEC = 4;

export const videoManifest: Record<string, string> = {
  // "Barbell_Squat": "/exercise-videos/Barbell_Squat.mp4",
  // "Pushups": "/exercise-videos/Pushups.mp4",
  // ... add as you generate
};

export function getVideoUrl(exerciseId: string): string | null {
  return videoManifest[exerciseId] ?? null;
}

export function hasVideo(exerciseId: string): boolean {
  return exerciseId in videoManifest;
}
