// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./ellipsis-BnQWfGiA.ts";
import { t as i } from "./pencil-DsB6zW8x.ts";
import { t as a } from "./trash-2-C03vrbuo.ts";
import { t as o } from "./tree-list-Db4WJcm2.ts";
import { useState as s } from "react";
import { Box as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
var u = {
	title: "Components/Tree List/Groups",
	component: (e) => {
		let [t, n] = s("Research"), [u, d] = s(e.editing ?? !1), [f, p] = s(!1), [m, h] = s(!0), g = [{
			id: "rename",
			label: "Rename group",
			icon: /* @__PURE__ */ l(i, {}),
			onAction: () => d(!0)
		}, {
			id: "remove",
			label: "Remove group",
			icon: /* @__PURE__ */ l(a, {}),
			onAction: () => p(!0)
		}];
		return /* @__PURE__ */ l(c, {
			maxW: "20rem",
			children: /* @__PURE__ */ l(o, {
				sections: f ? [] : [{
					id: "research",
					label: t,
					nodes: [{
						id: "notes",
						label: "Meeting notes"
					}],
					contextMenuItems: g,
					actions: [{
						id: "group-actions",
						label: "Group actions",
						icon: /* @__PURE__ */ l(r, {}),
						menuItems: g
					}],
					inlineInput: u ? {
						ariaLabel: "Group name",
						defaultValue: t,
						onCommit: (e) => {
							if (!e) throw Error("Enter a group name.");
							n(e), d(!1);
						},
						onCancel: () => d(!1)
					} : void 0
				}],
				expandedSectionIds: m ? ["research"] : [],
				onToggleSection: () => h(!m)
			})
		});
	},
	parameters: { docs: { description: { component: "Named sections support inline renaming and shared context actions. Hosts own group persistence and membership." } } }
}, d = {}, f = {
	args: { editing: !0 },
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = i.getByRole("textbox", { name: "Group name" });
		await t.clear(a), await t.type(a, "Product research{Enter}"), await n(i.getByText("Product research")).toBeVisible();
	}
};
export { d as Default, f as InlineName, u as default };
