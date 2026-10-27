// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { n as i, t as a } from "./appearance-settings-panel-BOchMkUC.ts";
import { ThemePreferenceProvider as o, defaultThemePreferences as s } from "@pstdio/ui";
import { jsx as c } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/appearance-settings-panel.stories.tsx
var l = [
	...s,
	{
		id: "lab.paper",
		title: "Paper",
		mode: "light"
	},
	{
		id: "lab.ember",
		title: "Ember",
		mode: "dark"
	}
], u = {
	title: "Settings/Appearance",
	component: () => {
		let e = r();
		return e.preferences.registerSchema({ properties: { [i]: {
			type: "boolean",
			scope: "user",
			default: !0
		} } }), /* @__PURE__ */ c(a, { workbench: e });
	},
	decorators: [(e) => /* @__PURE__ */ c(o, {
		initialPreference: "pstdio-dark",
		themePreferences: l,
		children: /* @__PURE__ */ c(e, {})
	})]
}, d = {}, f = { play: async ({ canvasElement: r }) => {
	let i = t(r).getByRole("checkbox", { name: "Open related resources" });
	await n(i).toBeChecked(), await e.click(i), await n(i).not.toBeChecked();
} };
export { d as Default, f as RelatedResourcePreference, u as default };
