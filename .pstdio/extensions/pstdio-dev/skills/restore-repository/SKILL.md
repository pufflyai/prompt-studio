---
name: restore-repository
description: Restore the Prompt Studio source code into this project folder. Use at the start of any task when the project folder has no `.git` or no root `package.json`, for example on a device that only has the project's Prompt Studio data. Prompt Studio Cloud does not copy this repository; its code comes from GitHub.
---

# Restore the Prompt Studio repository

Prompt Studio Cloud syncs this project's tickets, reports, sessions and other tool data,
but not its project folder: the folder has no `.pstignore`, so Cloud takes no copy of it.
The source code lives at `https://github.com/pufflyai/prompt-studio`.

## Check

Run in the project folder:

```sh
git rev-parse --show-toplevel && test -f package.json
```

If both succeed, the repository is present. Update it with `git pull --ff-only` only when
the task needs the latest `main`, then continue with the task.

## Restore

The folder may already hold Prompt Studio data such as `.pstdio/` or agent folders, so
`git clone` into it fails. Fetch into the existing folder instead:

```sh
git init
git remote add origin https://github.com/pufflyai/prompt-studio.git
git fetch origin main
git checkout -b main --track origin/main
bun install
```

- If `git checkout` stops because untracked local files would be overwritten, do not
  force it. Those files are this device's newer data. List them and ask the user what to
  keep.
- If `origin` already exists, use `git remote set-url origin <url>` instead of adding it.
- Use `git@github.com:pufflyai/prompt-studio.git` instead when this device has SSH access.

Then read `AGENTS.md` and follow it.
