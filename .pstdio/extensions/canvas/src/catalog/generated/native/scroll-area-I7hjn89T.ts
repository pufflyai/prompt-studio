// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { ScrollArea as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/scroll-area.tsx
var i = e.forwardRef(function(e, i) {
	let { children: a, viewportRef: o, contentRef: s, viewportProps: c, contentProps: l, verticalScrollbarProps: u, horizontalScrollbarProps: d, showVerticalScrollbar: f = !0, showHorizontalScrollbar: p = !1, showCorner: m = f && p, size: h = "xs", ...g } = e, _ = p ? l : {
		...l,
		style: {
			minWidth: 0,
			...l?.style
		}
	};
	return /* @__PURE__ */ r(t.Root, {
		ref: i,
		size: h,
		...g,
		children: [
			/* @__PURE__ */ n(t.Viewport, {
				...c,
				ref: o,
				children: /* @__PURE__ */ n(t.Content, {
					..._,
					ref: s,
					children: a
				})
			}),
			f ? /* @__PURE__ */ n(t.Scrollbar, {
				zIndex: "2",
				...u
			}) : null,
			p ? /* @__PURE__ */ n(t.Scrollbar, {
				orientation: "horizontal",
				zIndex: "2",
				...d
			}) : null,
			m ? /* @__PURE__ */ n(t.Corner, { zIndex: "2" }) : null
		]
	});
});
export { i as t };
