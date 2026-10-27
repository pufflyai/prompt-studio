// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./workbench-BYYWgWSr.ts";
import { t as o } from "./settings-module-AIuYqymV.ts";
import { t as s } from "./settings-resources-BmVO5oBi.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as l } from "./bridge-webview-renderer-401sMU5z.ts";
import { useEffect as u, useState as d } from "react";
import { Box as f, Button as p, Stack as m, Text as h } from "@chakra-ui/react";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/settings/settings-embedded-views.stories.tsx
var v = (e) => {
	let { title: t, events: n } = e, [r, i] = d(0);
	return u(() => (n.bind(() => i((e) => e + 1)), () => n.unbind()), [n]), /* @__PURE__ */ _(m, {
		gap: "xs",
		children: [/* @__PURE__ */ g(h, { children: `${t} received ${r}` }), /* @__PURE__ */ _(p, {
			size: "sm",
			onClick: () => n.emit({
				scope: "performance.read",
				payload: null
			}),
			children: ["Send to ", t]
		})]
	});
}, y = {
	title: "pstdio-workbench/Reference/Core API/Embedded settings",
	component: () => {
		let [e] = d(() => i());
		return u(() => {
			let t = e.registerModule(o()), n = e.registerModule({
				id: "storybook.settings.embedded",
				activate(e) {
					let t = ["First", "Second"].map((t) => (e.views.registerView({
						id: t,
						title: t,
						body: {
							kind: "react",
							render: (e) => /* @__PURE__ */ g(v, {
								title: t,
								events: l(e.workbench, e.instance)
							})
						}
					}), e.settings.registerPanel({
						id: t,
						title: t,
						kind: "view",
						viewId: t,
						parentPanelId: "controls",
						scope: "global"
					})));
					e.views.registerView({
						id: "controls",
						title: "Embedded controls",
						body: {
							kind: "react",
							render: () => /* @__PURE__ */ g(p, {
								size: "sm",
								onClick: () => t[0].dispose(),
								children: "Remove First"
							})
						}
					}), e.settings.registerPanel({
						id: "controls",
						title: "Embedded controls",
						kind: "view",
						viewId: "controls",
						scope: "global"
					});
				}
			});
			return e.commands.executeCommand(s), () => {
				n.dispose(), t.dispose();
			};
		}, [e]), /* @__PURE__ */ g(a, { workbench: e });
	},
	decorators: [(e) => /* @__PURE__ */ g(c, { children: /* @__PURE__ */ g(f, {
		height: "100vh",
		children: /* @__PURE__ */ g(e, {})
	}) })],
	parameters: { layout: "fullscreen" }
}, b = { play: async ({ canvasElement: i }) => {
	let a = n(i.ownerDocument.body);
	await e.click(await a.findByRole("button", { name: "Send to First" })), await r(a.getByText("First received 1")).toBeVisible(), await r(a.getByText("Second received 0")).toBeVisible(), await e.click(a.getByRole("button", { name: "Remove First" })), await t(() => r(a.queryByRole("button", { name: "Send to First" })).toBeNull()), await e.click(a.getByRole("button", { name: "Send to Second" })), await r(a.getByText("Second received 1")).toBeVisible();
} };
export { b as IndependentEventsAndDisposal, y as default };
