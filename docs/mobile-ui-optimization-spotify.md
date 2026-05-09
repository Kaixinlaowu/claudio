# 移动端 UI/UX 优化方案（对标 Spotify）

## Context

基于对 Spotify 移动端设计模式的分析，结合当前 Claudio 移动端代码现状，提出 6 项高优先级优化。当前应用已有不错的基础（暗色主题、Spotify 风格色彩、CSS 变量体系），但在视觉层次、交互丰富度、个性化体验上有提升空间。

---

## 1. 全屏播放器 — 封面提取主题色（最高优先级）

**对标**: Spotify 全屏播放器会根据封面主色调动态渲染背景渐变，营造沉浸感。

**现状**: `MobileFullPlayer` 背景是固定绿色径向渐变（`rgba(29,185,84,0.08)`），与封面无关。

**方案**:
- 新建 `lib/color-extract.ts`：从 `<img>` 元素用 Canvas `getImageData` 提取主色调（取前 5 个主色，排除过暗/过亮/过饱和）
- 在 `MobileFullPlayer` 的 `useEffect` 中，当 `currentSong.coverUrl` 变化时，加载封面到隐藏 `<img>` + `<canvas>`，提取颜色
- 动态生成背景渐变：`radial-gradient(ellipse at 50% 0%, ${color1}33 0%, ${color2}11 40%, transparent 70%)`
- 过渡动画：颜色切换时用 CSS transition 平滑过渡

**文件**:
- `src/lib/color-extract.ts`（新建）
- `src/components/mobile/MobileFullPlayer.tsx`（添加颜色提取逻辑）
- `src/components/mobile/MobileFullPlayer.module.css`（`.bgGradient` 改为 CSS 变量驱动）

---

## 2. Mini Player — 进度条 + 左右滑动切歌

**对标**: Spotify mini player 底部有播放进度条，且支持左右滑动切换歌曲。

**现状**: mini player 只有 3px 顶部进度条，没有滑动交互，只能点击展开或点击按钮操作。

**方案**:
- 进度条改进：将顶部 3px 进度条改为底部进度条（视觉更明显），高度不变但加亮色
- 左右滑动：添加 touch 事件，左滑触发 `playNext()`，右滑触发 `playPrev()`，带滑动位移反馈
- 滑动阈值：水平位移 > 60px 或速度 > 0.5px/ms 时触发

**文件**:
- `src/components/mobile/MobileMiniPlayer.tsx`（添加滑动手势）
- `src/components/mobile/MobileMiniPlayer.module.css`（进度条位置调整、滑动动画）

---

## 3. 首页重新设计 — 个性化内容层次

**对标**: Spotify 首页有"个性化的播放列表卡片"、"最近播放"横滑、"为你推荐"大卡片、"浏览分类"网格，层次分明。

**现状**: 首页只有 3 个 section（快捷网格、最近播放、AI 推荐），内容单一，快捷网格太小（2 列 52px 卡片）。

**方案**:
- **快捷网格改为大卡片横滑**：每个卡片 160px 宽，带封面 + 歌名，类似 Spotify "最近播放"卡片
- **添加"猜你喜欢" section**：基于 likedSongs 提取常听艺术家，显示"为你精选的 [艺术家名] 歌曲"
- **添加"每日推荐"入口**：AI 推荐区域更突出，添加推荐理由摘要（如"基于你常听的摇滚风格"）
- **整体滚动优化**：各 section 间距统一，添加 section 标题的 "See all" 按钮

**文件**:
- `src/components/mobile/MobileHome.tsx`（重构布局）
- `src/components/mobile/MobileHome.module.css`（新卡片样式）

---

## 4. 搜索页 — 浏览分类 + 搜索历史

**对标**: Spotify 搜索页顶部是搜索框，下方是"浏览全部"分类网格（彩色方块），搜索后显示结果。

**现状**: 搜索页只有搜索框 + AI 推荐横滑 + 搜索结果列表，没有浏览分类。

**方案**:
- **浏览分类网格**：在 AI 推荐下方添加音乐分类网格（流行、摇滚、电子、古典、民谣、嘻哈等），点击触发 `searchSongs(分类名)`
- **搜索历史**：搜索框下方显示最近 5 条搜索记录（存 localStorage），点击可重新搜索
- **热门搜索**：在分类网格上方显示"热门搜索"标签云

**文件**:
- `src/components/mobile/MobileSearch.tsx`（添加分类和历史）
- `src/components/mobile/MobileSearch.module.css`（分类网格样式）

---

## 5. 播放队列 — 滑动删除 + 拖拽排序

**对标**: Spotify 队列支持长按拖拽排序，左滑显示删除按钮。

**现状**: `MobileQueue` 是静态 SongRow 列表 + 每行右侧的 Trash2 按钮，无手势交互。

**方案**:
- **左滑删除**：每个队列项支持左滑手势，滑出红色删除区域（复用 `MobileLibrary` 中的 swipe 模式）
- **长按拖拽排序**：用 `onPointerDown/Move/Up` 实现拖拽，拖拽时项半透明 + 视觉反馈，松手后更新 playlist 顺序
- **当前播放高亮**：正在播放的歌曲有更明显的视觉区分（如左侧绿色竖条 + 背景色）

**文件**:
- `src/components/mobile/MobileQueue.tsx`（添加手势交互）
- `src/components/mobile/MobileQueue.module.css`（滑动/拖拽样式）
- `src/lib/state/playerStore.ts`（添加 `reorderPlaylist` action）

---

## 6. 页面切换动画

**对标**: Spotify 页面切换有流畅的过渡动画，不是生硬的显示/隐藏。

**现状**: 全屏播放器有 slide-up 动画，但队列、聊天等覆盖层没有过渡。

**方案**:
- `MobileQueue`：添加从右侧滑入的动画（`transform: translateX(100%)` → `translateX(0)`）
- `MobileChat`：同上，从右侧滑入
- 所有覆盖层：添加关闭动画（反向滑出）
- 统一使用 `var(--ease-spring)` 缓动函数

**文件**:
- `src/components/mobile/MobileQueue.module.css`（添加滑入/滑出动画）
- `src/components/mobile/MobileChat.module.css`（添加滑入/滑出动画）
- `src/components/mobile/MobileApp.tsx`（覆盖层条件渲染改为带状态的动画控制）

---

## 实施优先级

| 优先级 | 项目 | 预估工作量 | 影响 |
|--------|------|-----------|------|
| P0 | 1. 封面主题色提取 | 中 | 极高 — 沉浸感质变 |
| P0 | 2. Mini Player 进度条+滑动 | 小 | 高 — 日常交互频率最高 |
| P1 | 6. 页面切换动画 | 小 | 中 — 整体流畅感 |
| P1 | 5. 队列手势交互 | 中 | 中 — 功能完善 |
| P2 | 3. 首页重新设计 | 中 | 中 — 内容丰富度 |
| P2 | 4. 搜索浏览分类 | 小 | 低 — 功能补充 |

## 文件修改清单

| 文件 | 改动 |
|------|------|
| `lib/color-extract.ts` | **新建** — Canvas 颜色提取工具 |
| `MobileFullPlayer.tsx` | 添加颜色提取 useEffect + 动态背景 |
| `MobileFullPlayer.module.css` | `.bgGradient` 改为 CSS 变量驱动 |
| `MobileMiniPlayer.tsx` | 添加滑动手势 |
| `MobileMiniPlayer.module.css` | 进度条位置、滑动动画 |
| `MobileHome.tsx` | 首页布局重构 |
| `MobileHome.module.css` | 大卡片、分类网格样式 |
| `MobileSearch.tsx` | 添加浏览分类、搜索历史 |
| `MobileSearch.module.css` | 分类网格、历史列表样式 |
| `MobileQueue.tsx` | 滑动删除、拖拽排序 |
| `MobileQueue.module.css` | 手势交互样式 |
| `MobileChat.module.css` | 滑入/滑出动画 |
| `MobileApp.tsx` | 覆盖层动画状态管理 |
| `playerStore.ts` | 添加 `reorderPlaylist` action |

## 验证

1. `npx tsc --noEmit` 编译通过
2. Android 设备测试每项功能：
   - 全屏播放器背景色随封面变化
   - Mini player 进度条可见、左右滑动切歌
   - 首页各 section 卡片可点击/横滑
   - 搜索页分类网格可点击、搜索历史可重现
   - 队列左滑删除、拖拽排序
   - 所有覆盖层有滑入/滑出动画
