// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./workbench-core-N58OeDyx.ts";
import { t as n } from "./controls-view-C3MypQJx.ts";
import { t as r } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as i } from "react";
import { Button as a, Stack as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/controls/controls-view.stories.tsx
function l() {
	let [r] = i(() => {
		let n = t(), r = e(n), i = { name: "Saved value" };
		return r.registerControlsRenderer({
			id: "settings",
			title: "Settings",
			executeQuery: () => ({
				params: [{
					id: "name",
					type: "text",
					name: "Name",
					singleLine: !0,
					defaultValue: ""
				}],
				values: i
			}),
			apply: async ({ values: e }) => {
				if (e.name === "invalid") throw Error("Choose a valid name.");
				i = { ...e };
			}
		}), {
			workbench: n,
			renderers: r,
			contribution: r.getControlsRenderer("settings")
		};
	});
	return /* @__PURE__ */ c(o, {
		h: "full",
		minH: "0",
		children: [/* @__PURE__ */ s(a, {
			onClick: () => r.renderers.refreshControlsRenderer("settings"),
			children: "Refresh saved values"
		}), /* @__PURE__ */ s(n, {
			workbench: r.workbench,
			contribution: r.contribution,
			placement: {
				instanceId: "settings",
				panelId: "settings",
				title: "Settings",
				closable: !1
			}
		})]
	});
}
var u = {
	title: "Workbench/Controls/Apply drafts",
	component: l,
	decorators: [(e) => /* @__PURE__ */ s(r, { children: /* @__PURE__ */ s(e, {}) })]
}, d = {};
function f() {
	let [r] = i(() => {
		let n = t(), r = e(n), i = {};
		return r.registerControlsRenderer({
			id: "instant",
			title: "Immediate choices",
			executeQuery: () => ({
				params: ["first", "second"].map((e) => ({
					id: e,
					type: "text",
					name: e,
					singleLine: !0,
					defaultValue: ""
				})),
				values: i
			}),
			updateValue: async ({ values: e }) => {
				await new Promise((e) => setTimeout(e, 200)), i = { ...e }, r.refreshControlsRenderer("instant");
			}
		}), {
			workbench: n,
			contribution: r.getControlsRenderer("instant")
		};
	});
	return /* @__PURE__ */ s(n, {
		workbench: r.workbench,
		contribution: r.contribution,
		placement: {
			instanceId: "instant",
			panelId: "instant",
			title: "Immediate choices",
			closable: !1
		}
	});
}
var p = { render: () => /* @__PURE__ */ s(f, {}) };
export { d as ApplyResetAndRefresh, p as ImmediateChanges, u as default };
