// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./workbench-BbqJVWhj.ts";
import { t as n } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as r } from "react";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/onboarding-frame.tsx
var o = (o) => {
	let { createWorkbench: s } = o, [c] = r(s), l = e(c);
	return /* @__PURE__ */ a(n, {
		themePreferences: l,
		children: /* @__PURE__ */ a(i, {
			h: "520px",
			minH: "360px",
			borderWidth: "1px",
			borderColor: "border.subtle",
			overflow: "hidden",
			children: /* @__PURE__ */ a(t, { workbench: c })
		})
	});
};
export { o as t };
