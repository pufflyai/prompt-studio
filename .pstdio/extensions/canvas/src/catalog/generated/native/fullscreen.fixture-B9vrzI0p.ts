// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-N58OeDyx.ts";
import { useEffect as t, useState as n } from "react";
import { Box as r, Input as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/workbench/fullscreen.fixture.tsx
var c = (e) => {
	let { name: c, mounted: l, unmounted: u } = e, [d, f] = n("");
	return t(() => (l(), u), [l, u]), /* @__PURE__ */ s(r, {
		p: "md",
		children: [/* @__PURE__ */ o(a, { children: c }), /* @__PURE__ */ o(i, {
			"aria-label": `${c} draft`,
			value: d,
			onChange: (e) => f(e.target.value)
		})]
	});
}, l = (t = "attached", n = !0, r = {}) => {
	let i = {
		kind: "page",
		extensionId: "fullscreen",
		id: "first"
	}, a = e({
		startPage: i,
		initialSidePanelMode: "attached"
	}), s = {
		mounts: 0,
		unmounts: 0
	}, l = () => s.mounts++, u = () => s.unmounts++;
	for (let e of ["first", "other"]) a.modes.registerMode({
		id: e,
		activate() {},
		chrome: {
			status: "status",
			nav: !r.hiddenNav && void 0
		},
		regionSettings: {
			main: { showHeader: !1 },
			side: { floatable: n }
		}
	});
	for (let e of [
		"Editor",
		"Session",
		"Terminal",
		"status"
	]) a.views.registerView({
		id: e,
		title: e,
		body: {
			kind: "react",
			render: () => r.renderEditor?.(e) ?? /* @__PURE__ */ o(c, {
				name: e,
				mounted: l,
				unmounted: u
			})
		}
	});
	for (let e of [
		"first",
		"second",
		"other"
	]) a.pages.registerPage({
		id: e,
		ref: {
			...i,
			id: e
		},
		path: e,
		modeId: e === "other" ? "other" : "first",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "Editor"
			},
			cardinality: "one"
		},
		slots: []
	});
	for (let [e, t] of [["side", "Session"], ["secondary", "Terminal"]]) a.modePlacements.registerPlacement({
		id: t,
		ref: {
			kind: "placement",
			extensionId: "fullscreen",
			id: t
		},
		modeId: "first",
		region: e,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: t
			},
			presence: "open"
		}
	});
	a.pageLocations.switchProject("fullscreen"), a.pageLocations.navigate({
		kind: "page",
		page: i
	});
	for (let e of ["side", "secondary"]) {
		let t = a.layout.getLayout().regions[e].widgets[0]?.placementIdentity;
		t && a.pinPlacement(t, !0);
	}
	return a.shell.setRegionSize("side", 360), a.shell.setRegionSize("secondary", 240), a.shell.setSidePanelPresentation(t), {
		w: a,
		lifecycle: s
	};
};
export { l as t };
