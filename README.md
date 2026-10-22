# ⚽ 足球战术板（Football Tactics Board）

一个纯前端的足球战术板网页应用：拖拽布阵、关键帧动画回放、盯人联动、绘图标注，打开浏览器就能用。

**在线使用**：https://COSMIC-DAWN-PH.github.io/football-tactics-board/

## 功能

### 🎯 战术板
- 11 人制 / 8 人制 / 5 人制场地，横向 / 纵向切换
- 主队 / 客队球员、球、标志碟、假人，全部可拖拽
- 阵型一键落位：4-4-2、4-3-3、4-2-3-1、3-5-2（11 人制）；3-3-1、3-2-2（8 人制）；2-2、3-1、1-2-1（5 人制）

### 🎬 关键帧动画回放
- 摆好阵型 →「＋添加关键帧」→ 拖动球员 → 再添加关键帧
- 播放时所有元素平滑插值移动，支持循环播放、逐帧跳转、每帧过渡时长可调
- **路径微调**：选中单个球员时，棋盘上会出现黄色贝塞尔曲线手柄，拖动即可把直线跑位改成弧线
- 球也可以单独做动画（传球路线）

### 🔗 联动
- **盯人绑定**：在右侧面板把我方球员绑定到对方球员，拖动对方时被绑定者自动保持相对距离跟随，动画播放时同样生效（绑定关系以红色虚线显示）
- **成组移动**：空白处框选多个球员，开启「成组移动」后拖动任意一个，整组保持队形平移（适合移动整条防线）

### ✏️ 标注
- 每个球员可设号码、姓名、角色备注（如"盯对方10号"）
- 实线箭头（跑位）、虚线箭头（传球）、自由画线、文字标注、半透明区域圈选，6 种颜色
- 撤销 / 重做（Ctrl+Z / Ctrl+Y）、Delete 删除选中

### 💾 保存与分享
- 多战术方案管理（存浏览器 localStorage）
- 导出 / 导入 JSON（可发给队友）
- 导出 PNG 静态图
- **导出 GIF 动画**（战术演示直接发群）

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 构建到 dist/
```

## 技术栈

- React 18 + TypeScript + Vite
- [Konva.js](https://konvajs.org/)（react-konva）— Canvas 渲染 / 拖拽 / 动画
- Zustand — 状态管理
- gif.js — GIF 导出

## 部署

GitHub Actions 自动部署到 GitHub Pages（见 `.github/workflows/deploy.yml`），推送到 `main` 分支即触发。

## 致谢

设计参考了以下开源项目：

- [VistaoFootball/tactical-board](https://github.com/VistaoFootball/tactical-board) — 关键帧 + 曲线路径的动画模型
- [rezakurniawan88/tactigo](https://github.com/rezakurniawan88/tactigo) — Konva 画板交互
- [CJ-cooper6/coco-tacticx](https://github.com/CJ-cooper6/coco-tacticx) — 足球专用细节

## License

MIT
