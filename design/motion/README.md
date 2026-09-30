# Motion Lab

Motion Lab holds executable proposals for chat and workbench motion. Review them in the project’s Motion Lab page before changing production components. All conversation text and events are synthetic.

## Ownership

- `design/motion/studies/<id>/study.json` describes one animation.
- `design/motion/studies/<id>/scene.tsx` default-exports its React scene.
- `.pstdio/extensions/motion-lab/src/kit` provides shared scene helpers, timing proposals, and the themed canvas.
- The private Motion Lab extension owns the Remotion Player, review settings, discovery, and scene builds.
- Production UI and the host do not depend on Motion Lab or Remotion.

Studies are live project content. They are read from the default project folder, so worktree edits appear after merge. Create and delete commands refresh the tree, palette, Params, and preview. Agent turn and session completion events also refresh them. Use Refresh in the Animations tree after edits outside an agent session. A changed study keeps its current review frame, clamped to its new duration.

## Create and review a study

```sh
pst motion-lab study create --id example --title "Example" --group Workbench --duration 6
pst motion-lab study read --study example
pst motion-lab studies refresh
pst motion-lab study delete --study example
```

The create command writes metadata and a starter scene. Edit those files, then use `study.read` to check the build. It returns JavaScript or a build error with its source location. Invalid metadata appears as a warning in the tree. Deleting a study also removes its saved review.

The preview supports single and comparison views, both themes, reduced motion, playback speeds, timeline markers, and a loop range. Params are read from the study metadata. Review settings are stored per study and do not change its source.

## Metadata

`study.json` requires `title` (1–80 characters), `group`, `description`, `duration` (seconds, greater than zero and at most 120), and `canvas`. Optional `markers` are sorted `{at, label}` entries before the study’s end. Groups and studies sort alphabetically.

Canvas is `"pane"` to fill the preview pane, `"workbench"` for a scaled 1440 × 900 canvas, or `{ "width": 420, "height": 640 }` for a custom size. Output remains 1440 × 900 for single and 1920 × 1080 for comparison, at 60 fps.

Optional `params` describe per-variant choices:

```json
{
  "id": "treatment",
  "name": "Treatment",
  "type": "selection",
  "options": [{ "id": "simple", "name": "Simple" }],
  "default": { "left": "simple", "right": "simple" }
}
```

Use `selection` or `segmented`. IDs must be unique; `preset` is reserved. Each default must name an option.

## Scene contract

Default-export a React component taking `SceneProps` from `motion-lab/kit`. Derive all motion from `props.time` in seconds. Read choices from `props.variant.values` and use `duration(props, milliseconds, spatial)` for presets and reduced motion. Do not use timers or wall-clock motion. Use shared UI components and tokens.

Allowed imports are `react`, `react/jsx-runtime`, `remotion`, `@chakra-ui/react`, `@pstdio/ui`, `@pstdio/ui/chat-ui`, `lucide-react`, and `motion-lab/kit`. Relative imports must stay inside the study folder. Other modules produce a build error. The preview supplies shared module instances so hooks and theme context remain consistent.

## Validation

```sh
bun run --cwd .pstdio/extensions/motion-lab typecheck
bun run --cwd .pstdio/extensions/motion-lab test
```

Check all markers, both themes, both presets, comparison mode, and reduced motion in the isolated Docker app using `bun run dev:playwright`. Stop it with `bun run dev:playwright:down`.

The Remotion Player is the renderer. Remotion Studio, CLI video/still exports, and Copy configuration have been removed. Keep Remotion dependencies pinned together. See [ADR 0048](../../documentation/adrs/0048-motion-lab-runtime-studies.md).
