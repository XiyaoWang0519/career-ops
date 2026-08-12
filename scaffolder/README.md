# career-ops

One-command installer for [**career-ops**](https://github.com/santifer/career-ops) — the AI-powered job search pipeline built on Claude Code.

```bash
npx @santifer/career-ops init
```

This sets up a ready-to-use workspace:

1. Clones career-ops at the latest stable release
2. Installs core dependencies

For a friend-ready web bundle, add `--web`; this also installs managed Chromium
and launch-checks the browser and bundled PDF parser before reporting success:

```bash
npx @santifer/career-ops init career-ops --web
```

Then open your AI coding tool in the folder. **On first launch the agent walks you through setup — your CV, profile and target roles — just by chatting.** Nothing to configure by hand. career-ops is AI-agnostic — Claude Code, Gemini, Codex, Qwen, OpenCode, GitHub Copilot CLI, Antigravity CLI, and Grok Build CLI all work.

The installer bootstraps CLI skill entrypoints after clone, so new CLIs (e.g. Grok) work even when `npx` pulled an older release tag.

## Usage

```bash
npx @santifer/career-ops init [folder]   # default folder: ./career-ops
```

Prefer the manual route? `git clone` still works exactly as before — see the [setup guide](https://github.com/santifer/career-ops/blob/main/docs/SETUP.md).

## Requirements

- Node.js 18+ (web bundle: Node.js 20.16+, with Node.js 22 LTS or newer recommended)
- git

## License

MIT © [Santiago Fernández de Valderrama](https://santifer.io)
