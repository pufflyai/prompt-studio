// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { Slider as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/slider.tsx
var i = e.forwardRef(function(e, i) {
	let { children: a, ...o } = e;
	return /* @__PURE__ */ r(t.Root, {
		ref: i,
		variant: "solid",
		...o,
		children: [/* @__PURE__ */ r(t.Control, { children: [/* @__PURE__ */ n(t.Track, {
			height: "2px",
			borderRadius: "0",
			bg: "bg.muted",
			children: /* @__PURE__ */ n(t.Range, { bg: "fg" })
		}), /* @__PURE__ */ n(t.Thumbs, {
			boxSize: "0.5rem",
			bg: "fg",
			borderWidth: "1px",
			borderColor: "bg",
			borderRadius: "none",
			boxShadow: "none",
			transition: "width 0.12s ease, height 0.12s ease, border-color 0.2s ease-in-out",
			_hover: {
				boxSize: "0.75rem",
				borderColor: "border.accent-light"
			},
			_active: {
				boxSize: "0.875rem",
				borderColor: "border.accent-light"
			},
			_focusVisible: {
				borderColor: "border.accent-light",
				outline: "none",
				boxShadow: "none"
			}
		})] }), a]
	});
});
export { i as t };
