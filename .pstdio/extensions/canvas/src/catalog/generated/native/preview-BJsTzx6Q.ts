// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./theme-preferences-Bi1xFDtm.ts";
import { ChakraProvider as t, ThemePreferenceProvider as n, psTheme as r } from "@pstdio/ui";
import { jsx as i } from "react/jsx-runtime";
import "@pstdio/ui/style.css";
// extensions/pstdio-base-themes/.storybook/preview.tsx
var a = {
	getItem: () => null,
	setItem: () => {}
}, o = {
	initialGlobals: { theme: "solarized-light" },
	globalTypes: { theme: {
		description: "Theme for the single-theme preview; comparison columns always show all four themes.",
		toolbar: {
			icon: "paintbrush",
			items: e.map((e) => ({
				value: e.id,
				title: e.title
			}))
		}
	} },
	parameters: { layout: "fullscreen" },
	decorators: [(o, s) => /* @__PURE__ */ i(n, {
		initialPreference: s.globals.theme,
		themePreferences: e,
		storage: a,
		children: /* @__PURE__ */ i(t, {
			value: r,
			children: /* @__PURE__ */ i(o, {})
		})
	}, s.globals.theme)]
};
export { o as default };
