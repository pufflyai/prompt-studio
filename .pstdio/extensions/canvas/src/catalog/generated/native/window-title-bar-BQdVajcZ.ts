// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./window-title-bar-hwilC3c8.ts";
import { createSlotRecipeContext as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/tab-strip/window-title-bar.tsx
var { withProvider: i, withContext: a } = t({ recipe: e }), o = i("div", "root"), s = a("div", "content"), c = a("div", "actions"), l = (e) => {
	let { platform: t, children: i, actions: a } = e;
	return /* @__PURE__ */ n(o, {
		controls: t === "darwin" ? "mac" : "overlay",
		"data-window-title-bar": "",
		children: /* @__PURE__ */ r(s, { children: [i, a && /* @__PURE__ */ n(c, { children: a })] })
	});
};
export { l as t };
