# Claudio - Personal AI Radio

> Learn listening habits, plan sound schedules, and announce music like a DJ.

**个人 AI 电台・Claudio・读懂听歌习惯 → 规划声音 → 像 DJ 那样播报**

---

## Features

- **AI DJ**: Learns your taste and announces songs like a personal radio host
- **Smart Scheduling**: Rhythm-based music delivery (morning, work, evening modes)
- **Voice Pipeline**: TTS announces now-playing info
- **Local Brain**: Claude Code subprocess handles natural language understanding
- **Netease Music**: Full integration with search, playback, lyrics, and recommendations

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri 2.x |
| Frontend | React 19 + TypeScript + Vite |
| State | Zustand |
| Music API | Netease Music (Rust backend, embedded in app) |
| AI | Claude Code subprocess |
| TTS | FishAudio / MiniMax |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.70+
- npm or pnpm

### Development

```bash
# Frontend only (for UI development)
cd claudio
npm install
npm run dev

# Full Tauri dev mode (with Rust backend)
cd claudio
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
| `USER/` | Taste corpus | `taste.md`, `routines.md`, `playlists.json`, `mod-rules.md` |
| `BRAIN` | Claude Code | `claude -p --output json` |
| `MUSIC` | Netease API | Rust server on `:3000` |
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

---

## Configuration

Create `claudio/.env` with your API keys:

```env
VITE_CHAT_API_KEY=your_key
VITE_NET_COOKIE=your_netease_cookie
VITE_TTS_KEY=your_tts_key
```

---

## Project Status

**Active Development** — See `docs/2026-04-25-project-review.md` for known issues and tech debt.

### Known Issues (P0)
- [ ] Add `.env` to `.gitignore`
- [ ] `get_liked_songs` Tauri command not registered
- [ ] `mute` command doesn't actually mute audio

---

## License

Private project — All rights reserved
