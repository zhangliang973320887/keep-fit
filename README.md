# Keep Fit

一个极简、无广告的训练记录应用 —— 灵感来自 [workout.cool](https://github.com/Snouzy/workout-cool)，但只保留核心功能。

A minimal, no-ads training tracker — inspired by workout.cool, stripped down to just the core training functionality.

## 功能 / Features

- 📚 **动作库浏览** — 来自 [free-exercise-db](https://github.com/yuhonas/free-exercise-db) 的 873 个动作，含图片、肌群、器械标签
- 📝 **自建训练计划** — 选动作、配组数/次数(或时长)/休息
- ⏱️ **训练执行 / 计时器** — 全屏引导，每组结束自动进入休息倒计时，按时间动作自动切换
- 📈 **历史记录** — 总次数、总时长、本周次数；服务器存储，跨设备同步
- 🔐 **邮箱注册登录** — 邮箱+密码，JWT cookie，数据隔离
- 🌐 **中英双语** — 右上角随时切换

## 架构 / Architecture

前后端分离，部署在同一台 VPS，Nginx 路由：

```
[Browser]
   ↓ HTTPS
[Nginx]
   ├── /          → Next.js 前端（PM2 / port 3000）
   ├── /api/*     → Go 后端（PM2 / port 8080）
   └── /_next/*   → Next.js 静态资源
                       ↓
                   SQLite (./data/keep-fit.db)
```

## 技术栈 / Stack

**前端**
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- PWA: manifest + service worker

**后端**
- Go 1.22 + Chi router
- modernc.org/sqlite（纯 Go，无 cgo）
- bcrypt 哈希密码 + golang-jwt v5
- httpOnly JWT cookie

**动作数据源**
- [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (MIT, 873 个动作)，前端走 jsDelivr CDN 直接拉取并缓存

## 开发 / Development

需要本机装 **Node 18+** 和 **Go 1.22+**。

```bash
# 一次性装依赖
npm install
cd backend && go mod download && cd ..

# 后端 (port 8080)
cd backend
JWT_SECRET=$(openssl rand -hex 32) go run .
# 默认 SQLite 在 ./data/keep-fit.db

# 前端 (port 3000)
npm run dev
# 默认开发会请求 http://localhost:3000/api/*，需要让前端转发到 8080：
# 可以临时在 next.config.js 加 rewrites，或者用 nginx/caddy 本地反代。
# 简化做法：直接 export NEXT_PUBLIC_API_BASE=http://localhost:8080 然后跑 npm run dev
```

后端跑测试：

```bash
cd backend
go test ./...
```

## 数据说明 / Data notes

- 第一次打开 `/exercises` 会从 jsDelivr 拉 873 个动作的元数据，缓存 7 天（前端 localStorage）
- 训练计划、历史、设置：存在后端 SQLite，**跟着账号走，换设备能看到**
- 语言偏好 / 动作库缓存：留在浏览器 localStorage（这些不是个人数据）
- 想换动作库数据源：改 `lib/free-exercise-db.ts`

## 用户隔离 / Profiles

邮箱 + 密码注册登录，JWT cookie 会话。

- **注册** `POST /api/auth/register` `{email, password}` → 创建 user + 自动登录
- **登录** `POST /api/auth/login` `{email, password}` → 验证密码 + 下发 JWT cookie
- **登出** `POST /api/auth/logout` → 清掉 cookie
- **当前用户** `GET /api/auth/me` → 返回 `{email, createdAt}`
- **删账号** `DELETE /api/auth/account` → 同时清空该用户所有训练计划+历史+设置（外键 ON DELETE CASCADE）

密码用 **bcrypt cost=12** 哈希。Cookie 是 `HttpOnly + SameSite=Lax`，前端 JS 看不到 token。

**数据库结构**（`backend/migrations/0001_init.sql`）：

```
users (id, email, password_hash, created_at)
workouts (id, user_id, client_id, name, exercises[json], created_at, updated_at, UNIQUE(user_id,client_id))
history  (id, user_id, client_id, workout_id, workout_name, started_at, completed_at, duration_seconds, completed_sets[json])
settings (user_id PK, data[json])
```

**老数据迁移**：升级前在浏览器 localStorage 里的训练计划/历史，第一次注册或登录后会通过 `POST /api/migrate` 自动上传到服务器，然后清掉本地。一次性，由 `mwc.server_migrated.v1` 标志守护。

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

> PM2 管两个进程（前端 Next.js + 后端 Go），Nginx 做 80/443 反代和分流。
> 前提：服务器上有 git，其余（Node / Go / PM2）`deploy.sh` 会自动装。

### 第一次部署

```bash
# 1. 把代码拉到服务器（任意目录）
git clone <your-repo-url> ~/keep-fit
cd ~/keep-fit

# 2. 一键安装+构建+用 PM2 起来
./scripts/deploy.sh
```

脚本会：
1. 检查/安装 Node 18+（CentOS 7 走 glibc-217 兜底）
2. 检查/安装 Go 1.22+（官方 tarball + golang.google.cn 镜像兜底）
3. 没 PM2 自动 `npm install -g pm2`
4. `npm ci && npm run build` 干净构建前端
5. `cd backend && go build` 编译后端二进制 `backend/keep-fit-api`
6. 生成 `.env.jwt`（如未提供 `JWT_SECRET`），权限 600
7. `pm2 start ecosystem.config.js` 起两个进程，`pm2 save`

跑完前端在 `http://localhost:3000`，后端在 `http://localhost:8080/api/health`。
Nginx 配好后用户只看到 `https://yourdomain` 一个口子，`/api/*` 自动落到后端。

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
pm2 status                          # 看两个进程状态
pm2 logs                            # 看全部日志
pm2 logs keep-fit                   # 只看前端
pm2 logs keep-fit-api               # 只看后端
pm2 restart keep-fit-api            # 重启后端
pm2 reload ecosystem.config.js      # 零停机重载全部
pm2 monit                           # 类似 htop 的实时监控
```

### 后端环境变量

写在 `ecosystem.config.js` 的 `keep-fit-api` env，或者用 wrapper script。

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8080` | HTTP 监听端口 |
| `DB_PATH` | `./data/keep-fit.db` | SQLite 文件路径 |
| `JWT_SECRET` | （随机生成 + 警告） | 32+ 字符 |
| `JWT_TTL_DAYS` | `30` | cookie 有效期 |
| `COOKIE_SECURE` | `true` | 生产必开（要走 HTTPS） |
| `COOKIE_SAMESITE` | `lax` | `lax` / `strict` / `none` |

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
