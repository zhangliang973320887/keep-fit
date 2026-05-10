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

## 解剖肌肉高亮 / Muscle anatomy renders

训练页和动作详情弹窗里那对小人偶（前+后视图，红色高亮当前动作激活的肌肉）来自一次性渲染好的 PNG 集合。

**资源**：`public/muscle-anatomy/` 下 70 张 PNG（约 5 MB）：
- `base-{front,back}.png` —— 灰色全身底图
- `<group>-{front,back}.png` —— 灰色全身 + 一组肌肉染红
- `<group>-{front,back}-overlay.png` —— 透明背景，仅红色肌肉（用于多肌群叠加）

`<group>` 是 17 个肌肉键之一：abdominals / abductors / adductors / biceps / calves / chest / forearms / glutes / hamstrings / lats / lower_back / middle_back / neck / quadriceps / shoulders / traps / triceps。

**数据源**：[Z-Anatomy](https://www.z-anatomy.com/)（CC-BY-SA 4.0，作者 Lluís Vinent Juanico）—— 一个开源的 Blender 解剖模型，约 290 MB 的 .blend 文件，包含 894 个独立肌肉网格。

### 重新渲染（可选）

如果想换风格、改颜色、加新肌肉组，需要本地装 Blender + 拿到 Z-Anatomy 文件：

```bash
# 1. 下载 Z-Anatomy
#    去 z-anatomy.com 或 Google Drive 链接（README 里有），下载 Z-Anatomy_Template.zip
#    解压两层 ZIP 后得到 ~290MB 的 Startup.blend

# 2. 在 Blender 里打开
#    File → Open → Startup.blend

# 3. 跑渲染脚本
#    Blender 顶部菜单切到 "Scripting" workspace
#    点 "Open" → 选 scripts/blender/zanatomy-render.py
#    点 "Run Script" 按钮
#    或命令行：
#    blender Startup.blend --python scripts/blender/zanatomy-render.py

# 4. 等渲染（~5-10 分钟，看 GPU）
# 5. 70 张 PNG 自动写到 public/muscle-anatomy/，前端立刻可用
```

### 加新肌肉组

1. 编辑 `scripts/blender/zanatomy-render.py` 顶部的 `CURATED` 字典，加新的 key + 对应 Z-Anatomy mesh 名字
2. 删掉 `scripts/blender/zanatomy-muscle-map.json`（让脚本重建）
3. 跑一遍渲染（也可以只跑增量，编辑 main() 跳过已有的 group）
4. 在 `components/MuscleHighlight.tsx` 的 `MUSCLE_TO_SLUG` 表里加映射
5. 在 `lib/exercise-translations.ts` 的 muscleZH 表里加中文

### 改风格

- **红色更鲜艳/暖**：`zanatomy-render.py` 顶部 `mat_red.diffuse_color = (0.9, 0.15, 0.15, 1.0)` → 改成你的颜色
- **骨头颜色**：`mat_bone` 默认 `(0.92, 0.90, 0.84, 1.0)` 米白色
- **背景换成深色**：`scene.render.film_transparent = False` + 设 world background
- **改光照风格**：`scene.display.shading.light = "STUDIO"` → `"FLAT"` / `"MATCAP"`
- **更高分辨率**：`RES_X, RES_Y = 400, 600` → 800, 1200
- **回到透视相机**（不推荐，会出现腿短头大）：`USE_ORTHOGRAPHIC = False`
- **改正交画幅**：`ORTHO_SCALE = 1.85` 相当于相机能看到的垂直高度（米）；调大显得更小/留白多
- **加更多颅骨细节**：`SKULL_BONE_PATTERNS` 加 `"Sphenoid"` / `"Ethmoid"` / `"Vomer"` / `"Hyoid"` 等

### 节拍呼吸动画

跟练训练时（active 阶段、按次数动作），高亮肌肉会按 `secondsPerRep` 节奏脉动透明度，CSS 动画在 `app/globals.css` 里的 `@keyframes muscle-pulse`。代码层在 `components/MuscleHighlight.tsx` 的 `pulseSeconds` prop。

## 文件结构 / Layout

```
app/                Next.js 路由
  page.tsx          首页
  exercises/        动作库
  workouts/         训练计划列表 / 新建 / 编辑
    [id]/run/       计时器 / 执行页
  history/          历史
  manifest.ts       PWA manifest
components/         UI 组件（含 MuscleHighlight）
lib/                i18n、类型、storage、free-exercise-db client、speech、audio-cues
public/             静态资源
  muscle-anatomy/   Z-Anatomy 渲染的 70 张 PNG
  exercise-videos/  Seedance 生成的动作视频（按需）
  icon.svg / sw.js  PWA 资源
scripts/
  export-exercises.mjs    导出 873 个动作的元数据
  seedance-batch.mjs      批量调 Seedance API 生成视频
  blender/
    zanatomy-render.py            Z-Anatomy → 肌肉高亮 PNG 的渲染脚本
    zanatomy-muscle-map.json      17 肌肉键 → Z-Anatomy mesh 名字的映射
  deploy.sh / update.sh   服务器部署脚本（PM2）
ecosystem.config.js       PM2 配置
nginx.conf.example        Nginx 反向代理示例
```

## 部署到 Linux VPS / Deploy to Linux VPS

> 已经准备好了 PM2 + 三个一键脚本。前提：服务器上有 Node 18+ 和 git。

### 第一次部署

```bash
# 1. 把代码拉到服务器（任意目录）
git clone <your-repo-url> ~/keep-fit
cd ~/keep-fit

# 2. 一键安装+构建+用 PM2 起来
./scripts/deploy.sh
```

脚本会：
1. 检查 Node 版本（< 18 直接拒绝并告诉你怎么装）
2. 没 PM2 自动 `npm install -g pm2`
3. `npm ci` 干净装依赖
4. `npm run build` 生产构建
5. `pm2 start ecosystem.config.js` 起进程，存到 `pm2 save`

跑完应用就在 `http://localhost:3000`。

### 开机自启

部署完跑一次：

```bash
pm2 startup    # 复制粘贴它打印的那条 sudo 命令执行
pm2 save
```

之后服务器重启 PM2 会自动把 keep-fit 拉起来。

### 之后更新代码

```bash
cd ~/keep-fit
./scripts/update.sh
```

脚本做的事：`git pull` → `npm ci` → `npm run build` → `pm2 reload`（零停机重载）。

### 常用 PM2 命令

```bash
pm2 status keep-fit         # 看状态
pm2 logs keep-fit           # 实时日志
pm2 logs keep-fit --lines 200
pm2 restart keep-fit        # 强制重启
pm2 stop keep-fit           # 停掉
pm2 delete keep-fit         # 卸载
pm2 monit                   # 类似 htop 的实时监控
```

### 日志轮转

防止日志撑爆磁盘：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Nginx 反向代理 + HTTPS

`nginx.conf.example` 里已经有现成模板。改完域名后：

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/keep-fit
sudo vim /etc/nginx/sites-available/keep-fit  # 改 server_name
sudo ln -s /etc/nginx/sites-available/keep-fit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Let's Encrypt 一键 HTTPS
sudo certbot --nginx -d keepfit.example.com
```

### 健康检查

```bash
./scripts/healthcheck.sh   # 0=OK, 非 0=挂了
```

可塞进 cron 里 + 触发邮件/钉钉报警。

### 防火墙

只用 80/443，不直接暴露 3000：

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## License

MIT
