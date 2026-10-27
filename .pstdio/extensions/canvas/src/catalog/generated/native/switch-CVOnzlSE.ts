// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { Switch as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/switch.tsx
var i = e.forwardRef(function(e, i) {
	let { inputProps: a, children: o, rootRef: s, trackLabel: c, thumbLabel: l, disabled: u = !1, ...d } = e, f = u ? "not-allowed" : "pointer";
	return /* @__PURE__ */ r(t.Root, {
		ref: s,
		disabled: u,
		cursor: f,
		...d,
		children: [
			/* @__PURE__ */ n(t.HiddenInput, {
				ref: i,
				...a
			}),
			/* @__PURE__ */ r(t.Control, {
				cursor: f,
				children: [/* @__PURE__ */ n(t.Thumb, { children: l && /* @__PURE__ */ n(t.ThumbIndicator, {
					fallback: l?.off,
					children: l?.on
				}) }), c && /* @__PURE__ */ n(t.Indicator, {
					fallback: c.off,
					children: c.on
				})]
			}),
			o != null && /* @__PURE__ */ n(t.Label, {
				cursor: f,
				children: o
			})
		]
	});
});
export { i as t };
