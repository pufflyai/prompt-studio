// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { s as e, t } from "./test-CYwQ_LKY.ts";
import { t as n } from "./workbench-core-kaLFKJEn.ts";
import { n as r } from "./use-page-params-B4PkHq0i.ts";
import { useState as i } from "react";
import { jsx as a } from "react/jsx-runtime";
var o = {
	title: "pstdio-workbench/Guides/Native viewer query",
	component: () => {
		let [{ workbench: e, placement: t }] = i(() => {
			let e = n(), t = {
				kind: "page",
				extensionId: "example",
				id: "records"
			};
			e.modes.registerMode({
				id: "project",
				activate() {}
			}), e.views.registerView({
				id: "reader",
				title: "Reader",
				body: {
					kind: "react",
					render: () => null
				}
			}), e.pages.registerPage({
				id: "records",
				ref: t,
				path: "records",
				modeId: "project",
				params: {
					filter: {
						type: "string",
						default: "all"
					},
					limit: {
						type: "number",
						default: 10
					}
				},
				main: { kind: "panels" },
				slots: []
			});
			let r = {
				kind: "placement",
				extensionId: "example",
				id: "reader"
			};
			return e.modePlacements.registerPlacement({
				id: "reader",
				ref: r,
				modeId: "project",
				region: "side",
				item: {
					kind: "binding",
					binding: {
						kinds: [{
							kind: "resource-kind",
							id: "record"
						}],
						cardinality: "many",
						view: {
							kind: "view",
							id: "reader"
						}
					}
				}
			}), e.pageLocations.setProject("project"), e.pageLocations.navigate({
				kind: "page",
				page: t,
				params: { filter: "main" }
			}), e.modePlacements.openPlacement({
				panel: r,
				resource: {
					type: "record",
					id: "one"
				},
				open: "pin",
				location: { pageContext: {
					page: t,
					params: { filter: "mine" }
				} }
			}), {
				workbench: e,
				placement: e.layout.getActivePanel("side")
			};
		}), o = r(e, t);
		return /* @__PURE__ */ a("output", {
			"aria-label": "Native viewer query",
			children: JSON.stringify(o)
		});
	},
	tags: ["view-page-params"]
}, s = { play: async ({ canvasElement: n }) => {
	await t(e(n).getByLabelText("Native viewer query")).toHaveTextContent("{\"filter\":\"mine\",\"limit\":10}");
} };
export { s as IndependentPageContext, o as default };
