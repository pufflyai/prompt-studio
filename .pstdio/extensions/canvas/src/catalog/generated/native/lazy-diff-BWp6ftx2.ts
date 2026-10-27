// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Suspense as e, lazy as t } from "react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/lazy-diff.tsx
var r = t(() => import("./diff-drawer-C4AQvgUV.ts").then((e) => ({ default: e.DiffDrawer }))), i = t(() => import("./diff-viewer-CMXPoodp.ts").then((e) => ({ default: e.DiffViewer }))), a = (t) => /* @__PURE__ */ n(e, {
	fallback: null,
	children: /* @__PURE__ */ n(r, { ...t })
}), o = (t) => /* @__PURE__ */ n(e, {
	fallback: null,
	children: /* @__PURE__ */ n(i, { ...t })
});
export { o as n, a as t };
