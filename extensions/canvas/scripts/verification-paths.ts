import { resolve } from "node:path";

// The browser checks build this repository's canvases with `pstdio-canvas build --out` into
// `build/` and the verification page into `dist/`.
export const verificationRoot = resolve(import.meta.dir, "../../../__test-tmp__/canvas-verification");
export const verificationBuild = process.env.CANVAS_BUILD_DIR ?? resolve(verificationRoot, "build");
