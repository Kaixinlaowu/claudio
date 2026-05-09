# Claudio — 个人 AI 电台

> 学习听歌习惯，规划声音排程，像 DJ 一样播报音乐。

---

## 功能特性

- **AI DJ**：学习你的音乐品味，像私人电台主持人一样推荐和播报歌曲
- **自然语言控制**：通过 AI 对话控制播放队列 — 添加、插入、删除、跳转、清空
- **网易云音乐**：搜索、播放、歌词、歌单全功能集成（通过 Tauri IPC）
- **歌单管理**：创建本地歌单，从网易云导入歌单，支持进度显示
- **定时播报**：基于时段的音乐推送（早间、工作、傍晚、夜间模式）
- **语音播报**：TTS 合成正在播放信息
- **歌词显示**：LRC 歌词同步滚动
- **队列持久化**：播放队列自动保存，重启后恢复
- **播放历史**：SQLite 存储播放记录和喜欢的歌曲

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2.x |
| 前端 | React 19 + TypeScript + Vite |
| 状态管理 | Zustand |
| 后端 | Rust (rusqlite, reqwest, tokio) |
| 数据库 | SQLite |
| 音乐 API | 网易云音乐（直连 API） |
| TTS | 小米 TTS (mimo-v2.5-tts) |
| AI | Claude API / MiniMax 兼容接口 |

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
src/
├── lib/
│   ├── api/netease.ts      # 网易云 API 客户端
│   ├── ai/                 # AI 路由、上下文、对话适配
│   ├── state/              # Zustand 状态管理
│   ├── audio/              # 音频服务抽象（桌面/安卓）
│   ├── db/                 # 数据库接口（Tauri IPC）
│   └── scheduler.ts        # 定时任务
├── components/
│   ├── Player/             # 播放器组件
│   ├── Playlist/           # 歌单、历史、收藏
│   ├── Chat/               # AI 对话
│   └── mobile/             # 移动端适配
└── styles/                 # 全局样式、CSS 变量

src-tauri/src/
├── lib.rs                  # 入口、数据库命令
├── config.rs               # 配置加载与缓存
└── netease.rs              # 网易云 API、TTS
```

---

## 数据存储

- **songs**：统一歌曲元数据（song_id 主键）
- **plays**：播放历史记录
- **playlists**：歌单列表
- **playlist_songs**：歌单与歌曲的关联关系
- **preferences**：用户偏好设置（键值对）

---

## 许可证

私有项目，版权所有。
