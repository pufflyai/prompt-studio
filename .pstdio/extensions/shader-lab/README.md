# Shader Lab

Tune and compare surface shaders on workspace and ticket previews in light and dark themes.

Shader Lab is a private repository-local tool. Prompt Studio discovers it under `.pstdio/extensions/shader-lab` when this repository is linked to a project. It is not published or listed in the extension marketplace.

```sh
pst pstdio-shader-lab shaders add --shader section-hatch
```

Open **Shader Lab** in the project navigation. Add a shader from **Shaders**, select a version, and change its values in **Shader**. Changes save immediately. Duplicate a version to keep a comparison, then choose **Compare with**. Pause freezes the previews and the elapsed time.

Versions live in `design/shaders/<shader>/<version>.json` in the project folder. The repository includes its reviewed versions in `design/shaders/`.

Noise, hatch drift, ruler ticks, band sweep, and crosshair axes use CSS transform animations. Slow drifts step by one CSS pixel along their motion axis. Dashed outline uses the shared timer-paced clock, capped at 30 fps. Compositor previews update elapsed seconds once per second. Hidden previews pause both. See [the Shader Lab skill](skills/shader-lab/SKILL.md) for commands and rendering rules.
