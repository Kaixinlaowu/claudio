# Claudio — 个人 AI 电台

> 学习听歌习惯，规划声音排程，像 DJ 一样为你播报音乐。

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.x-ffc131?style=flat-square&logo=tauri" alt="Tauri 2.x">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Rust-ff6b35?style=flat-square&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-Private-red?style=flat-square" alt="License">
</p>

---

## 功能特性

### AI DJ 系统
- **智能播报** — AI 像电台 DJ 一样介绍歌曲，结合时段、天气、用户心情生成个性化播报词
- **自然语言控制** — 通过对话控制播放："放点轻松的歌"、"下一首放周杰伦"、"音量调到30"
- **自主记忆** — 自动学习用户偏好、习惯、不喜欢的类型，跨会话持久化
- **语义点歌** — "来点适合工作的音乐"、"我心情不好" → AI 自动匹配歌曲
- **播放控制** — AI 可控制播放/暂停/上下首/音量/播放模式/收藏

### 音乐播放
- **网易云音乐** — 搜索、播放、歌词、歌单全功能集成
- **歌词同步** — LRC 歌词逐行滚动，支持翻译歌词对照
- **动态主题** — 从专辑封面提取主色调，UI 随音乐实时变化
- **封面缓存** — 本地缓存歌曲封面，减少网络请求
- **播放队列** — 添加、插入、删除、跳转、清空，重启后自动恢复

### 歌单管理
- **本地歌单** — 创建、编辑、删除歌单
- **网易云导入** — 一键导入网易云歌单（支持 800+ 首大歌单优化）
- **收藏系统** — 收藏喜欢的歌曲，独立管理
- **播放历史** — 自动记录播放历史，支持回溯

### 跨平台
- **Windows 桌面端** — Tauri 原生窗口，自定义标题栏
- **Android 移动端** — 触控优化 UI，适配手机屏幕
- **TTS 语音** — 小米 TTS 合成，可选语音播报

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面框架 | Tauri 2.x | 轻量、安全、原生性能 |
| 前端 | React 19 + TypeScript + Vite | 并发渲染、类型安全、快速构建 |
| 状态管理 | Zustand | 轻量级响应式状态 |
| 后端 | Rust | rusqlite / reqwest / tokio |
| 数据库 | SQLite | 本地持久化 |
| 音乐 API | 网易云音乐 | 直连 API（需 cookie） |
| TTS | 小米 TTS | mimo-v2.5-tts |
| AI | Claude API / MiniMax | 兼容 Anthropic 协议 |

---

## 快速开始

### 环境要求

- Node.js 18+
- Rust 1.77+
- npm

### 配置

在 `claudio/.env` 中配置 API 密钥：

```env
VITE_CHAT_API_KEY=你的AI_API密钥
VITE_BASE_URL=https://api.minimaxi.com/anthropic
VITE_CHAT_MODEL=MiniMax-M2.5
VITE_TTS_KEY=你的TTS密钥
VITE_TTS_MODEL=mimo-v2.5-tts
VITE_TTS_URL=https://api.xiaomimimo.com/v1/chat/completions
VITE_NET_COOKIE=你的网易云cookie
```

### 开发

```bash
npm install
npm run tauri dev
```

### 构建

```bash
# Windows 安装包
npm run tauri build

# Android APK (arm64)
npm run tauri:android:build
```

构建产物输出到 `release/` 目录。

---

## 项目结构

```
claudio/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 入口、DB 命令、迁移
│   │   ├── config.rs             # .env 加载、配置缓存
│   │   └── netease.rs            # 网易云 API、TTS 合成
│   └── Cargo.toml
├── src/                          # React 前端
│   ├── lib/
│   │   ├── ai/                   # AI 系统
│   │   │   ├── router.ts         # 意图分类（简单指令 vs 语义请求）
│   │   │   ├── claude.ts         # LLM API 调用 + JSON 解析
│   │   │   ├── context.ts        # 上下文构建（记忆、环境、播放状态）
│   │   │   ├── memory.ts         # 自主记忆系统（双存储、容量限制、安全扫描）
│   │   │   └── types.ts          # 类型定义
│   │   ├── state/                # Zustand 状态管理
│   │   │   ├── playerStore.ts    # 播放器状态
│   │   │   ├── playlistStore.ts  # 歌单状态
│   │   │   └── chatStore.ts      # 聊天 + action 执行
│   │   ├── api/netease.ts        # 网易云 API 客户端
│   │   ├── audio/                # 音频服务抽象（桌面/安卓）
│   │   ├── db/                   # Tauri IPC 数据库封装
│   │   └── tts.ts                # TTS 调用
│   ├── components/
│   │   ├── Player/               # 播放器、封面、歌词、进度条
│   │   ├── Playlist/             # 歌单、历史、收藏
│   │   ├── Chat/                 # AI 聊天面板
│   │   ├── Search/               # 搜索栏
│   │   └── mobile/               # Android 移动端组件
│   └── styles/globals.css
├── public/
│   ├── prompts/                  # AI DJ 人格提示词
│   └── user/                     # 用户品味/作息配置
└── release/                      # 构建产物
```

---

## AI 系统架构

```
用户输入
  │
  ├─ 简单指令（"播放"、"暂停"、"下一首"）→ router.ts 直接执行
  │
  └─ 语义请求（"放点轻松的歌"）→ context.ts 构建上下文
                                      │
                                      ▼
                              claude.ts 调用 LLM
                                      │
                                      ▼
                              JSON 响应解析
                              { say, play, queue, player, playlist }
                                      │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             ▼
                   播放控制       队列操作       歌单操作
                   (play/pause   (add/remove   (create/add
                    /next/prev)   /insert)      /play)
```

### 记忆系统

对标 Hermes Agent 设计的自主记忆系统：

- **双存储分离** — `user_profile`（用户画像）+ `agent_memory`（Agent 笔记）
- **严格容量限制** — 1375 + 2200 字符，超限自动合并
- **安全扫描** — 阻止 prompt injection 模式
- **自动提取** — 每次对话后静默分析，无需用户主动提出
- **上下文注入** — 带容量百分比的结构化块注入系统提示

---

## 数据存储

| 表 | 说明 |
|----|------|
| `songs` | 统一歌曲元数据（song_id 主键，含本地封面路径） |
| `plays` | 播放历史记录 |
| `playlists` | 歌单列表 |
| `playlist_songs` | 歌单与歌曲关联表 |
| `preferences` | 键值对偏好存储（记忆、配置） |

---

## 下载

前往 [Releases](../../releases) 下载 Windows 安装包。

---

## 许可证

私有项目，版权所有。
