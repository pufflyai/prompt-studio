// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./use-workbench-store-BMaFgEbb.ts";
import { t as n } from "./workbench-BbqJVWhj.ts";
import { t as r } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as i } from "react";
import { Box as a, Button as o, Flex as s, HStack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/workbench/project-switch.stories.tsx
var f = [{
	id: "project-a",
	name: "Project A"
}, {
	id: "project-b",
	name: "Project B"
}], p = (e) => {
	let { workbench: n } = e, r = t(n.pages.store, (e) => e.projectId), i = f.find((e) => e.id === r);
	return /* @__PURE__ */ d(l, {
		p: "md",
		children: [i?.name, " content"]
	});
}, m = () => {
	let [e, t] = i(0);
	return /* @__PURE__ */ u(a, {
		p: "md",
		children: /* @__PURE__ */ d(o, {
			size: "sm",
			onClick: () => t((e) => e + 1),
			children: [
				"Notes edited ",
				e,
				" times"
			]
		})
	});
}, h = () => {
	let t = {
		kind: "page",
		extensionId: "example",
		id: "home"
	}, n = e({
		initialSidePanelMode: "attached",
		startPage: t
	});
	return n.modes.registerMode({
		id: "project",
		activate() {}
	}), n.views.registerView({
		id: "home",
		title: "Home",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(p, { workbench: n })
		}
	}), n.views.registerView({
		id: "notes",
		title: "Notes",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(m, {})
		}
	}), n.views.registerView({
		id: "branch",
		title: "Branch",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(l, {
				textStyle: "xs",
				children: "main"
			})
		}
	}), n.statusBar.registerItem({
		id: "branch.status-bar-item",
		viewId: "branch",
		slot: "leading"
	}), n.modePlacements.registerPlacement({
		id: "notes",
		ref: {
			kind: "placement",
			extensionId: "example",
			id: "notes"
		},
		modeId: "project",
		region: "side",
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: "notes"
			},
			presence: "open"
		}
	}), n.pages.registerPage({
		id: "home",
		ref: t,
		title: "Home",
		path: "home",
		modeId: "project",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "home"
			},
			cardinality: "one"
		},
		slots: []
	}), n.pageLocations.switchProject(f[0].id), n;
}, g = {
	title: "pstdio-workbench/Guides/Project switch",
	component: (e) => {
		let { workbench: t } = e;
		return /* @__PURE__ */ u(r, { children: /* @__PURE__ */ d(s, {
			direction: "column",
			h: "100dvh",
			minH: "0",
			w: "full",
			children: [/* @__PURE__ */ u(c, {
				gap: "sm",
				p: "sm",
				children: f.map((e) => /* @__PURE__ */ d(o, {
					size: "sm",
					onClick: () => t.pageLocations.switchProject(e.id),
					children: ["Open ", e.name]
				}, e.id))
			}), /* @__PURE__ */ u(a, {
				flex: "1",
				minH: "0",
				minW: "0",
				children: /* @__PURE__ */ u(n, { workbench: t })
			})]
		}) });
	},
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "A project switch keeps the workbench shell mounted. Only views that belong to the project start fresh: open the Notes view, edit it, then open the other project." } }
	}
}, _ = { args: { workbench: h() } };
export { _ as KeepsShellMounted, g as default };
