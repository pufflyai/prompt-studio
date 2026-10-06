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

Download the desktop app from [prompt.studio](https://prompt.studio) or the [releases page](https://github.com/pufflyai/prompt-studio/releases). It includes the `pst` command.

To install only the command-line tool, use Bun:

```bash
bun add --global pstdio@latest
```

## Quick start

1. Open the desktop app, or run `pst` to start the dashboard.
2. Open a folder to create or reopen its project. Git is optional.
3. Install the coding-agent executable for the harness you want to use.
4. Start a session or install an extension to add a tool.

Enabled extensions can provide skills for your agent. Run `pst agents setup <agent-id>` to install the enabled skills; Planner supplies its ticket workflow skills when installed and enabled.

Add `.pstdio/tickets` and `.pstdio/config.json` to `.gitignore` if you do not want local project data in the repository.

### Commands

Learn more about the CLI using `pst --help`.

`pst serve` accepts connections only through its authenticated loopback URL. Open the exact `127.0.0.1` URL printed by the command. It rejects other hosts and LAN origins.

## Documentation

Read the documentation at [prompt.studio/docs](https://prompt.studio/docs/). Start with [Getting started](https://prompt.studio/docs/guides/getting-started/install/), or learn to [write an extension](https://prompt.studio/docs/guides/extensions/authoring/).

The website builds these pages from the `documentation/` folder and from each extension's own folder. To work on Prompt Studio itself, see [development setup](documentation/guides/development/0001-setup.md). The [documentation guide](documentation/guides/0001-documentation.md) explains how the docs are organized and which folders are published.
