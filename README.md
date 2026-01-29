# Nox

**Multi-Streamer VOD Clipper** — A desktop application for creating synchronized montages from multiple Twitch/YouTube VODs.

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Rust](https://img.shields.io/badge/Rust-Backend-orange?logo=rust)

## Features

- 🎮 **Multi-streamer synchronization** — Sync multiple VOD perspectives using a shared reference point (game start time, action, etc.)
- ✂️ **Action-based clipping** — Define actions (kills, goals, plays) and automatically generate in/out points for all streamers
- 🎬 **Montage builder** — Arrange clips in a timeline with transitions and overlay text
- 📦 **Batch export** — Export montages grouped by streamer or by action
- 🗄️ **Streamer database** — Save frequently used streamers and presets for quick project setup

## Prerequisites

Before running Nox, ensure you have the following installed:

| Tool | Version | Description |
|------|---------|-------------|
| [Node.js](https://nodejs.org/) | ≥ 18 | JavaScript runtime |
| [pnpm](https://pnpm.io/) | ≥ 8 | Package manager |
| [Rust](https://rustup.rs/) | ≥ 1.70 | Backend language |
| [FFmpeg](https://ffmpeg.org/) | ≥ 6 | Video processing |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | latest | VOD downloading |

> **Note**: FFmpeg and yt-dlp paths can be configured in the app's Settings page.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/nox.git
cd nox

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Project Structure

```
nox/
├── src/                    # React frontend
│   ├── components/         # UI components (by feature)
│   │   ├── editor/         # Video editing components
│   │   ├── montage/        # Montage timeline components
│   │   ├── project/        # Project layout & sidebar
│   │   ├── settings/       # Settings panels
│   │   ├── ui/             # shadcn/ui primitives
│   │   └── wizard/         # Project creation wizard
│   ├── constants/          # Application constants
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries (cn, etc.)
│   ├── pages/              # Route pages
│   ├── services/           # Tauri API abstraction layer
│   ├── stores/             # Zustand state management
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Helper functions
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri command handlers
│       ├── export/         # FFmpeg/yt-dlp integration
│       ├── montage/        # Montage rendering logic
│       ├── project/        # Project file management
│       └── platform/       # OS-specific utilities
└── public/                 # Static assets
```

## Workflow

1. **Create a project** — Select a game, add streamers with their VOD URLs
2. **Sync streamers** — Set a reference point (game start) and sync offsets for each VOD
3. **Define actions** — Mark key moments with timestamps
4. **Select clips** — Include/exclude clips per streamer per action
5. **Build montage** — Arrange clips in the timeline, add overlays
6. **Export** — Generate final video(s)

## Tech Stack

### Frontend
- **React 18** — UI framework
- **TypeScript** — Type safety
- **Zustand** — State management
- **React Router** — Navigation
- **shadcn/ui** — UI components
- **Lucide React** — Icons

### Backend
- **Tauri 2.0** — Desktop framework
- **Rust** — Backend logic
- **FFmpeg** — Video processing
- **yt-dlp** — VOD downloading

## Development

```bash
# Start development server with hot reload
pnpm tauri dev

# Type checking
pnpm typecheck

# Build production app
pnpm tauri build
```

## License

MIT License — see [LICENSE](LICENSE) for details.
