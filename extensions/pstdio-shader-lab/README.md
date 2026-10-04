# Shader Lab

Tune and compare surface shaders on workspace and ticket previews in light and dark themes.

Shader Lab is an optional first-party extension. It does not install by default.

```sh
pst extensions add pstdio-shader-lab
pst pstdio-shader-lab shaders add --shader section-hatch
```

For local development, install from this repository:

```sh
pst extensions add ./extensions/pstdio-shader-lab
```

Open **Shader Lab** in the project navigation. Add a shader from **Shaders**, select a version, and change its values in **Shader**. Changes save immediately. Duplicate a version to keep a comparison, then choose **Compare with**. Pause freezes the previews and the elapsed time.

Versions live in `design/shaders/<shader>/<version>.json` in the project folder. Installing the extension does not add versions or change existing values. The repository includes its reviewed versions in `design/shaders/`.

Noise, hatch drift, ruler ticks, band sweep, and crosshair axes use CSS transform animations. Slow drifts step by one CSS pixel along their motion axis. Dashed outline uses the shared timer-paced clock, capped at 30 fps. Compositor previews update elapsed seconds once per second. Hidden previews pause both. See [the Shader Lab skill](skills/shader-lab/SKILL.md) for commands and rendering rules.
