# 移动端 UI 优化清单

> 生成时间：2026-05-03
> 基于代码审查，涵盖用户反馈 + 发现的额外问题

---

## P0 — 功能性 Bug（无法使用）

### 1. 音乐无法播放
**现象：** 点击歌曲后无声音，UI 可能显示播放状态但实际没有音频输出。
**根因：** `AndroidAudioService` 通过 Tauri IPC 调用 `claudio-audio:audio_play`，依赖 Rust 端的音频插件。需要确认：
- `src-tauri` 中是否注册了 `claudio-audio` 插件
- Android 端是否有 `INTERNET` 权限（`AndroidManifest.xml`）
- `netease_song_url` 命令在 Android 端是否正常返回 URL
- `ensureHttps()` 是否导致 URL 失效（部分网易云 URL 不支持 HTTPS）
**涉及文件：**
- `src/lib/audio/AndroidAudioService.ts`
- `src/lib/audio/index.ts`
- `src/components/Player/AudioPlayer.tsx`
- `src-tauri/src/lib.rs`（插件注册）
- `src-tauri/gen/android/app/src/main/AndroidManifest.xml`

### 2. 返回键直接退出应用
**现象：** 按 Android 返回键，不关闭全屏播放器/对话/队列，而是直接退出到桌面。
**根因：** `MobileApp.tsx` 没有监听 Android back 事件。需要：
- 监听 `popstate` 事件或使用 Tauri 的 `App.setBackButtonHandler`
- 按优先级关闭：全屏播放器 > 对话页 > 队列 > 切回首页 tab
- 如果没有任何 overlay，才允许退出
**涉及文件：**
- `src/components/mobile/MobileApp.tsx`

### 3. 搜索结果无封面
**现象：** 搜索歌曲后列表中全部显示占位图标，没有专辑封面。
**根因：** `searchSongs()` 返回的 Song 对象 `coverUrl` 固定为空字符串（`netease.ts:53`），因为网易云搜索 API 本身不返回封面。需要在搜索结果返回后批量调用 `getSongsDetails()` 获取封面。
**涉及文件：**
- `src/components/mobile/MobileSearch.tsx`（搜索后调用 getSongsDetails 补全封面）
- `src/lib/api/netease.ts`（可选：封装 searchWithCovers 方法）

### 4. 音乐库无法进入歌单 / 编辑歌单
**现象：** 点击歌单无反应，没有歌曲列表视图，无法删除歌单。
**根因：** `MobileLibrary.tsx` 中歌单行（`playlistRow`）没有 `onClick` 处理，缺少歌单详情视图。需要：
- 点击歌单 → 进入详情页（显示歌曲列表、播放全部、删除按钮）
- 支持长按/滑动删除歌单
- 支持重命名歌单
- 歌单详情页可添加/移除歌曲
**涉及文件：**
- `src/components/mobile/MobileLibrary.tsx`（新增歌单详情视图）
- `src/lib/state/playlistStore.ts`（已有 `loadPlaylistSongs`、`removePlaylist`、`removeSongFromPlaylist`）

### 5. 网易云导入功能缺失
**现象：** 移动端没有导入网易云歌单的入口。
**根因：** 桌面端有 `ImportPlaylistModal` 组件，但 `MobileLibrary.tsx` 没有引用它。需要：
- 在音乐库页面添加"导入网易云歌单"按钮
- 复用桌面端 `ImportPlaylistModal` 或为其创建移动端适配版本
**涉及文件：**
- `src/components/mobile/MobileLibrary.tsx`（添加导入入口）
- `src/components/Playlist/ImportPlaylistModal.tsx`（复用或适配）

---

## P1 — 体验问题（可用但不好用）

### 6. 全屏播放器三个点菜单无效
**现象：** 右上角 `<MoreHorizontal />` 按钮点击无反应。
**根因：** `MobileFullPlayer.tsx:91-93` 中按钮没有 `onClick` 处理。需要实现菜单功能：
- 添加到歌单
- 查看专辑
- 分享
- 查看歌曲详情
**涉及文件：**
- `src/components/mobile/MobileFullPlayer.tsx`
- 新建 `src/components/mobile/MobilePlayerMenu.tsx`（下拉菜单组件）

### 7. 全屏播放器话筒按钮功能不对
**现象：** `<Mic2 />` 按钮当前只切换歌词显示（`toggleShowLyrics`），用户期望的是封面/歌词切换显示。
**根因：** 功能设计与用户期望不一致。需要：
- 改为点击后在专辑封面和歌词之间切换显示（类似桌面端 `PlayerCard` 的 `showLyrics` 切换）
- 图标改为 `Mic2`（歌词模式）/ `Disc3`（封面模式）表示当前状态
**涉及文件：**
- `src/components/mobile/MobileFullPlayer.tsx`
- `src/components/mobile/MobileFullPlayer.module.css`（封面/歌词区域切换动画）

### 8. 队列按钮没有跳转
**现象：** 全屏播放器 `<ListMusic />` 按钮点击无反应。
**根因：** `MobileFullPlayer.tsx:147-149` 按钮没有 `onClick` 处理。需要添加：
- 点击后关闭全屏播放器并打开队列页
**涉及文件：**
- `src/components/mobile/MobileFullPlayer.tsx`（添加 `onOpenQueue` prop）
- `src/components/mobile/MobileApp.tsx`（传递 prop）

### 9. 喜欢的歌曲列表不完整
**现象：** 音乐库中"喜欢的歌曲"显示数量可能不正确。
**根因：** `MobileLibrary.tsx:18-20` 用 `playlist.filter()` 来匹配 likedSongs，但如果 liked 的歌曲不在当前播放队列中，就不会显示。应该直接使用 `likedSongs` 列表，必要时通过 `getSongsByIds` 获取完整信息。
**涉及文件：**
- `src/components/mobile/MobileLibrary.tsx`
- `src/lib/state/playerStore.ts`（检查 `loadLikedSongs` 逻辑）

### 10. 播放队列缺少"保存到歌单"功能
**现象：** 桌面端队列有"保存到歌单"（`SaveToPlaylistPopover`），移动端没有。
**根因：** `MobileQueue.tsx` 只有删除按钮，没有保存功能。
**涉及文件：**
- `src/components/mobile/MobileQueue.tsx`
- `src/components/Playlist/SaveToPlaylistPopover.tsx`（复用）

---

## P2 — 改进项

### 11. 播放错误无反馈
**现象：** 播放失败时 UI 无任何提示（静默失败）。
**建议：** 在 `playerStore` 中添加 `error` 状态，AudioPlayer 捕获异常后设置错误信息，UI 显示 toast 提示。
**涉及文件：**
- `src/lib/state/playerStore.ts`
- `src/components/Player/AudioPlayer.tsx`
- 新建 `src/components/mobile/MobileToast.tsx`

### 12. 歌单操作无加载状态
**现象：** 创建歌单、导入歌单时没有 loading 反馈。
**建议：** 在关键操作中添加 loading 状态和 spinner。
**涉及文件：**
- `src/components/mobile/MobileLibrary.tsx`

### 13. 全屏播放器歌词显示未实现
**现象：** `toggleShowLyrics` 切换了状态，但 `MobileFullPlayer.tsx` 中没有渲染歌词内容。
**根因：** 封面区域只显示图片/占位符，没有根据 `showLyrics` 切换到歌词视图。需要：
- 调用 `getLyric(currentSong.id)` 获取歌词
- 在封面区域叠加歌词滚动视图
**涉及文件：**
- `src/components/mobile/MobileFullPlayer.tsx`
- `src/lib/api/netease.ts`（已有 `getLyric`）

### 14. Mini Player 进度条不更新
**现象：** 迷你播放器顶部的进度线可能不同步。
**根因：** 需要确认 `MobileMiniPlayer` 是否正确订阅了 `progress` 状态。
**涉及文件：**
- `src/components/mobile/MobileMiniPlayer.tsx`

### 15. 喜欢按钮状态可能不同步
**现象：** 全屏播放器和迷你播放器的 like 状态可能不一致。
**根因：** 两处都读取 `likedSongs`，但 `toggleLike` 的实现可能没有正确持久化。
**涉及文件：**
- `src/lib/state/playerStore.ts`（检查 `toggleLike` 实现）

---

## P3 — 代码清理

### 16. 删除废弃组件
以下文件不再被任何新组件引用：
- `src/components/mobile/MobilePlayerCard.tsx`（已被 `MobileFullPlayer` 替代）
- `src/components/mobile/MobileSearchBar.tsx`（已被 `MobileSearch` 替代）
- `src/components/mobile/MobilePlaylistPanel.tsx`（已被 `MobileQueue` 替代）

### 17. MobileLibrary 返回按钮使用 HTML 实体
**现象：** `MobileLibrary.tsx:39` 使用 `{'<'}` 作为返回图标，应该用 Lucide 的 `ChevronLeft`。
**涉及文件：**
- `src/components/mobile/MobileLibrary.tsx`

---

## 实施优先级

| 阶段 | 任务 | 预估 |
|------|------|------|
| **Phase 1** | P0 全部（#1-5） | 核心功能修复 |
| **Phase 2** | P1 全部（#6-10） | 体验完善 |
| **Phase 3** | P2 #11-15 | 错误处理 + 歌词 + 同步 |
| **Phase 4** | P3 #16-17 | 清理 |

---

## 验证方式

1. `npx tsc --noEmit` — TypeScript 编译通过
2. `npm run build` — 前端构建成功
3. `npm run dev` — 桌面端功能不受影响
4. `npm run tauri android dev` — 真机测试：
   - 点击歌曲 → 有声音
   - 按返回键 → 关闭 overlay 而非退出
   - 搜索 → 封面正常显示
   - 音乐库 → 可进入歌单、编辑、删除
   - 导入网易云歌单 → 流程完整
   - 全屏播放器 → 三个点菜单可用、歌词切换正常、队列按钮可跳转
