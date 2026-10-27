// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./square-terminal-DD-4BWnC.ts";
import { t } from "./useTranslation-DvWg4zeU.ts";
import { i as n, t as r } from "./test-CYwQ_LKY.ts";
import { Center as i, Code as a } from "@chakra-ui/react";
import { EmptyState as o, ThemePreferenceProvider as s } from "@pstdio/ui";
import { jsx as c } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/components/browser-sign-in-required.stories.tsx
var l = {
	title: "App/Browser sign-in required",
	component: () => {
		let { t: n } = t();
		return /* @__PURE__ */ c(i, {
			minH: "100dvh",
			w: "full",
			bg: "bg",
			children: /* @__PURE__ */ c(o, {
				icon: /* @__PURE__ */ c(e, {}),
				title: n("browserSignIn.title"),
				description: n("browserSignIn.description"),
				children: /* @__PURE__ */ c(a, { children: "pst" })
			})
		});
	},
	parameters: { layout: "fullscreen" },
	play: async () => {
		await r(await n.findByText("Open Prompt Studio from a terminal")).toBeVisible(), await r(n.getByText("pst")).toBeVisible();
	}
}, u = { decorators: [(e) => /* @__PURE__ */ c(s, {
	initialPreference: "pstdio-light",
	children: /* @__PURE__ */ c(e, {})
}, "pstdio-light")] }, d = { decorators: [(e) => /* @__PURE__ */ c(s, {
	initialPreference: "pstdio-dark",
	children: /* @__PURE__ */ c(e, {})
}, "pstdio-dark")] };
export { d as Dark, u as Light, l as default };
