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
  manifest.ts       PWA manifest
components/         UI 组件
lib/                i18n、类型、storage、wger client
public/             静态资源（icons, sw.js）
scripts/            部署脚本
ecosystem.config.js PM2 进程配置
nginx.conf.example  Nginx 反向代理示例
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
