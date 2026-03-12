<p align="center">
  Prompt Studio (alpha)
</p>
<p align="center">Prompt Studio helps you plan and delegate tasks to coding agents without losing control.</p>
<p align="center">
 <a href="https://www.npmjs.com/package/pstdio"><img alt="npm" src="https://img.shields.io/npm/v/pstdio?style=flat-square" /></a>
  <a href="https://github.com/pufflyai/prompt-studio/actions/workflows/test-and-build.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/pufflyai/prompt-studio/test-and-build.yml?style=flat-square" /></a>
</p>

**This project is in alpha and is not ready for general use.**

## Installation

```bash
npm i -g pstdio@latest        # or bun/pnpm/yarn
```

## Quickstart

1. Start the dashboard: `pstdio`
2. Create a new project.
3. Select the local repository you want to work on.
4. `pstdio` creates a `.pstdio/config.json` for that repo.

We recommend adding `.pstdio/tickets` and `.pstdio/config.json` to `.gitignore` so local ticket files do not get committed.

### Commands

Run the CLI using `pstdio`.

```bash
pstdio [command]
```

#### Dashboard

- `pstdio dashboard` - Start the web dashboard (opens at `http://localhost:4173`).
