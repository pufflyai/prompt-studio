// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./tree-list-Db4WJcm2.ts";
import { Box as r, Stack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-footer.stories.tsx
var c = {
	title: "Components/Data Display/Tree List/Footer",
	component: n
}, l = {
	args: {
		sections: [{
			id: "footer",
			nodes: [{
				id: "help",
				label: "Help"
			}, {
				id: "settings",
				label: "Settings"
			}]
		}],
		draggable: !0,
		rowVariant: "compact",
		sectionGap: "md",
		nodeGap: "1px"
	},
	decorators: [(e) => /* @__PURE__ */ s(i, {
		h: "lg",
		w: "xs",
		gap: "0",
		"data-testid": "footer-container",
		children: [/* @__PURE__ */ o(r, {
			flex: "1",
			children: /* @__PURE__ */ o(a, {
				p: "xs",
				children: "Project navigation"
			})
		}), /* @__PURE__ */ o(e, {})]
	})],
	play: async ({ canvasElement: n }) => {
		let r = e(n), i = await r.findByRole("option", {
			name: "Settings",
			exact: !0
		}), a = r.getByTestId("footer-container");
		await t(a.getBoundingClientRect().bottom - i.getBoundingClientRect().bottom).toBe(8);
	}
};
export { l as PinnedFooter, c as default };
