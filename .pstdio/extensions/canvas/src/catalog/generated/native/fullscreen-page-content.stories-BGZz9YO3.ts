// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./workbench-story-BezxAS71.ts";
import { useState as a } from "react";
import { Text as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
var c = {
	title: "pstdio-workbench/Reference/Core API/Main fullscreen/Page content",
	component: () => {
		let [e] = a(() => {
			let e = r(), t = {
				kind: "page",
				extensionId: "example",
				id: "content"
			};
			return e.modes.registerMode({
				id: "project",
				activate() {}
			}), e.views.registerView({
				id: "content",
				title: "Page content",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ s(o, { children: "Readable page content" })
				}
			}), e.pages.registerPage({
				id: "content",
				ref: t,
				path: "content",
				modeId: "project",
				main: {
					kind: "view",
					presentation: "page",
					view: {
						kind: "view",
						id: "content"
					},
					cardinality: "one"
				},
				slots: []
			}), e.pageLocations.setProject("page-fullscreen"), e.pageLocations.navigate({
				kind: "page",
				page: t
			}), e;
		});
		return /* @__PURE__ */ s(i, { workbench: e });
	},
	parameters: { layout: "fullscreen" },
	tags: ["main-fullscreen-page-content"]
}, l = { play: async ({ canvasElement: r }) => {
	let i = t(r), a = await i.findByText("Readable page content");
	await n(a).toBeVisible(), await e.click(i.getByRole("button", { name: "Enter Main fullscreen" })), await n(a).toBeVisible(), await e.click(i.getByRole("button", { name: "Exit Main fullscreen" })), await n(i.getByRole("button", { name: "Enter Main fullscreen" })).toHaveFocus();
} };
export { l as EnterAndExit, c as default };
