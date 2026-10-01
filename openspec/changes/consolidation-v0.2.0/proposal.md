# OpenSpec Change: Consolidation v0.2.0 - UI Enhancements & IPC Bridge Robustness

## Metadata
- **Change Name**: `consolidation-v0.2.0`
- **Repository**: `gonzalez962/open-pi-viewer`
- **Date**: 2026-09-30
- **Author**: DjRomoro & el Gentleman
- **Status**: Completed / Verified

## Overview
Consolidates the full suite of enhancements implemented in PI-Viewer v0.2.0, covering:
1. **Interactive Decision & Question Cards (`InteractiveQuestionCard`)**:
   - Decoupled interactive tools (`ask_user_question`, `ask_user_choice`, `ask_user_confirmation`, `question`) from automated process grouping.
   - Interactive questions render prominently with action buttons, allowing single-click resolution.
   - Implemented `send_extension_ui_response` in `server/web-ipc-bridge.ts` to transmit selections directly to Pi CLI's STDIN.
2. **Clickable Autolinks in Chat**:
   - Added `UserMessageContent` component parsing user prompt URLs into clickable links.
   - Extended Markdown AST parser (`src/core/markdown.ts`) to recognize bare URLs and bracketed autolinks (`<https://...>`).
   - Enabled single-click external URL opening without requiring `Ctrl` modifier.
3. **Custom Background Wallpapers & Area Transparency**:
   - Resolved `localStorage` quota limitations by hosting official wallpapers (`/wallpapers/minimalist-ninja-1080p.jpg`).
   - Provided one-click quick presets in `ThemeCustomizer`.
   - Added independent opacity controls for 5 distinct areas (Canvas Global, Sidebars, Main Chat, Prompt Area, Cards & Bubbles).
   - Removed CSS opacity blockers in `.app-workspace`, `.workspace-main`, and `.chat-container`.
4. **ODD Incandescent Agent Labels**:
   - Replaced redundant labels with a single glowing pill (`Orquestador`, `Explorer`, `Verify`, `Task`, `Judge`, `Review`).
5. **IPC Latency & Process Safety**:
   - Cached Engram project and cloud status calls to avoid repeated subshell executions.
   - Replaced unbounded session JSON loading with a sliding window of recent messages for instant reload.
   - Eliminated false `[Working]` states by checking subprocess liveness in `getSessionStatus()`.

## Verification & Test Results
- **Unit & Integration Suite**: 835/835 tests passing (`npm test`).
- **Architectural Boundaries**: 8/8 strict layer rules validated (`npm run check:arch`).
- **Production Build**: 0 errors, clean bundle compilation (`npm run build`).
- **Runtime Deployment**: Systemd service `pi-viewer.service` active and verified at `http://localhost:5174/`.
