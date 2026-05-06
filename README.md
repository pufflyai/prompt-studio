<p align="center">
  Prompt Studio (alpha)
</p>
<p align="center">Prompt Studio helps you plan and delegate tasks to coding agents without losing control.</p>
<p align="center">
 <a href="https://www.npmjs.com/package/pstdio"><img alt="npm" src="https://img.shields.io/npm/v/pstdio?style=flat-square" /></a>
  <a href="https://github.com/pufflyai/prompt-studio/actions/workflows/test-and-build.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/pufflyai/prompt-studio/test-and-build.yml?style=flat-square" /></a>
  <a href="https://discord.gg/3RxwUEk8fW"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

**This project is in alpha and is not ready for general use.**

## Installation

```bash
npm i -g pstdio@latest        # or bun/pnpm/yarn
```

## Quickstart

1. Run `pstdio` to start the dashboard.
2. Connect a coding agent, we support Claude Code and Open Code (more coming soon).
3. Create a new project.
4. Select the local repository you want to work on.

Now your agents running in this repo will know how to create tickets, refine them, update their status, keep your documentation in sync with new features etc.

We recommend adding `.pstdio/tickets` and `.pstdio/config.json` to `.gitignore` so local ticket files do not get committed.

### Commands

Learn more about the CLI using `pstdio --help`.

Run `pstdio serve --host 0.0.0.0` to expose the API and dashboard to other devices on a trusted LAN. The serve command has no authentication, so do not bind it to untrusted networks.
