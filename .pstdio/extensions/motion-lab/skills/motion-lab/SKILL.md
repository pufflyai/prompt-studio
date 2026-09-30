---
name: motion-lab
description: Create, edit, review, and delete live Motion Lab animation studies.
---

# Motion Lab studies

Read `design/motion/README.md` and `design/DESIGN.md` before authoring a study.

1. Work in the default project folder. Worktree studies appear after merge.
2. Run `pst motion-lab study create --id <kebab-id> --title <title> --group <group> --duration <seconds>`.
3. Edit `design/motion/studies/<id>/scene.tsx`. Default-export a React component taking `SceneProps` from `motion-lab/kit`. Derive motion from `time`, use `duration(props, ms, spatial)` for presets and reduced motion, and read options from `variant.values`. Never use timers or the wall clock.
4. Edit `study.json`: title, group, description, duration, canvas, sorted markers, and optional per-variant params. Duration is greater than zero and at most 120 seconds. Canvas is `pane`, `workbench`, or an object with positive width and height. Params use unique ids (except the reserved `preset`), `selection` or `segmented`, named options, and left/right defaults matching those options.
5. Import only `react`, `react/jsx-runtime`, `remotion`, `@chakra-ui/react`, `@pstdio/ui`, `@pstdio/ui/chat-ui`, `lucide-react`, `motion-lab/kit`, or files inside the study folder. Shared kit exports include frames, panels, messages, composer, file rows, tool timeline, working treatments, timing constants, and motion math. Use shared UI components and tokens.
6. Run `bun run --cwd .pstdio/extensions/motion-lab typecheck`, then `pst motion-lab study read --study <id>`. Confirm it returns `module.code`, not `module.error`.
7. The preview refreshes when the agent turn finishes. Use `pst motion-lab studies refresh` for an immediate refresh. Check markers, themes, reduced motion, and single/comparison views.
8. Remove a study with `pst motion-lab study delete --study <id>`. This also removes its saved review and refreshes open views.

Do not reinstall the extension for study edits. The Remotion Player is the only renderer; Studio and CLI exports are unavailable.
