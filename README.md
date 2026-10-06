<p align="center">
  Prompt Studio
</p>
<p align="center">Prompt Studio is a workbench where you and your agents can build and run tailored tools for your work.</p>
<p align="center">
 <a href="https://www.npmjs.com/package/pstdio"><img alt="npm" src="https://img.shields.io/npm/v/pstdio?style=flat-square" /></a>
  <a href="https://github.com/pufflyai/prompt-studio/actions/workflows/test-and-build.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/pufflyai/prompt-studio/test-and-build.yml?branch=main&event=push&style=flat-square" /></a>
  <a href="https://discord.gg/3RxwUEk8fW"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

**This project is in alpha and is not ready for general use.**

## Install

```bash
bun add --global pstdio@latest
```

## Quick start

1. Run `pst` to start the dashboard.
2. Open a folder to create or reopen its project. Git is optional.
3. Install the coding-agent executable for the harness you want to use.
4. Start a session or install an extension to add a tool.

Enabled extensions can provide skills for your agent. Run `pst agents setup <agent-id>` to install the enabled skills; Planner supplies its ticket workflow skills when installed and enabled.

Add `.pstdio/tickets` and `.pstdio/config.json` to `.gitignore` if you do not want local project data in the repository.

### Commands

Learn more about the CLI using `pst --help`.

`pst serve` accepts connections only through its authenticated loopback URL. Open the exact `127.0.0.1` URL printed by the command. It rejects other hosts and LAN origins.

## Documentation

Start with the [documentation guide](documentation/guides/0001-documentation.md), [user setup](documentation/guides/0002-getting-started.md), or [development setup](documentation/guides/development/0001-setup.md). Central docs live under `documentation/`, grouped into guides, references, requirements, ADRs, and lessons learned.
