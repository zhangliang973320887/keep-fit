// Manual EN → ZH translations layered on top of the free-exercise-db dataset.
// Lookup is case-insensitive on the English exercise name / muscle / equipment.
// Add new entries freely — anything missing falls back to the original English.

import type { Lang } from "./types";

// === Categories (= primaryMuscles[0] from free-exercise-db) ============
// Used by the "部位" dropdown.
const categoryZH: Record<string, string> = {
  abdominals: "腹肌",
  abductors: "髋外展肌",
  adductors: "髋内收肌",
  biceps: "二头肌",
  calves: "小腿",
  chest: "胸肌",
  forearms: "前臂",
  glutes: "臀肌",
  hamstrings: "腘绳肌",
  lats: "背阔肌",
  "lower back": "下背部",
  "middle back": "中背部",
  neck: "颈部",
  quadriceps: "股四头肌",
  shoulders: "三角肌",
  traps: "斜方肌",
  triceps: "三头肌",
  // movement type fallbacks (in case primaryMuscles is empty)
  cardio: "有氧",
  stretching: "拉伸",
  plyometrics: "爆发力",
  strongman: "力量训练",
  powerlifting: "力量举",
  "olympic weightlifting": "奥举",
  strength: "力量",
};

// === Muscles (same vocabulary as categoryZH above) =====================
const muscleZH: Record<string, string> = { ...categoryZH };

// === Equipment ========================================================
const equipmentZH: Record<string, string> = {
  "body only": "徒手",
  machine: "器械",
  other: "其他",
  "foam roll": "泡沫轴",
  kettlebells: "壶铃",
  dumbbell: "哑铃",
  cable: "绳索",
  barbell: "杠铃",
  bands: "弹力带",
  "medicine ball": "药球",
  "exercise ball": "瑞士球",
  "e-z curl bar": "曲杠",
};

// === Movement types (the dataset's `category` field) ===================
const typeZH: Record<string, string> = {
  strength: "力量",
  stretching: "拉伸",
  plyometrics: "爆发力",
  strongman: "力量训练",
  powerlifting: "力量举",
  cardio: "有氧",
  "olympic weightlifting": "奥举",
};

// === Levels ===========================================================
const levelZH: Record<string, string> = {
  beginner: "入门",
  intermediate: "进阶",
  expert: "高级",
};

// === Exercise names + descriptions ===================================
// Keys are lowercased English names exactly as the dataset returns them.
// "instructions" is optional — when omitted, the EN instructions are shown.
export const exerciseZH: Record<
  string,
  { name: string; instructions?: string[] }
> = {
  // ---- Squats ----
  "barbell squat": {
    name: "杠铃深蹲",
    instructions: [
      "杠铃放置斜方肌中部，双手握住杠铃略宽于肩。",
      "双脚与肩同宽站立，脚尖略外展，挺胸收腹。",
      "屈髋屈膝下蹲至大腿与地面平行或更深，脊柱保持中立。",
      "蹬地起身回到起始位，膝盖方向与脚尖一致。",
    ],
  },
  "barbell full squat": { name: "杠铃全深蹲" },
  "bodyweight squat": {
    name: "徒手深蹲",
    instructions: [
      "双脚与肩同宽，脚尖略外展。",
      "屈髋屈膝下蹲至大腿平行地面，脊柱中立。",
      "蹬地起身，全程保持核心紧绷。",
    ],
  },
  "box squat": { name: "箱式深蹲" },
  "front squat": { name: "前蹲" },
  "goblet squat": { name: "高脚杯深蹲" },
  "hack squat": { name: "哈克深蹲" },
  "overhead squat": { name: "颈前推举深蹲" },
  "pistol squat": { name: "单腿蹲" },
  "split squat": { name: "分腿蹲" },
  "bulgarian split squat": { name: "保加利亚分腿蹲" },
  "sumo squat": { name: "相扑深蹲" },
  "smith machine squat": { name: "史密斯架深蹲" },

  // ---- Deadlifts ----
  "barbell deadlift": {
    name: "杠铃硬拉",
    instructions: [
      "杠铃靠近小腿，双脚与髋同宽，双手与肩同宽握杠。",
      "挺胸沉肩，背部保持平直，髋部低于肩部。",
      "蹬地起身，杠铃沿腿前侧匀速上升至直立。",
      "缓慢屈髋屈膝下放杠铃，全程保持腰背中立。",
    ],
  },
  "romanian deadlift": { name: "罗马尼亚硬拉" },
  "stiff-legged barbell deadlift": { name: "直腿硬拉" },
  "sumo deadlift": { name: "相扑硬拉" },
  "trap bar deadlift": { name: "六角杠硬拉" },
  "single-leg deadlift": { name: "单腿硬拉" },

  // ---- Presses (chest) ----
  "barbell bench press - medium grip": {
    name: "杠铃卧推",
    instructions: [
      "仰卧在卧推凳上，双脚踩地稳定。",
      "双手握杠略宽于肩，挺胸沉肩，肩胛骨后收下沉。",
      "缓慢下放杠铃至胸部中下沿，肘部约 45 度展开。",
      "蹬腿稳定，胸肌发力推起杠铃至手臂伸直。",
    ],
  },
  "dumbbell bench press": { name: "哑铃卧推" },
  "incline dumbbell press": { name: "上斜哑铃卧推" },
  "decline dumbbell bench press": { name: "下斜哑铃卧推" },
  "incline bench press": { name: "上斜杠铃卧推" },
  "decline barbell bench press": { name: "下斜杠铃卧推" },
  "close-grip barbell bench press": { name: "窄握杠铃卧推" },
  "dumbbell flyes": {
    name: "哑铃飞鸟",
    instructions: [
      "仰卧凳上，双手各持一只哑铃于胸前正上方，掌心相对。",
      "微屈肘，沿弧线向两侧缓慢下放至大臂与地面平行。",
      "胸肌发力将哑铃沿原弧线带回起始位，顶峰挤压一秒。",
    ],
  },
  "incline dumbbell flyes": { name: "上斜哑铃飞鸟" },
  "cable crossover": { name: "绳索夹胸" },
  "pushups": {
    name: "俯卧撑",
    instructions: [
      "双手撑地略宽于肩，身体成一条直线，核心紧绷。",
      "屈肘下放至胸部接近地面，肘部沿身体方向。",
      "胸肌发力推起，回到起始位，全程匀速。",
    ],
  },
  "pushups - close triceps position": { name: "窄距俯卧撑" },
  "wide-grip pushup": { name: "宽距俯卧撑" },
  "decline push-up": { name: "上斜俯卧撑" },
  "incline push-up": { name: "下斜俯卧撑" },
  "diamond pushup": { name: "钻石俯卧撑" },

  // ---- Pull / row ----
  "pull-up": {
    name: "引体向上",
    instructions: [
      "双手正握单杠，握距略宽于肩，身体悬挂。",
      "肩胛下沉后收，背阔肌发力将身体拉起至下巴过杠。",
      "控制下放至完全悬挂，全程避免摆动。",
    ],
  },
  "wide-grip pull-up": { name: "宽距引体向上" },
  "chin-up": { name: "反握引体向上" },
  "lat pulldown": { name: "高位下拉" },
  "wide-grip lat pulldown": { name: "宽握高位下拉" },
  "close-grip lat pulldown": { name: "窄握高位下拉" },
  "bent over barbell row": {
    name: "俯身杠铃划船",
    instructions: [
      "双脚与肩同宽，屈髋至上身约 45 度，脊柱中立。",
      "双手握杠略宽于肩，杠铃自然悬于膝下。",
      "肘部贴身，背部发力将杠铃拉至腹部。",
      "缓慢下放，全程保持核心紧绷。",
    ],
  },
  "one-arm dumbbell row": { name: "单臂哑铃划船" },
  "seated cable rows": { name: "坐姿绳索划船" },
  "t-bar row": { name: "T 杠划船" },
  "inverted row": { name: "斜身引体（澳式引体）" },
  "face pull": { name: "面拉" },

  // ---- Shoulders ----
  "overhead press": {
    name: "站姿推举",
    instructions: [
      "杠铃置于锁骨前，双手略宽于肩。",
      "蹬地稳定核心，垂直推举至手臂伸直，头部前移过杠下。",
      "控制下放至胸前，全程保持核心收紧。",
    ],
  },
  "dumbbell shoulder press": { name: "哑铃肩推" },
  "arnold press": { name: "阿诺德推举" },
  "side lateral raise": {
    name: "哑铃侧平举",
    instructions: [
      "双手各持一只哑铃自然下垂于身体两侧，微屈肘。",
      "三角肌中束发力将哑铃沿弧线举至与肩同高。",
      "顶峰停顿一秒，缓慢下放至起始位。",
    ],
  },
  "front dumbbell raise": { name: "哑铃前平举" },
  "reverse flyes": { name: "反向飞鸟" },
  "upright barbell row": { name: "杠铃直立划船" },
  "barbell shrug": { name: "杠铃耸肩" },
  "dumbbell shrug": { name: "哑铃耸肩" },

  // ---- Arms ----
  "barbell curl": { name: "杠铃弯举" },
  "dumbbell bicep curl": { name: "哑铃弯举" },
  "hammer curls": { name: "哑铃锤式弯举" },
  "preacher curl": { name: "牧师凳弯举" },
  "concentration curls": { name: "集中弯举" },
  "ez-bar curl": { name: "曲杠弯举" },
  "tricep dumbbell kickback": { name: "哑铃臂屈伸" },
  "tricep pushdown": { name: "绳索下压" },
  "skull crusher": { name: "头部碎骨者（窄距推举）" },
  "dips - triceps version": { name: "双杠臂屈伸（三头版）" },
  "bench dips": { name: "凳上臂屈伸" },

  // ---- Legs (other) ----
  "leg press": { name: "腿举机" },
  "leg extensions": { name: "坐姿腿屈伸" },
  "leg curl": { name: "俯卧勾腿" },
  "lying leg curls": { name: "俯卧腿弯举" },
  "seated leg curl": { name: "坐姿腿弯举" },
  "stiff-legged dumbbell deadlift": { name: "哑铃直腿硬拉" },
  "lunge": { name: "箭步蹲" },
  "dumbbell lunges": { name: "哑铃箭步蹲" },
  "barbell lunge": { name: "杠铃箭步蹲" },
  "walking lunge": { name: "行走箭步蹲" },
  "reverse lunge": { name: "后撤箭步蹲" },
  "side lunge": { name: "侧弓步" },
  "step-up with knee raise": { name: "登台阶提膝" },
  "barbell hip thrust": {
    name: "杠铃臀冲",
    instructions: [
      "上背靠在卧推凳上，杠铃压在髋部。",
      "屈膝双脚踩地，脚跟用力。",
      "绷臀将髋部向上顶至躯干与大腿成一线。",
      "缓慢回落，避免腰部代偿。",
    ],
  },
  "glute bridge": { name: "臀桥" },

  // ---- Calves ----
  "standing calf raises": { name: "站姿提踵" },
  "seated calf raise": { name: "坐姿提踵" },
  "donkey calf raises": { name: "驴式提踵" },

  // ---- Abs / core ----
  "crunches": {
    name: "卷腹",
    instructions: [
      "仰卧屈膝，双脚踩地，双手交叠胸前或轻扶头侧。",
      "腹肌发力卷起上背，下背始终贴地。",
      "顶峰停顿一秒，控制下放。",
    ],
  },
  "decline crunch": { name: "下斜卷腹" },
  "bicycle crunch": { name: "自行车卷腹" },
  "plank": {
    name: "平板支撑",
    instructions: [
      "前臂着地，肘关节正于肩下，双脚与髋同宽。",
      "身体成一条直线，核心、臀肌、腿肌全部收紧。",
      "保持均匀呼吸，避免塌腰或撅臀。",
    ],
  },
  "side plank": { name: "侧平板支撑" },
  "russian twist": { name: "俄罗斯转体" },
  "ab roller": { name: "腹肌轮" },
  // Aliases for legacy wger exercise names that may still appear in saved history
  "ab wheel": { name: "腹肌轮" },
  "1-arm half-kneeling lat pulldown": { name: "单手半跪姿高位下拉" },
  "hanging leg raise": { name: "悬垂举腿" },
  "leg raises": { name: "仰卧举腿" },
  "mountain climbers": {
    name: "登山者",
    instructions: [
      "起始为高位平板支撑姿势，手撑地略宽于肩。",
      "快速交替将膝盖向胸前提起，模拟跑步。",
      "保持髋部稳定，核心始终紧绷。",
    ],
  },
  "burpee": {
    name: "波比跳",
    instructions: [
      "站立，下蹲双手撑地。",
      "双脚向后跳成平板支撑。",
      "可加一个俯卧撑，再跳回蹲姿。",
      "起身向上跳跃，双手过头。",
    ],
  },

  // ---- Cardio / plyo ----
  "jumping rope": { name: "跳绳" },
  "jumping jacks": { name: "开合跳" },
  "high knees": { name: "高抬腿" },
  "box jump": { name: "箱跳" },
  "running, treadmill": { name: "跑步机跑步" },
  "stationary bike": { name: "动感单车" },
  "rowing, stationary": { name: "划船机" },
};

// === Helpers ========================================================
function titleCase(s: string): string {
  return (s ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
}

const lookup = (map: Record<string, string>, en: string, lang: Lang) => {
  if (lang !== "zh") return titleCase(en);
  const key = (en ?? "").toLowerCase().trim();
  return map[key] ?? en;
};

export function localizeName(enName: string, lang: Lang): string {
  if (lang !== "zh") return enName;
  const key = (enName ?? "").toLowerCase().trim();
  return exerciseZH[key]?.name ?? enName;
}

export function localizeInstructions(
  enName: string,
  enInstructions: string[],
  lang: Lang,
): string[] {
  if (lang !== "zh") return enInstructions;
  const key = (enName ?? "").toLowerCase().trim();
  return exerciseZH[key]?.instructions ?? enInstructions;
}

export function localizeCategory(en: string, lang: Lang): string {
  return lookup(categoryZH, en, lang);
}

export function localizeMuscle(en: string, lang: Lang): string {
  return lookup(muscleZH, en, lang);
}

export function localizeEquipment(en: string, lang: Lang): string {
  return lookup(equipmentZH, en, lang);
}

export function localizeType(en: string, lang: Lang): string {
  return lookup(typeZH, en, lang);
}

export function localizeLevel(en: string, lang: Lang): string {
  return lookup(levelZH, en, lang);
}

export function localizeMuscleList(list: string[], lang: Lang): string[] {
  return list.map((m) => localizeMuscle(m, lang));
}

export function localizeEquipmentList(list: string[], lang: Lang): string[] {
  return list.map((e) => localizeEquipment(e, lang));
}
