<p align="center">
  Prompt Studio
</p>
<p align="center">Prompt Studio is a workbench where you and your agents can build and run tailored tools for your work.</p>
<p align="center">
 <a href="https://www.npmjs.com/package/pstdio"><img alt="npm" src="https://img.shields.io/npm/v/pstdio?style=flat-square" /></a>
  <a href="https://github.com/pufflyai/prompt-studio/actions/workflows/test-and-build.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/pufflyai/prompt-studio/test-and-build.yml?style=flat-square" /></a>
  <a href="https://discord.gg/3RxwUEk8fW"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

**This project is in alpha and is not ready for general use.**

## Install

```bash
npm i -g pstdio@latest        # or bun/pnpm/yarn
```

## Quick start

1. Run `pst` to start the dashboard.
2. Connect Claude Code or OpenCode.
3. Create a project.
4. Link the local repository where the agents will work.

Prompt Studio installs project skills for the connected agent. Those skills cover ticket creation, refinement, implementation, and documentation updates.

Add `.pstdio/tickets` and `.pstdio/config.json` to `.gitignore` if you do not want local project data in the repository.

### Commands

Learn more about the CLI using `pst --help`.

`pst serve` accepts connections only through its authenticated loopback URL. Open the exact `127.0.0.1` URL printed by the command. It rejects other hosts and LAN origins.
