// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./plus-CYkLGSPS.ts";
import { t } from "./shield-check-8abL6TC4.ts";
import { Icon as n, Menu as r, Portal as i } from "@chakra-ui/react";
import { ListRow as a } from "@pstdio/ui";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/background-menu.tsx
function c(c) {
	let { context: l, onCreate: u, onClose: d } = c;
	return /* @__PURE__ */ o(r.Root, {
		open: !0,
		positioning: {
			strategy: "fixed",
			placement: "bottom-start",
			getAnchorRect: () => ({
				x: l.x,
				y: l.y,
				width: 0,
				height: 0
			})
		},
		onOpenChange: ({ open: e }) => {
			e || d();
		},
		children: /* @__PURE__ */ o(i, { children: /* @__PURE__ */ o(r.Positioner, { children: /* @__PURE__ */ s(r.Content, { children: [/* @__PURE__ */ o(r.Item, {
			value: "ticket",
			asChild: !0,
			children: /* @__PURE__ */ o(a, {
				asChild: !0,
				variant: "full-width",
				label: "Create ticket",
				icon: /* @__PURE__ */ o(n, { as: e }),
				onActivate: () => u("ticket", l)
			})
		}), /* @__PURE__ */ o(r.Item, {
			value: "gate",
			asChild: !0,
			children: /* @__PURE__ */ o(a, {
				asChild: !0,
				variant: "full-width",
				label: "Add agent gate",
				icon: /* @__PURE__ */ o(n, { as: t }),
				onActivate: () => u("gate", l)
			})
		})] }) }) })
	});
}
export { c as t };
