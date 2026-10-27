// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./navigation-level-composition-CTrGcGyO.ts";
import { t as a } from "./workbench-story-B6F8bQqu.ts";
import { useState as o } from "react";
import { Button as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-chrome-continuity.stories.tsx
var f = () => {
	let e = r(), t = i(e), n = Promise.withResolvers(), a = Promise.withResolvers(), o = 0, f = (e) => ({
		kind: "page",
		extensionId: "story",
		id: e
	});
	e.modes.registerMode({
		id: "project",
		label: "Project",
		activate() {}
	});
	for (let t of ["home", "ticket"]) e.views.registerView({
		id: t,
		title: t,
		body: {
			kind: "react",
			render: () => t === "home" ? /* @__PURE__ */ d(c, { children: [/* @__PURE__ */ u(s, {
				onClick: () => e.pageLocations.navigate({
					kind: "page",
					page: f("ticket")
				}),
				children: "Open ticket"
			}), /* @__PURE__ */ u(s, {
				onClick: () => a.resolve(),
				children: "Finish project read"
			})] }) : /* @__PURE__ */ d(c, { children: [/* @__PURE__ */ u(l, { children: "Ticket contents" }), /* @__PURE__ */ u(s, {
				onClick: () => n.resolve(),
				children: "Finish navigation read"
			})] })
		}
	}), e.pages.registerPage({
		id: t,
		ref: f(t),
		title: t,
		path: t,
		modeId: "project",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: t
			},
			cardinality: "one"
		},
		slots: []
	});
	for (let t of ["header", "footer"]) {
		let n = [{
			id: t,
			nodes: [{
				id: t,
				label: t === "header" ? "Search" : "Help"
			}]
		}];
		e.navigationTrees.registerContribution({
			id: t,
			owner: {
				kind: "mode",
				extensionId: "pstdio",
				id: "project"
			},
			sourceExtensionId: "pstdio",
			declarationIndex: 0,
			slot: t,
			getStructure: () => n,
			getSections: () => n
		});
	}
	return e.navigationTrees.registerContribution({
		id: "project-items",
		owner: {
			kind: "mode",
			extensionId: "pstdio",
			id: "project"
		},
		sourceExtensionId: "pstdio",
		declarationIndex: 0,
		resolveResource: () => void 0,
		getSections: async () => (o++ > 0 && e.pages.store.getState().activePageId === "home" && await a.promise, [{
			id: "project-items",
			nodes: [
				"Home",
				"Notes",
				"Tickets"
			].map((e) => ({
				id: e,
				label: e
			}))
		}])
	}), e.navigationTrees.registerContribution({
		id: "ticket-files",
		owner: {
			kind: "page",
			extensionId: "story",
			id: "ticket"
		},
		sourceExtensionId: "story",
		declarationIndex: 0,
		getSections: () => [{
			id: "files",
			nodes: [{
				id: "notes",
				label: "notes.md"
			}]
		}]
	}), e.views.registerView({
		id: "navigation",
		title: "Navigation",
		body: {
			kind: "tree",
			getReadKey: () => t.getReadKey(),
			getStructure: () => t.getStructure("content"),
			getHeaderStructure: () => t.getStructure("header"),
			getFooterStructure: () => t.getStructure("footer"),
			getHeader: async (r) => (e.pages.store.getState().activePageId === "ticket" && await n.promise, t.getSections("header", r.signal, r.onProgress)),
			getFooter: (e) => t.getSections("footer", e.signal, e.onProgress),
			getBody: (e) => t.getSections("content", e.signal, e.onProgress),
			getChildren: () => []
		}
	}), e.shellPlacements.registerPlacement({
		id: "navigation",
		region: "sidenav",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "navigation"
			}
		}
	}), e.pageLocations.setProject("story"), e.pageLocations.navigate({
		kind: "page",
		page: f("home")
	}), e;
}, p = {
	title: "pstdio-workbench/Guides/Navigation chrome continuity",
	component: () => {
		let [e] = o(f);
		return /* @__PURE__ */ u(a, { workbench: e });
	},
	parameters: { layout: "fullscreen" }
}, m = { play: async ({ canvasElement: r }) => {
	let i = t(r), a = await i.findByRole("option", { name: "Search" }), o = await i.findByRole("option", { name: "Help" }), s = a.getBoundingClientRect().top, c = o.getBoundingClientRect().bottom;
	await e.click(await i.findByRole("button", { name: "Open ticket" })), await i.findByText("Ticket contents"), await n(a).toBeVisible(), await n(o).toBeVisible(), await n(a.getBoundingClientRect().top).toBe(s), await n(o.getBoundingClientRect().bottom).toBe(c), await e.click(i.getByRole("button", { name: "Finish navigation read" })), await i.findByRole("option", { name: "notes.md" }), await n(a).toBeVisible(), await n(o).toBeVisible();
} }, h = { play: async ({ canvasElement: r }) => {
	let i = t(r), a = [
		"Home",
		"Notes",
		"Tickets"
	], o = [];
	for (let e of a) o.push((await i.findByRole("option", { name: e })).getBoundingClientRect().top);
	await e.click(await i.findByRole("button", { name: "Open ticket" })), await e.click(await i.findByRole("button", { name: "Finish navigation read" })), await i.findByRole("option", { name: "notes.md" }), await e.click(i.getByRole("button", { name: "Back to project" })), await i.findByRole("button", { name: "Open ticket" });
	for (let [e, t] of a.entries()) {
		let r = i.getByRole("option", { name: t });
		await n(r).toBeVisible(), await n(r.getBoundingClientRect().top).toBe(o[e]);
	}
	await e.click(i.getByRole("button", { name: "Finish project read" }));
	for (let [e, t] of a.entries()) await n(i.getByRole("option", { name: t }).getBoundingClientRect().top).toBe(o[e]);
	r.dataset.returnJourney = "complete";
} };
export { m as OpenTicket, h as ReturnToProject, p as default };
