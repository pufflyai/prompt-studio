// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e } from "./icon-set-content-4o7Zf8x8.ts";
import { l as t, s as n, t as r } from "./landing-modules-C12rmwkM.ts";
import { t as i } from "./icon-set-editor-demo-B2JxUJJi.ts";
import { Suspense as a } from "react";
import { jsx as o } from "react/jsx-runtime";
// clients/landing-page/src/components/examples/tool-demo.tsx
var s = (s) => {
	let { example: c, highlighted: l } = s;
	return c === "shaders" ? /* @__PURE__ */ o(a, {
		fallback: null,
		children: /* @__PURE__ */ o(t.Component, {
			shader: e,
			withControls: !0,
			highlighted: l
		})
	}) : c === "agents" ? /* @__PURE__ */ o(a, {
		fallback: null,
		children: /* @__PURE__ */ o(r.Component, { highlighted: l })
	}) : c === "formulas" ? /* @__PURE__ */ o(a, {
		fallback: null,
		children: /* @__PURE__ */ o(n.Component, { highlighted: l })
	}) : /* @__PURE__ */ o(i, { highlighted: l });
};
export { s as t };
