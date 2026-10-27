// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./workbench-BYYWgWSr.ts";
import { t as n } from "./workbench-theme-provider-CQSyY8qK.ts";
import { Box as r } from "@chakra-ui/react";
import { jsx as i } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/workbench-story.tsx
var a = (a) => {
	let { initialThemePreference: o, workbench: s, sidePanelBubbleIcon: c } = a, l = e(s);
	return /* @__PURE__ */ i(n, {
		initialThemePreference: o,
		themePreferences: l,
		children: /* @__PURE__ */ i(r, {
			h: "100dvh",
			minH: "0",
			minW: "0",
			overflow: "hidden",
			w: "full",
			children: /* @__PURE__ */ i(t, {
				workbench: s,
				sidePanelBubbleIcon: c
			})
		})
	});
};
export { a as t };
