// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-N58OeDyx.ts";
import { Box as t, Text as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/panel-policy.fixture.tsx
var a = (a = {}, o = !1) => {
	let s = {
		kind: "page",
		extensionId: "storybook",
		id: "policy"
	}, c = e({
		startPage: s,
		initialSidePanelMode: "attached"
	});
	c.modes.registerMode({
		id: "policy",
		activate() {},
		panelHeaders: o ? "legacy" : void 0,
		chrome: { status: "status" },
		regionSettings: {
			main: { showHeader: !1 },
			side: a,
			secondary: a
		}
	});
	for (let [e, a] of [
		["main", "Main page"],
		["side", "Session"],
		["secondary", "Terminal"],
		["status", "Mode status"]
	]) c.views.registerView({
		id: e,
		title: a,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ r(t, {
				p: "md",
				children: /* @__PURE__ */ i(n, { children: [a, " content"] })
			})
		}
	});
	c.pages.registerPage({
		id: "policy",
		ref: s,
		path: "policy",
		modeId: "policy",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "main"
			},
			cardinality: "one"
		},
		slots: []
	});
	for (let e of ["side", "secondary"]) c.modePlacements.registerPlacement({
		id: e,
		ref: {
			kind: "placement",
			extensionId: "storybook",
			id: e
		},
		modeId: "policy",
		region: e,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: e
			},
			presence: "open"
		}
	});
	return c.pageLocations.switchProject("panel-policy"), c.pageLocations.navigate({
		kind: "page",
		page: s
	}), c;
};
export { a as t };
