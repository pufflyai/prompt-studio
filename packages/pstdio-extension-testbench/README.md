# pstdio extension testbench

Vite app for loading extension source and previewing contribution contracts without opening the dashboard.

Open the visual workbench:

```bash
bun run --cwd packages/pstdio-extension-testbench dev
```

The workbench defaults to `./extensions/pstdio-planner` and opens the contributed ticket files tree beside a seeded
`PS-16` ticket resource. Use the toolbar preset menu to load planner, worktree setup, extension lab, or enter another
extension package path.

Planner exposes templates and skills in the contribution menus. Selecting one opens an inspectable workbench panel with
its title, description, type, and package asset path.
