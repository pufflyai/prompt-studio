// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./info-D1px5mME.ts";
import { t } from "./tooltip-BweQW627.ts";
import { HStack as n, Icon as r, Text as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-label.tsx
var s = (s) => {
	let { name: c, description: l, compact: u = !1 } = s;
	return /* @__PURE__ */ o(n, {
		gap: "1",
		alignItems: "center",
		minW: "0",
		children: [/* @__PURE__ */ a(i, {
			textStyle: u ? "label/XS/medium" : "label/S/medium",
			color: "fg.muted",
			letterSpacing: u ? "0.08em" : void 0,
			textTransform: u ? "uppercase" : void 0,
			truncate: !0,
			children: c
		}), l ? /* @__PURE__ */ a(t, {
			content: l,
			portalled: !1,
			positioning: {
				placement: "bottom-start",
				strategy: "fixed",
				hideWhenDetached: !0
			},
			children: /* @__PURE__ */ a(r, {
				asChild: !0,
				role: "img",
				"aria-label": `About ${c}`,
				"aria-hidden": !1,
				focusable: "true",
				tabIndex: 0,
				boxSize: "3",
				color: "fg.muted",
				flexShrink: 0,
				children: /* @__PURE__ */ a(e, {})
			})
		}) : null]
	});
};
export { s as t };
