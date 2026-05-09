# 移动端已知问题清单

> 记录时间：2026-05-03
> 来源：用户反馈

---

## 1. 音乐无法正常播放
- 点击歌曲后无声音输出
- UI 可能显示播放中状态，但实际无声
- 需检查 Rust 音频插件 `claudio-audio` 在 Android 端的注册和运行状态

## 2. 返回键无法正常返回
- 按 Android 返回键直接退出应用回到桌面
- 期望行为：先关闭当前 overlay（全屏播放器 / 对话页 / 队列），再切回首页，最后才退出
- `MobileApp.tsx` 缺少 Android back 事件监听

## 3. 搜索音乐无法显示封面
- 搜索结果列表中歌曲封面全部显示占位图标
- `searchSongs()` API 返回的 `coverUrl` 固定为空，需搜索后批量补调 `getSongsDetails()` 获取封面

## 4. 音乐库无法进入/编辑歌单
- 点击歌单无反应，没有歌曲列表详情页
- 无法删除歌单、重命名歌单
- 歌单行缺少 `onClick` 事件处理

## 5. 网易云导入功能缺失
- 桌面端有 `ImportPlaylistModal` 可导入网易云歌单
- 移动端 `MobileLibrary` 没有该功能入口

## 6. 全屏播放器三个点菜单无效
- 右上角 `<MoreHorizontal />` 按钮点击无反应
- 按钮没有 `onClick` 处理，未实现菜单功能

## 7. 全屏播放器话筒键功能不对
- 当前 `<Mic2 />` 只切换歌词显示状态
- 期望功能：切换封面 / 歌词的显示模式（类似桌面端的封面/歌词切换）

---

## 以下为代码审查发现的额外问题

## 8. CSS 变量 `--radius-xs` 未定义
- `globals.css` 中没有定义 `--radius-xs`
- 但 MobileHome、MobileMiniPlayer、SongRow 等多个组件使用了 `var(--radius-xs)`
- 这些组件的封面圆角会失效（退化为无圆角）
- 需在 `globals.css` 中补充定义

## 9. AI 对话不支持 Markdown 渲染
- 桌面端 `ChatBubble` 使用 `<Markdown>` 组件渲染消息
- 移动端 `MobileChat` 直接渲染 `{msg.content}` 纯文本
- AI 返回的格式化内容（代码块、列表、链接）在移动端无法正确显示

## 10. AI 对话缺少清空消息功能
- 桌面端有"清空"按钮可清除对话历史
- 移动端 `MobileChat` 没有此功能

## 11. 全屏播放器歌词区域未实现
- `toggleShowLyrics` 已有状态切换，但封面区域没有根据该状态渲染歌词
- 需调用 `getLyric(currentSong.id)` 获取歌词并显示滚动歌词视图

## 12. 全屏播放器队列按钮无响应
- `<ListMusic />` 按钮没有 `onClick` 处理
- 应跳转到队列视图

## 13. 队列页面关闭按钮使用 HTML 实体
- `MobileQueue.tsx:33` 使用 `{'<'}` 作为关闭图标
- 应替换为 Lucide 的 `ChevronLeft` 图标

## 14. 音乐库返回按钮使用 HTML 实体
- `MobileLibrary.tsx:39` 使用 `{'<'}` 作为返回图标
- 应替换为 Lucide 的 `ChevronLeft` 图标

## 15. 队列缺少"清空队列"功能
- 桌面端队列有清空按钮
- 移动端 `MobileQueue` 只能逐个删除

## 16. 迷你播放器进度条颜色问题
- 进度条 fill 使用 `var(--text-primary)`（白色），拖动时才变绿色
- 应默认使用 `var(--accent-primary)`（绿色）更符合 Spotify 风格

## 17. 音乐库"最近播放"快捷入口不可点击
- `MobileLibrary.tsx:85` 的"最近播放"卡片没有 `onClick` 处理
- 点击无反应
