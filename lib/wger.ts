// Legacy entry point: re-export the free-exercise-db client.
// This keeps existing imports working while the underlying data source has moved.
// (We migrated away from wger.de because <30% of its 600 exercises had images.)
export { loadExercises, getCacheTimestamp } from "./free-exercise-db";
