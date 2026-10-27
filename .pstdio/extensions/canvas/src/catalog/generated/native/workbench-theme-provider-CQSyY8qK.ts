// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createContext as e, useContext as t } from "react";
import { ChakraProvider as n, FileIconThemePreferenceProvider as r, ThemePreferenceProvider as i, psTheme as a } from "@pstdio/ui";
import { jsx as o } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/theme/workbench-theme-provider.tsx
var s = e(!1), c = (e) => {
	let { children: c, initialThemePreference: l, themePreferences: u, fileIconThemePreferences: d } = e;
	return t(s) ? c : /* @__PURE__ */ o(s, {
		value: !0,
		children: /* @__PURE__ */ o(i, {
			initialPreference: l,
			defaultPreference: e.defaultThemePreference,
			preferenceScope: e.preferenceScope,
			storage: e.themeStorage,
			themePreferences: u,
			children: /* @__PURE__ */ o(r, {
				themePreferences: d,
				children: /* @__PURE__ */ o(n, {
					value: a,
					children: c
				})
			})
		})
	});
};
export { c as t };
