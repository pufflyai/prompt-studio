// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { s as e, t } from "./test-CYwQ_LKY.ts";
import { t as n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./workbench-BbqJVWhj.ts";
import { t as i } from "./module-C5Z-WnOS.ts";
import { useState as a } from "react";
import { Box as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
import { workbenchPages as c } from "@pstdio/sdk/extensions";
var l = {
	title: "Start/Page layout",
	component: () => {
		let [e] = a(() => {
			let e = n();
			return e.modes.registerMode({
				id: "project",
				activate() {}
			}), e.registerModule(i()), e.pageLocations.setProject("storybook-start-page"), e.pageLocations.navigate({
				kind: "page",
				page: c.start
			}), e;
		});
		return /* @__PURE__ */ s(o, {
			h: "100dvh",
			children: /* @__PURE__ */ s(r, { workbench: e })
		});
	},
	parameters: { layout: "fullscreen" }
}, u = { play: async ({ canvasElement: n }) => {
	let r = e(n);
	await t(await r.findByTestId("start-page")).toBeVisible(), await t(r.queryByLabelText("Main panel header")).not.toBeInTheDocument(), await t(r.queryByRole("tab", { name: "Start" })).toBeNull();
} };
export { u as Default, l as default };
