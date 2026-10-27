// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-right-CRFNEcZT.ts";
import { Box as t, Collapsible as n, Flex as r, Text as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/layout/item-section.tsx
var s = (s) => {
	let { children: c, title: l, defaultOpen: u = !0, action: d } = s;
	return /* @__PURE__ */ o(n.Root, {
		defaultOpen: u,
		width: "full",
		children: [/* @__PURE__ */ o(r, { children: [/* @__PURE__ */ o(n.Trigger, {
			_hover: { background: "bg.hover" },
			padding: "sm",
			height: "2rem",
			display: "flex",
			width: "full",
			gap: "2",
			alignItems: "center",
			cursor: "pointer",
			justifyContent: "space-between",
			children: [l && /* @__PURE__ */ a(i, {
				fontWeight: "600",
				textStyle: "label/S/medium",
				children: l
			}), /* @__PURE__ */ a(n.Indicator, {
				transition: "transform 0.2s",
				_open: { transform: "rotate(90deg)" },
				children: /* @__PURE__ */ a(e, { size: 16 })
			})]
		}), d && /* @__PURE__ */ a(t, {
			marginLeft: "auto",
			onClick: (e) => e.stopPropagation(),
			children: d
		})] }), /* @__PURE__ */ a(n.Content, { children: c })]
	});
};
export { s as t };
