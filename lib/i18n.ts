import type { Lang } from "./types";

// Flat key -> { zh, en }. Add new strings here, reference via t(key, lang).
const dict = {
  appName: { zh: "Keep Fit", en: "Keep Fit" },
  appTagline: {
    zh: "纯粹、无登录、无广告的训练记录工具",
    en: "Pure training tracker, no login, no ads",
  },

  // Nav
  navHome: { zh: "首页", en: "Home" },
  navExercises: { zh: "动作库", en: "Exercises" },
  navWorkouts: { zh: "我的训练", en: "Routines" },
  navHistory: { zh: "历史记录", en: "History" },

  // Home
  homeTitle: { zh: "今天练点什么？", en: "What are you training today?" },
  homeBrowseExercises: { zh: "浏览动作库", en: "Browse exercises" },
  homeBrowseExercisesSub: { zh: "数百个动作含图片说明", en: "Hundreds of exercises with images" },
  homeBuildWorkout: { zh: "搭建训练计划", en: "Build a routine" },
  homeBuildWorkoutSub: { zh: "组合动作、配置组数和休息", en: "Combine moves, set sets and rest" },
  homeStartWorkout: { zh: "开始训练", en: "Start training" },
  homeRecentHistory: { zh: "最近训练", en: "Recent sessions" },
  homeNoHistory: { zh: "还没有训练记录，先去搭一份计划吧。", en: "No sessions yet — build a plan first." },
  homeQuickActions: { zh: "快捷入口", en: "Quick actions" },

  // Exercise list
  searchPlaceholder: { zh: "搜索动作（中英文均可）...", en: "Search exercises..." },
  filterCategory: { zh: "部位", en: "Category" },
  filterEquipment: { zh: "器械", en: "Equipment" },
  filterLevel: { zh: "难度", en: "Level" },
  filterType: { zh: "类型", en: "Type" },
  filterAll: { zh: "全部", en: "All" },
  resetFilters: { zh: "重置筛选", en: "Reset filters" },
  loading: { zh: "加载中...", en: "Loading..." },
  loadingExercises: { zh: "正在从 wger 加载动作库（首次会久一点）...", en: "Loading exercises from wger (first run is slower)..." },
  errorLoading: { zh: "加载失败，请检查网络后刷新。", en: "Load failed. Check your network and refresh." },
  resultsCount: { zh: "找到 {n} 个动作", en: "{n} exercise{s} found" },
  refresh: { zh: "刷新数据", en: "Refresh data" },

  // Exercise detail / card
  primaryMuscles: { zh: "主要肌群", en: "Primary muscles" },
  secondaryMuscles: { zh: "辅助肌群", en: "Secondary muscles" },
  equipment: { zh: "器械", en: "Equipment" },
  description: { zh: "说明", en: "Description" },
  noDescription: { zh: "（无说明）", en: "(no description)" },
  addToWorkout: { zh: "加入计划", en: "Add to routine" },
  added: { zh: "已加入", en: "Added" },

  // Routines
  myWorkouts: { zh: "我的训练计划", en: "My routines" },
  newWorkout: { zh: "新建计划", en: "New routine" },
  noWorkouts: { zh: "还没有训练计划。点 \"新建计划\" 开始搭建。", en: "No routines yet. Click \"New routine\" to build one." },
  exerciseCount: { zh: "{n} 个动作", en: "{n} exercise{s}" },
  workoutCount: { zh: "{n} 个计划", en: "{n} routine{s}" },
  // Duration / counters
  unitMinutes: { zh: "{n} 分钟", en: "{n} min" },
  unitSeconds: { zh: "{n} 秒", en: "{n}s" },
  unitMinSec: { zh: "{m} 分 {s} 秒", en: "{m}m {s}s" },
  unitSets: { zh: "{n} 组", en: "{n} sets" },
  unitSessions: { zh: "{n} 次", en: "{n}" },
  // Stats card sub-labels (suffix shown next to the big number)
  unitMin: { zh: "分钟", en: "min" },
  unitSec: { zh: "秒", en: "s" },
  unitTimes: { zh: "次", en: "" },
  workoutName: { zh: "计划名", en: "Routine name" },
  workoutNamePlaceholder: { zh: "例如：胸+三头", en: "e.g. Push day" },
  workoutDescription: { zh: "备注（可选）", en: "Notes (optional)" },
  pickExercises: { zh: "选择动作", en: "Pick exercises" },
  selectedExercises: { zh: "已选动作", en: "Selected exercises" },
  noExercisesYet: { zh: "还没选动作，先去动作库勾选。", en: "No exercises picked yet. Add some from the library." },
  sets: { zh: "组数", en: "Sets" },
  reps: { zh: "次数", en: "Reps" },
  duration: { zh: "时长(秒)", en: "Duration (s)" },
  rest: { zh: "组间休息(秒)", en: "Rest (s)" },
  tempo: { zh: "节奏(秒/次)", en: "Tempo (s/rep)" },
  timeBased: { zh: "按时间", en: "Time-based" },
  remove: { zh: "移除", en: "Remove" },
  saveWorkout: { zh: "保存计划", en: "Save routine" },
  saved: { zh: "已保存", en: "Saved" },
  startNow: { zh: "开始训练", en: "Start now" },
  delete: { zh: "删除", en: "Delete" },
  confirmDelete: { zh: "确定删除？", en: "Delete this?" },
  edit: { zh: "编辑", en: "Edit" },
  back: { zh: "返回", en: "Back" },

  // Run / timer
  preparing: { zh: "准备", en: "Get ready" },
  prepareCue: {
    zh: "{seconds} 秒后开始，准备：{name}，共 {sets} 组，每组 {reps} 次",
    en: "Starting in {seconds} seconds. Get ready for: {name}, {sets} sets of {reps}",
  },
  prepareCueTime: {
    zh: "{seconds} 秒后开始，准备：{name}，共 {sets} 组，每组 {reps} 秒",
    en: "Starting in {seconds} seconds. Get ready for: {name}, {sets} sets of {reps} seconds",
  },
  cueGo: { zh: "开始", en: "Go" },
  cueSetDone: { zh: "完成本组", en: "Set complete" },
  cueRest: { zh: "休息 {n} 秒", en: "Rest {n} seconds" },
  cueRestEnding: { zh: "准备下一组", en: "Get ready for the next set" },
  cueNextExercise: {
    zh: "下一个动作：{name}",
    en: "Next exercise: {name}",
  },
  cueWorkoutDone: { zh: "训练完成，做得好", en: "Workout complete, good job" },
  voiceOn: { zh: "语音", en: "Voice" },
  beatOn: { zh: "节拍", en: "Beat" },
  micOn: { zh: "语音控制", en: "Voice control" },
  settings: { zh: "设置", en: "Settings" },
  testSound: { zh: "试听音效", en: "Test sound" },
  testVoice: { zh: "试听语音", en: "Test voice" },
  soundPack: { zh: "音效库", en: "Sound pack" },
  videoMode: { zh: "动画演示", en: "Video demo" },
  imageMode: { zh: "静态图", en: "Static image" },
  videoSpeed: { zh: "播放速度", en: "Speed" },
  videoSpeedAuto: { zh: "自动", en: "Auto" },
  videoSpeedHint: {
    zh: "自动 = 跟随节拍。手动可在跟练时学习/复习",
    en: "Auto = sync to tempo. Override for slow-mo learning",
  },
  exerciseN: { zh: "第 {n} / {total} 个动作", en: "Exercise {n} / {total}" },
  setN: { zh: "第 {n} / {total} 组", en: "Set {n} / {total}" },
  restNow: { zh: "休息中", en: "Resting" },
  pause: { zh: "暂停", en: "Pause" },
  resume: { zh: "继续", en: "Resume" },
  skipRest: { zh: "跳过休息", en: "Skip rest" },
  nextSet: { zh: "完成本组", en: "Set done" },
  nextExercise: { zh: "下一个动作", en: "Next exercise" },
  finishWorkout: { zh: "完成训练", en: "Finish routine" },
  workoutComplete: { zh: "训练完成！", en: "Routine complete!" },
  totalTime: { zh: "总用时", en: "Total time" },
  backToWorkouts: { zh: "回到训练列表", en: "Back to routines" },
  abandon: { zh: "放弃本次训练", en: "Abandon session" },
  confirmAbandon: { zh: "确定放弃这次训练吗？", en: "Abandon this session?" },

  // History
  historyTitle: { zh: "训练历史", en: "History" },
  noHistory: { zh: "还没有训练记录。", en: "No sessions recorded yet." },
  totalSessions: { zh: "总训练次数", en: "Total sessions" },
  totalMinutes: { zh: "总训练时长", en: "Total minutes" },
  thisWeek: { zh: "本周", en: "This week" },
  clearHistory: { zh: "清空历史", en: "Clear history" },
  confirmClearHistory: { zh: "清空所有训练历史？此操作不可撤销。", en: "Clear all history? This cannot be undone." },
} as const;

export type TKey = keyof typeof dict;

export function t(key: TKey, lang: Lang, vars?: Record<string, string | number>): string {
  let s: string = dict[key]?.[lang] ?? dict[key]?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
    // English plural helper: {s} → "" when n===1, "s" otherwise.
    // Chinese has no plural form so {s} is always blank.
    if (typeof vars.n === "number") {
      const suffix = lang === "en" && vars.n !== 1 ? "s" : "";
      s = s.replace(/\{s\}/g, suffix);
    }
  }
  // Strip any leftover {s} markers (e.g. when n wasn't passed).
  s = s.replace(/\{s\}/g, "");
  return s;
}
