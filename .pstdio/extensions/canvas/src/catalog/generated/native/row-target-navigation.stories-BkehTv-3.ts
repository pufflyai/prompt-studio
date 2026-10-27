// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./collection-badge-navigation-crrNWqHz.ts";
import { t as a } from "./workbench-story-BezxAS71.ts";
import { useState as o } from "react";
import { Text as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
import { renderBadgeListDisplay as l } from "@pstdio/ui/kanban-renderer";
var u = {
	title: "pstdio-workbench/Guides/Row target navigation",
	component: (e) => {
		let { panel: t } = e, [n] = o(() => {
			let e = r(), n = (e) => ({
				kind: "page",
				id: e,
				extensionId: "storybook"
			});
			e.views.registerView({
				id: "board",
				title: "Board",
				body: {
					kind: "kanban",
					attributes: t ? [{
						id: "attention",
						label: "Needs attention",
						type: { kind: "string" },
						render: (t, n) => l({
							id: "attention",
							label: "Needs attention",
							type: { kind: "string" },
							display: {
								kind: "badge-list",
								itemsAttributeId: "items"
							}
						}, t, n, void 0, (t) => {
							let r = i(n, "items", t, "storybook", "project");
							return r ? () => {
								e.navigation.openTarget(r);
							} : void 0;
						})
					}] : [],
					defaultSettings: {
						columnGrouping: "none",
						rowGrouping: "none",
						displayProperties: ["attention"]
					},
					executeQuery: async () => [{
						id: "a",
						title: "Ticket A",
						attributes: { items: [{
							id: "attention",
							label: "1",
							tooltip: "1 item needs attention",
							icon: "message-circle-warning",
							action: {
								kind: "panel",
								panel: {
									kind: "page-slot",
									page: n("tickets"),
									id: "attention"
								},
								resource: {
									type: "ticket",
									id: "a"
								}
							}
						}] },
						target: {
							kind: "page",
							page: n("ticket"),
							resource: {
								type: "ticket",
								id: "a",
								label: "Ticket A"
							}
						}
					}],
					onRowActivate: () => {
						throw Error("Navigation must use the declared target");
					}
				}
			}), e.views.registerView({
				id: "editor",
				title: "Editor",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ c(s, { children: "Ticket opened" })
				}
			}), e.views.registerView({
				id: "attention",
				title: "Needs attention",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ c(s, { children: "Ticket attention" })
				}
			}), e.modes.registerMode({
				id: "project",
				activate() {}
			});
			for (let t of ["tickets", "ticket"]) e.pages.registerPage({
				id: t,
				ref: n(t),
				title: t,
				path: t,
				modeId: "project",
				slots: t === "tickets" ? [{
					id: "attention",
					region: "side",
					item: {
						kind: "binding",
						binding: {
							kinds: [{
								kind: "resource-kind",
								id: "ticket"
							}],
							view: {
								kind: "view",
								id: "attention"
							},
							cardinality: "one"
						}
					}
				}] : [],
				...t === "ticket" ? {
					parentId: "tickets",
					resource: { kinds: [{
						kind: "resource-kind",
						id: "ticket"
					}] }
				} : {},
				main: {
					kind: "view",
					view: {
						kind: "view",
						id: t === "tickets" ? "board" : "editor"
					},
					cardinality: "one"
				}
			});
			return e.pageLocations.setProject("project"), e.pageLocations.navigate({
				kind: "page",
				page: n("tickets")
			}), e;
		});
		return /* @__PURE__ */ c(a, { workbench: n });
	},
	parameters: { layout: "fullscreen" }
}, d = { play: async ({ canvasElement: r }) => {
	let i = t(r);
	await e.click(await i.findByText("Ticket A", { exact: !0 })), await n(await i.findByText("Ticket opened")).toBeVisible();
} }, f = {
	args: { panel: !0 },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await e.click(await i.findByRole("button", { name: "1 item needs attention" })), await n(await i.findByText("Ticket attention")).toBeVisible(), await n(i.getByText("Ticket A", { exact: !0 })).toBeVisible(), n(i.queryByText("Ticket opened")).toBeNull();
	}
};
export { f as BadgeOpensSidePanel, d as ImmediatePage, u as default };
