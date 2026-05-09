# Keep Fit

一个极简、无登录、无广告的训练记录应用 —— 灵感来自 [workout.cool](https://github.com/Snouzy/workout-cool)，但只保留核心功能。

A minimal, no-login, no-ads training tracker — inspired by workout.cool, stripped down to just the core training functionality.

## 功能 / Features

- 📚 **动作库浏览** — 来自 [wger 公共 API](https://wger.de/) 的几百个动作，含图片、肌群、器械标签
- 📝 **自建训练计划** — 选动作、配组数/次数(或时长)/休息
- ⏱️ **训练执行 / 计时器** — 全屏引导，每组结束自动进入休息倒计时，按时间动作自动切换
- 📈 **历史记录** — 总次数、总时长、本周次数；所有数据 100% 存在浏览器 `localStorage`
- 🌐 **中英双语** — 右上角随时切换

## 技术栈 / Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- localStorage（无后端，无数据库，无登录）
- wger.de v2 API（仅读取，无需 key）

## 开发 / Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 生产构建
npm start        # 跑生产构建
```

## 数据说明 / Data notes

- 第一次打开 `/exercises` 会从 wger.de 加载约 600 个动作，缓存 7 天
- 训练计划和历史只存在你这台浏览器里。换浏览器/清缓存就没了
- 想换数据源（自带数据集 / 自己写 JSON）只需改 `lib/wger.ts` 里的 `loadExercises()`

## 加更多动作的中文翻译 / Adding more ZH translations

wger 的数据是英文/拉丁文的，本项目内置了一份手动维护的中文覆盖表，文件：

`lib/exercise-translations.ts`

要给一个动作加中文，往 `exerciseZH` 里追加一条。**key 是 wger 返回的英文名小写**：

```ts
export const exerciseZH = {
  "push-up": {
    name: "俯卧撑",
    description: "起始：双手撑地略宽于肩……",
  },
  // 加新的 ↓
  "your exercise english name lowercase": {
    name: "你的中文名",
    description: "可选的中文说明",
  },
};
```

不知道英文名怎么写？打开浏览器控制台（F12），在动作库页跑：

```js
JSON.parse(localStorage.getItem('mwc.exercises.cache.v2'))
  .exercises.filter(e => e.name.toLowerCase().includes('squat'))
  .map(e => e.name)
```

就能看到所有匹配 squat 的英文名，照抄到 `exerciseZH` 的 key 即可（记得转小写）。

同一文件里还有 `categoryZH` / `muscleZH` / `equipmentZH`，分类、肌群、器械的翻译已经全量覆盖。

## 文件结构 / Layout

```
app/                Next.js 路由
  page.tsx          首页
  exercises/        动作库
  workouts/         训练计划列表 / 新建 / 编辑（URL 路径，UI 显示为 Routines / 训练）
    [id]/run/       计时器 / 执行页
  history/          历史
components/         UI 组件
lib/                i18n、类型、storage、wger client
```

## License

MIT
