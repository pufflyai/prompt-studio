<a href="https://prompt.studio">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pufflyai/prompt-studio/main/.github/readme/banner-dark.jpg" />
    <img alt="Prompt Studio. A workbench for your tools." src="https://raw.githubusercontent.com/pufflyai/prompt-studio/main/.github/readme/banner-light.jpg" width="100%" />
  </picture>
</a>

<p align="center">
  <a href="https://www.npmjs.com/package/pstdio"><img alt="npm" src="https://img.shields.io/npm/v/pstdio?style=flat-square" /></a>
  <a href="https://github.com/pufflyai/prompt-studio/actions/workflows/test-and-build.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/pufflyai/prompt-studio/test-and-build.yml?branch=main&event=push&style=flat-square" /></a>
  <a href="https://github.com/pufflyai/prompt-studio/actions/workflows/coverage.yml"><img alt="Coverage" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fpufflyai%2Fprompt-studio%2Fbadges%2Fcoverage.json&style=flat-square" /></a>
  <a href="https://github.com/pufflyai/prompt-studio/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
  <a href="https://discord.gg/3RxwUEk8fW"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

<p align="center">
  <a href="https://prompt.studio"><b>Download</b></a> ·
  <a href="https://prompt.studio/docs/">Docs</a> ·
  <a href="https://prompt.studio/blog/">Blog</a> ·
  <a href="https://discord.gg/3RxwUEk8fW">Discord</a>
</p>

Coding agents can build the tools your work is missing. Prompt Studio gives those tools a place to live. Each one starts with a UI, storage, search, and notifications already in place, and every tool can use what the others produce.

Describe the tool you want. Your agent builds it, and you can keep changing it the same way.

> [!NOTE]
> Prompt Studio is in alpha. Expect rough edges and breaking changes between releases.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pufflyai/prompt-studio/main/documentation/images/prompt-studio-0-41-views-dark.gif" />
  <img alt="The Prompt Studio workbench switching between tools built as extensions." src="https://raw.githubusercontent.com/pufflyai/prompt-studio/main/documentation/images/prompt-studio-0-41-views-light.gif" width="100%" />
</picture>

## Why Prompt Studio

### Your agent starts from working parts

Every tool needs panels, commands, settings, and a place to keep its data. Prompt Studio provides them, so your agent spends its time on the tool you asked for.

### All your tools in one workbench

Tools share the same panels, navigation, search, and themes. Your agent builds them from the same `@pstdio/ui` components the workbench uses, so a new tool fits in with the rest.

### Tools work together

Tools share files and commands, so one tool's output becomes another's input. A Planner ticket can start an agent session, and the report that agent writes comes back to the ticket for review.

### Change anything by asking

Want another view or a new field? Ask your agent. You don't have to read the code to change how a tool works.

## Get started

1. [Download the desktop app](https://prompt.studio), or install the command-line tool with [Bun](https://bun.sh):

   ```bash
   bun add --global pstdio@latest
   ```

2. Open the app, or run `pst` to start the dashboard in your browser.
3. Open a folder. It becomes a project. Git is optional.
4. Install the coding agent you use: [Claude Code](https://prompt.studio/docs/extensions/claude-code/), [Codex](https://prompt.studio/docs/extensions/codex/), or [OpenCode](https://prompt.studio/docs/extensions/opencode/).
5. Start a session and describe the tool you want, or install an extension that already does the job.

The [getting started guide](https://prompt.studio/docs/guides/getting-started/install/) walks through each step.

### Command line

Run `pst --help` to see every command. `pst agents setup <agent-id>` installs the skills from your enabled extensions into your agent.

`pst serve` accepts connections only through its authenticated loopback URL. Open the exact `127.0.0.1` URL it prints. It rejects other hosts and LAN origins.

Prompt Studio keeps project data in `.pstdio/`. Add `.pstdio/tickets` and `.pstdio/config.json` to `.gitignore` if you do not want it in your repository.

## Build an extension

Every tool in Prompt Studio is an extension, including the ones we ship: Notes, Planner, Artifacts, Reports, and the agent harnesses. Our extensions use the same public API as yours.

Start with the [extension guide](https://prompt.studio/docs/guides/extensions/authoring/), or ask your agent to build one for you.

## Contributing

To work on Prompt Studio itself, read the [development setup](https://github.com/pufflyai/prompt-studio/blob/main/documentation/guides/development/0001-setup.md). The [documentation guide](https://github.com/pufflyai/prompt-studio/blob/main/documentation/guides/0001-documentation.md) explains how the docs in `documentation/` are organized and published.

Ask questions or share ideas on [Discord](https://discord.gg/3RxwUEk8fW) or in [GitHub issues](https://github.com/pufflyai/prompt-studio/issues).

## License

[MIT](https://github.com/pufflyai/prompt-studio/blob/main/LICENSE)
