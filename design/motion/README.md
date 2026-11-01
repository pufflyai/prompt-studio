# Motion studies in UI Canvas

Review animation studies in UI Canvas under **Motion**. Run `bun run canvas` in the project folder to keep previews current. All conversation text and events are synthetic.

Each `design/motion/studies/<id>/` folder owns `study.json`, its React `scene.tsx`, and `study.canvas.tsx`. The project builder compiles the canvas; no extension compiles scenes. Shared scene helpers live in `design/motion/kit`. Production components do not depend on this design workspace.

Select **Instant** or **Subtle**, then open **Parameters** to change presets, reduced motion, or a study's choices. These changes stay temporary. Each frame has independent playback, speed, markers, and a loop range. Use Theme to compare light and dark. Reset parameters restores the selected frame's initial review values. Existing saved Motion Lab review choices are imported through the legacy extension's read-only command; playback resumes paused.

```sh
pst canvas study create --id example --title "Example" --group Workbench --duration 6
pst canvas study read --study example
pst canvas study delete --study example
bun run --cwd design typecheck
bun x pstdio-canvas build
```

`study.create` writes a simple canvas and scene. To use the shared study kit, follow an existing study: import `motionCanvas` from `../../canvas-study`, import the scene and metadata, and export frames with independent args.

`study.json` requires title, group, description, duration (0–120 seconds), and canvas. Canvas is `pane`, `workbench`, or positive width and height. Optional sorted markers contain `at` (seconds) and `label`. Optional params have unique ids, named options, and left/right defaults naming those options. The reserved ids are `preset` and `reducedMotion`.

Default-export a React scene taking `SceneProps` from `../../kit`. Derive motion from `time` in seconds. Read choices from `variant.values`; use `duration(props, milliseconds, spatial)` for presets and reduced motion. Use shared UI components and tokens. Avoid timers and wall-clock motion so scrubbing remains exact. Imports follow normal project build resolution.

The former Motion Lab page and Remotion renderer are retired. [ADR 0048](../../documentation/adrs/0048-motion-lab-runtime-studies.md) records the previous runtime compiler and its replacement.
