# Mixamo → Keep Fit 动作映射

Mixamo 没有可用的下载 API，只能手动从 web 下载 FBX。这个清单告诉你**哪些动作值得花时间下，下哪个文件**。

预计**最多能覆盖 30-60 个**我们 873 个动作的子集 —— 主要是徒手训练和基础抗阻动作。复杂的杠铃 / 哑铃 / 拉索 / 器械动作 Mixamo 不会有专门版本。

## 下载步骤（每个动作）

1. 打开 https://www.mixamo.com 登录（Adobe ID 免费）
2. **Characters** tab，选一个角色：推荐 **Y Bot**（中性、白色蒙皮、干净）
3. **Animations** tab，搜下面表格里的关键词
4. 选中后右侧会弹出预览面板，点 **Download**
5. 弹窗中：
   - Format: **FBX Binary (.fbx)**
   - Skin: **With Skin**
   - Frames per Second: **30**
   - Keyframe Reduction: **none**
6. 把下载的 .fbx **重命名**为表格里的 `target filename`，扔到：
   ```
   ~/my-workout-cool/scripts/blender/mixamo-fbx/
   ```

下完之后跑：

```bash
cd ~/my-workout-cool
blender --background empty.blend \
  --python scripts/blender/mixamo-render.py
```

会自动批渲所有 fbx → `public/exercise-videos/mixamo/<exercise-id>.mp4`。

---

## 建议下载清单（优先级从高到低）

### Tier 1：徒手 + 高频，几乎必有

| Mixamo 搜索关键词 | 备注 | 目标文件名 |
|---|---|---|
| `squat` | 选 "Squat" 或 "Squats"（连续多 rep 的）| `squat.fbx` |
| `push up` | "Push Up", "Push-Up Twist", "Mma Push Up" | `push-up.fbx` |
| `sit up` | "Sit Ups"（连续）| `sit-up.fbx` |
| `crunch` | "Crunch" / "Bicycle Crunch" | `crunch.fbx` |
| `lunge` | "Forward Lunge", "Side Lunge" | `lunge.fbx` |
| `plank` | "Plank" — 静态，能渲染成静帧视频 | `plank.fbx` |
| `mountain climber` | "Mountain Climber"（如果有）| `mountain-climber.fbx` |
| `burpee` | 检查是否完整循环 | `burpee.fbx` |
| `jumping jack` | "Jumping Jacks" | `jumping-jack.fbx` |
| `pull up` | "Pull Up"（注意：默认无单杠，需要后期 P 一根）| `pull-up.fbx` |

### Tier 2：能找到就赚到

| 关键词 | 目标文件名 |
|---|---|
| `dip` | `dip.fbx` |
| `bridge` | `glute-bridge.fbx` |
| `kick` (front/side) | `kick.fbx` |
| `boxing` (jab/cross/hook) | `boxing-jab.fbx` |
| `yoga` (downward dog, warrior, etc.) | 太多了，看见有用的就拿 |
| `stretch` (overhead, hamstring) | `hamstring-stretch.fbx` |
| `jump rope` | `jump-rope.fbx` |
| `running` (in place) | `running-in-place.fbx` |

### Tier 3：Mixamo 没有"杠铃/哑铃/器械"专项

下面这些**别浪费时间找** —— Mixamo 不可能有：

- 杠铃卧推 / 深蹲（Mixamo 没有杠铃道具）
- 哑铃任何动作（同上）
- 拉索（Cable）系列
- 器械（Machine）系列
- 划船机、龙门架等

这些只能继续用我们已有的 Seedance AI 视频。

---

## 建议的实施顺序

**第一步**：下 **2-3 个** Tier 1 的（比如 squat + push-up + sit-up），跑一遍 `mixamo-render.py`，看渲染结果你能不能接受。

**第二步**：如果效果 OK，再下完整 Tier 1（10 个左右）。

**第三步**：根据用户实际用到的训练计划，按需补 Tier 2。

不建议一次性下满清单，因为：
- 每个手动下载要 1-2 分钟（找 + 下载 + 重命名）
- 不同动作风格不一定能匹配 —— 比如 Mixamo 的 squat 可能是 "muscle gain" 风格，跟你 app 的极简调性不搭，先试两个再决定

---

## 把 mp4 接入 app

放完渲好的 mp4 之后，去 `lib/video-manifest.ts` 里：

```ts
export const EXERCISE_VIDEOS: Record<string, string> = {
  "Bodyweight_Squat": "/exercise-videos/mixamo/squat.mp4",
  "Push_Up": "/exercise-videos/mixamo/push-up.mp4",
  // ...
};
```

key 是 `free-exercise-db` 里的英文 ID（小写也可以，看 manifest 里现有的格式照抄）。
