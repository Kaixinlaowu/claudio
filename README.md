# Claudio - Personal AI Radio

> Learn listening habits, plan sound schedules, and announce music like a DJ.

**个人 AI 电台・Claudio・读懂听歌习惯 → 规划声音 → 像 DJ 那样播报**

---

## Features

- **AI DJ**: Learns your taste and announces songs like a personal radio host
- **Smart Scheduling**: Rhythm-based music delivery (morning, work, evening modes)
- **Voice Pipeline**: TTS announces now-playing info
- **Local Brain**: Claude Code subprocess handles natural language understanding
- **Netease Music**: Full integration with search, playback, lyrics via Tauri IPC

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri 2.x |
| Frontend | React 19 + TypeScript + Vite |
| State | Zustand |
| Music API | Netease Music (via Tauri IPC commands) |
| AI | Claude Code subprocess |
| TTS | FishAudio / MiniMax |
| Database | SQLite |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.70+
- npm or pnpm

### Configuration

Create `claudio/.env` with your API keys:

```env
VITE_CHAT_API_KEY=your_key
VITE_BASE_URL=https://api.minimaxi.com/anthropic
VITE_TTS_MODEL=mimo-v2.5-tts
VITE_CHAT_MODEL=MiniMax-M2.5
MUSIC_U=your_netease_cookie
VITE_NET_COOKIE=your_netease_cookie
VITE_CSRF=your_csrf
VITE_MUSIC_A=your_music_a
VITE_TTS_KEY=your_tts_key
VITE_TTS_URL=https://api.xiaomimimo.com/v1/chat/completions
```

### Development

```bash
cd claudio
npm install
npm run tauri dev
```

### Build

```bash
cd claudio
npm run tauri build
```

Installer will be at: `claudio/src-tauri/target/release/bundle/nsis/Claudio_0.1.0_x64-setup.exe`

---

## Architecture

### External Context
| Module | Content | Key Files |
|--------|---------|-----------|
| `USER/` | Taste corpus | `user/taste.md`, `user/routines.md`, `user/playlists.json` |
| `BRAIN` | Claude Code | `claude -p --output json` |
| `MUSIC` | Netease API | Rust IPC commands in Tauri backend |
| `VOICE` | TTS services | FishAudio, MiniMax |

### Local Brain
| Module | Purpose |
|--------|---------|
| `ROUTER.JS` | Intent routing |
| `CONTEXT.JS` | Prompt assembly |
| `CLAUDE.JS` | Claude subprocess adapter |
| `SCHEDULER.JS` | Rhythm scheduling |
| `TTS.JS` | Voice pipeline |
| `STATE.DB` | SQLite persistence |

### Key Files
```
claudio/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs           # Tauri main entry, IPC commands
│   │   └── netease_api/    # Netease API integration
│   └── tauri.conf.json
├── src/
│   ├── lib/
│   │   ├── api/netease.ts   # Frontend Netease API client
│   │   ├── ai/              # Router, context, claude adapter
│   │   └── state/           # Zustand stores
│   └── components/
│       ├── Player/          # AudioPlayer, PlayerCard, VolumeControl
│       ├── Playlist/        # HistoryPanel, LikedPanel
│       └── Search/          # SearchBar
└── user/                    # User personalization files
```

---

## Project Status

**Active Development** — Core features working, search and playback operational.

### What's Working
- Music search via Netease Music
- Playback of free and VIP songs
- History and liked songs storage
- AI DJ chat interface
- TTS voice announcements

### TODO
- [ ] Mute command implementation
- [ ] Error boundary components
- [ ] Lyrics display enhancement

---

## License

Private project — All rights reserved
