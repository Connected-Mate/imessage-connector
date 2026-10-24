# Agent icon sources

Collected 2026-10-23. Each icon is the vendor's own shipped app icon (or, where noted, the vendor's own site tile), cropped to the tile, resized to 128x128 PNG + WebP, corners masked to a 22.5% rounded square. Artwork never recoloured or redrawn.
All names and logos are trademarks of their respective owners, used descriptively to identify compatible tools. No affiliation or endorsement implied.

| id | source | how obtained | trademark owner |
|---|---|---|---|
| claude-code | Claude desktop app 1.49585 (`/Applications/Claude.app`, `electron.icns`), downloaded from https://claude.com/download (the Claude Code "Download for macOS" button on https://claude.com/product/claude-code ships this app). Matches claude.ai apple-touch-icon. | app bundle icon | Anthropic, PBC |
| codex | Codex app icon: `app.icns` inside the OpenAI Codex macOS app (bundle id `com.openai.codex`, 26.1013.40934, installed locally; app now titled "ChatGPT" and its main icon is the ChatGPT blossom, this is the dedicated Codex icon still shipped in the bundle). Distributed via https://openai.com/codex/. Same artwork as the icon in the og:image of https://openai.com/index/introducing-the-codex-app/. | app bundle icon | OpenAI |
| opencode | https://github.com/anomalyco/opencode/blob/dev/packages/desktop/icons/prod/icon.png (OpenCode Desktop prod icon; identical to installed OpenCode.app 2.0.25, `ai.opencode.desktop`) | official repo asset | Anomaly (OpenCode) |
| kimi | Kimi Code desktop app 1.1.2 (`com.kimi.code.desktop`, `icon.icns`), official DMG from https://www.kimi.com/code ("Download for macOS" -> https://code.kimi.com/kimi-code/desktop/download/KimiCode-mac-arm64.dmg) | app bundle icon | Moonshot AI |
| cursor | Cursor app 3.19.13 (`/Applications/Cursor.app`, `Cursor.icns`); same tile as brand-logo-5 on https://cursor.com/brand | app bundle icon | Anysphere, Inc. |
| gemini-cli | https://geminicli.com/icon.png (Gemini CLI site icon, also shipped as `packages/vscode-ide-companion/assets/icon.png` in github.com/google-gemini/gemini-cli). Gemini CLI has no desktop app. | official site asset | Google LLC |
| antigravity | Google Antigravity app 2.26.0 (`com.google.antigravity`, `icon.icns`), official DMG linked from https://antigravity.google/download | app bundle icon | Google LLC |
| copilot | GitHub Copilot app 1.1.31 (`com.github.githubapp`, `icon.icns`), official DMG from https://github.com/features/ai/github-app (https://gh.io/copilot-app-mac -> github.com/github/app releases) | app bundle icon | GitHub, Inc. (Microsoft) |
| windsurf | https://windsurf.com/favicon_512.png (Windsurf brand tile, https://windsurf.com/brand). Note: since the rename, the Windsurf desktop download (windsurf.com/download -> devin.ai/download) installs "Devin Desktop" (Devin.app 3.10.67, bundle id still `com.exafunction.windsurf`) with the Devin hexagon icon; the Windsurf tile is kept so the label stays recognisable. | official site asset | Cognition AI, Inc. |

## Picker tiles (`tile/`)

`tile/<id>.{png,webp}` (120x120) are generated from the icons above by `site/make_tiles.py` so every agent sits on the same tile: one squircle (22.5 % radius) and the same optical padding. Claude Code, OpenCode, Cursor and Gemini CLI are full-bleed tiles and are only resized and re-masked. Codex, Kimi, Antigravity, Copilot and Windsurf are marks on a plain background: the mark is cut from its own background and re-centred, sized by area, on a tile of that same sampled background (Copilot's light vertical gradient included). No artwork is recoloured or redrawn.
