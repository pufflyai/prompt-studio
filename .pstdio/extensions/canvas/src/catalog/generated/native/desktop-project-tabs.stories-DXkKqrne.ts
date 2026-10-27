// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { o as i } from "./project-context-BR7AjHlE.ts";
import { t as a } from "./desktop-project-tabs-controller-B3HInTdw.ts";
import { t as o } from "./desktop-project-tabs-B-MOZzFm.ts";
import { useState as s } from "react";
import { jsx as c } from "react/jsx-runtime";
var l = {
	title: "Dashboard/Project tabs",
	component: () => {
		let [e] = s(() => {
			let e = r();
			return i(e, {
				id: "project",
				name: "Project"
			}), e;
		}), [t] = s(() => new a([], async () => {}));
		return /* @__PURE__ */ c(o, {
			workbench: e,
			controller: t,
			platform: "darwin"
		});
	},
	parameters: { layout: "fullscreen" }
}, u = { play: async ({ canvasElement: r }) => {
	await e.hover(t(r).getByRole("button", { name: "Open / create project" }));
	let i = await t(r.ownerDocument.body).findByRole("tooltip");
	await n(i).toHaveTextContent("Open / create project");
} }, d = { play: async ({ canvasElement: r }) => {
	await e.tab(), await n(t(r).getByRole("button", { name: "Open / create project" })).toHaveFocus();
	let i = await t(r.ownerDocument.body).findByRole("tooltip");
	await n(i).toHaveTextContent("Open / create project");
} };
export { d as OpenProjectFocus, u as OpenProjectHover, l as default };
