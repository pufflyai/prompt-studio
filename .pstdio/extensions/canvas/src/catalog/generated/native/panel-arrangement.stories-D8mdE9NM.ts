// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { r as a } from "./terminal-module-DSNuh2gh.ts";
import { t as o } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as s } from "./workbench-story-BezxAS71.ts";
import { Activity as c, useState as l } from "react";
import { Box as u, Button as d, Input as f, Text as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/panel-arrangement.stories.tsx
var g = (e = !1, t = /* @__PURE__ */ m(p, {
	p: "md",
	children: "Page without a header"
}), n = !0, r = !0, a = "side") => {
	let o = {
		kind: "page",
		extensionId: "storybook",
		id: "arrangement"
	}, s = i({
		startPage: o,
		initialSidePanelMode: a === "side" ? "attached" : "closed",
		defaultPanelOpenByRegionId: { secondary: r }
	});
	s.modes.registerMode({
		id: "arrangement",
		label: "Arrange tabs",
		regionSettings: { main: {
			showHeader: !1,
			acceptsTabs: n
		} },
		activate() {}
	}), s.views.registerView({
		id: "page",
		title: "Page",
		body: {
			kind: "react",
			render: () => t
		}
	}), s.views.registerView({
		id: "editor",
		title: "Session",
		icon: "MessageCircle",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ h(u, {
				p: "md",
				children: [/* @__PURE__ */ m(p, { children: e.instance.resource?.label }), /* @__PURE__ */ m(f, {
					"aria-label": "Retained draft",
					placeholder: "Type here, then move this tab"
				})]
			})
		}
	}), s.views.registerView({
		id: "menu",
		title: "Tools",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ m(p, {
				p: "md",
				children: "Panel menu"
			})
		}
	}), s.viewMenus.registerViewMenu({
		id: "tools",
		ownerViewId: "editor",
		viewId: "menu",
		side: "right"
	}), s.pages.registerPage({
		id: o.id,
		ref: o,
		path: "arrangement",
		modeId: "arrangement",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "page"
			},
			cardinality: "one"
		},
		slots: []
	}), s.commands.registerCommand({
		id: "add-session",
		label: "New session"
	}, { execute: (e, t) => s.navigation.openTarget({
		kind: "panel",
		panel: {
			kind: "placement",
			extensionId: "storybook",
			id: "sessions"
		},
		resource: {
			type: "session",
			id: crypto.randomUUID(),
			label: "New session"
		},
		open: "pin",
		region: t?.region
	}) }), s.modePlacements.registerPlacement({
		id: "sessions",
		ref: {
			kind: "placement",
			extensionId: "storybook",
			id: "sessions"
		},
		modeId: "arrangement",
		region: "side",
		item: {
			kind: "binding",
			binding: {
				kinds: [{
					kind: "resource-kind",
					id: "session"
				}],
				view: {
					kind: "view",
					id: "editor"
				},
				cardinality: "many",
				add: {
					kind: "command",
					target: { command: {
						kind: "command",
						extensionId: "storybook",
						id: "add-session"
					} }
				}
			}
		},
		tab: { getSnapshot: (e) => ({
			label: e.resource?.label,
			menu: [{
				id: "session-actions",
				rows: [{
					id: "new",
					label: "New session",
					icon: "MessageSquarePlus",
					action: {
						kind: "command",
						commandId: "add-session"
					}
				}]
			}]
		}) }
	}), s.commands.registerCommand({
		id: "storybook.command.add-session",
		label: "Create session"
	}, { execute: (e, t) => s.commands.executeCommand("add-session", e, t) }), s.pageLocations.switchProject("arrangement");
	for (let t = 0; t < (e ? 8 : 2); t++) s.navigation.openTarget({
		kind: "panel",
		panel: {
			kind: "placement",
			extensionId: "storybook",
			id: "sessions"
		},
		resource: {
			type: "session",
			id: String(t),
			label: t === 0 ? "Review session" : `Session with a longer name ${t}`
		},
		region: a,
		open: t === (e ? 7 : 1) ? "preview" : "pin"
	});
	return s;
}, _ = {
	title: "pstdio-workbench/Reference/Core API/Panel arrangement",
	component: s,
	parameters: { layout: "fullscreen" }
}, v = { args: { workbench: g() } }, y = /* @__PURE__ */ m(u, {
	asChild: !0,
	h: "full",
	minH: "full",
	w: "full",
	children: /* @__PURE__ */ m("iframe", {
		title: "Headerless webview",
		sandbox: "allow-scripts",
		srcDoc: "<!doctype html><html\n            ondragover=\"event.preventDefault()\"\n            ondrop=\"event.preventDefault(); document.querySelector('output').textContent = event.dataTransfer.files[0]?.name\">\n          <body><h1>Headerless webview</h1>\n            <input aria-label=\"Webview draft\" placeholder=\"Edit this draft before dragging a tab\">\n            <p>Drop a file anywhere in this webview.</p>\n            <output aria-label=\"Dropped file\"></output>\n          </body></html>"
	})
}), b = {
	args: { workbench: g(!1, y) },
	play: async ({ canvasElement: e }) => {
		await r(e.querySelector("iframe[title=\"Headerless webview\"]")).toBeVisible(), await r(e.querySelector("[data-workbench-panel-header=\"main\"]")).not.toBeVisible(), await r(e.querySelector("[data-workbench-tab-drop=\"main\"]")).not.toBeVisible();
	}
}, x = {
	...b,
	args: { workbench: g(!1, y, !1) }
}, S = { args: { workbench: g(!0) } }, C = g(), w = C.layout.getLayout().regions.side.widgets.find((e) => e.tabRetention === "preview");
C.movePanel(w.widgetId, "secondary");
var T = { args: { workbench: C } }, E = g(), D = E.layout.getLayout().regions.side.widgets[0];
E.movePanel(D.widgetId, "secondary"), E.layout.updateWidgetPlacement(D.widgetId, {
	title: "T",
	resource: {
		...D.resource,
		label: "T"
	}
});
var O = { args: { workbench: E } }, k = g();
for (let e of k.layout.getLayout().regions.side.widgets) k.closePlacement(e.placementIdentity);
k.movePanel(k.layout.getLayout().regions.main.widgets[0].widgetId, "side");
var A = { args: { workbench: k } }, j = g();
j.sidePanel.setMode("floating");
var M = { args: { workbench: j } }, N = g();
N.registerModule(a()), N.shellPlacements.openPlacement({
	placementId: "workbench.terminal",
	resource: {
		type: "terminal",
		id: "restored-terminal",
		label: "Restored terminal"
	},
	title: "Restored terminal",
	open: "pin"
}), N.shell.setRegionOpen("secondary", !0);
var P = { args: { workbench: N } }, F = g(), I = F.layout.getLayout().regions.side.widgets.find((e) => e.tabRetention === "preview");
F.movePanel(I.widgetId, "secondary"), F.navigation.openTarget({
	kind: "panel",
	panel: {
		kind: "placement",
		extensionId: "storybook",
		id: "sessions"
	},
	resource: {
		type: "session",
		id: "kept-preview",
		label: "Unpinned session to keep"
	},
	open: "preview"
});
var L = { args: { workbench: F } }, R = { args: { workbench: g(!1, void 0, void 0, !1) } }, z = g(!1, void 0, void 0, !1, "main");
z.shell.setHeaderVisible("main", !0);
var B = { args: { workbench: z } }, V = g(!1, void 0, void 0, !1, "main");
V.shell.setHeaderVisible("main", !0), V.shell.repositionPanel("side", "left"), V.shell.repositionPanel("secondary", "top");
var H = { args: { workbench: V } }, U = g();
U.shell.repositionPanel("side", "left"), U.shell.repositionPanel("secondary", "top");
var W = { args: { workbench: U } }, G = g(!1, void 0, void 0, !1, "main");
G.shell.setHeaderVisible("main", !0), G.shell.repositionPanel("side", "left");
var K = { args: { workbench: G } }, q = g(!1, void 0, void 0, !1);
q.shell.repositionPanel("secondary", "top");
var J = { args: { workbench: q } }, Y = (e, t = !0) => {
	let n = g(!1, void 0, void 0, !1, e), r = n.layout.getLayout().regions[e].widgets.find((e) => e.tabRetention === "persistent");
	return n.closePlacement(r.placementIdentity), n.modes.getMode("arrangement").regionSettings[e] = { movable: t }, n;
}, X = { args: { workbench: Y("side") } }, Z = { args: { workbench: Y("secondary") } }, Q = { args: { workbench: Y("side", !1) } }, $ = { args: { workbench: Y("secondary", !1) } }, ee = { args: { workbench: g(!1, void 0, void 0, !1, "secondary") } }, te = (e) => {
	let { workbench: t } = e, [n, r] = l(!0), [i, a] = l(!0);
	return /* @__PURE__ */ h(o, { children: [
		/* @__PURE__ */ m(d, {
			onClick: () => r(!1),
			children: "Close example workbench"
		}),
		/* @__PURE__ */ m(d, {
			onClick: () => a(!i),
			children: i ? "Hide workbench" : "Show workbench"
		}),
		n ? /* @__PURE__ */ m(c, {
			mode: i ? "visible" : "hidden",
			children: /* @__PURE__ */ m(s, { workbench: t })
		}) : /* @__PURE__ */ m(p, { children: "Workbench closed" })
	] });
}, ne = {
	args: { workbench: g(!1, /* @__PURE__ */ m(u, {
		asChild: !0,
		h: "full",
		w: "full",
		children: /* @__PURE__ */ m("iframe", {
			title: "Retained Timeline",
			srcDoc: "<input aria-label=\"Unsaved Timeline draft\">"
		})
	})) },
	render: (e) => /* @__PURE__ */ m(te, { workbench: e.workbench }),
	play: async ({ canvasElement: i, args: a }) => {
		await t(() => r(i.querySelector("iframe[title=\"Retained Timeline\"]")?.contentDocument?.querySelector("input")).toBeTruthy());
		let o = i.querySelector("iframe[title=\"Retained Timeline\"]"), s = o.contentDocument, c = s.querySelector("input"), l = o.closest("[data-workbench-instance]").parentElement;
		await e.type(c, "Keep this unsaved draft");
		for (let e of [
			"first-preview",
			"second-preview",
			"first-preview"
		]) await a.workbench.navigation.openTarget({
			kind: "panel",
			panel: {
				kind: "placement",
				extensionId: "storybook",
				id: "sessions"
			},
			resource: {
				type: "session",
				id: e,
				label: e
			},
			open: "preview"
		}), await t(() => r(n(i).getAllByText(e, { exact: !0 })[0]).toBeVisible()), await r(o.contentDocument).toBe(s), await r(c.value).toBe("Keep this unsaved draft");
		await e.click(n(i).getByRole("button", { name: "Hide workbench" })), await e.click(n(i).getByRole("button", { name: "Show workbench" })), await t(() => r(o).toBeVisible()), await r(o.contentDocument).toBe(s), await r(c.value).toBe("Keep this unsaved draft"), await e.click(n(i).getByRole("button", { name: "Close example workbench" })), await t(() => r(l.isConnected).toBe(!1)), await r(l.hasChildNodes()).toBe(!1);
	}
};
export { ee as BottomTabs, R as ClosedBottom, K as ClosedLeftSide, H as ClosedReversed, B as ClosedSide, J as ClosedTopBottom, S as Crowded, M as DetachedSide, x as DisallowedWebviewDestination, $ as FixedLastBottomTab, Q as FixedLastSideTab, v as HeaderlessMain, b as HeaderlessWebview, Z as LastBottomTab, X as LastSideTab, A as MovedSingleView, L as PreviewInsertion, W as Repositioned, T as SecondarySession, ne as SessionSwitchKeepsMainView, O as ShortDestinationTab, P as TerminalIcons, g as createArrangementWorkbench, _ as default };
