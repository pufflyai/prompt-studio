// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Icon as e } from "@chakra-ui/react";
import { resolveIconComponent as t } from "@pstdio/ui";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/shared/icon.tsx
var r = (r) => {
	let { name: i, size: a = 14, ...o } = r;
	if (!i) return null;
	let s = t(i);
	return s ? /* @__PURE__ */ n(e, {
		as: s,
		boxSize: typeof a == "number" ? `${a}px` : a,
		"aria-hidden": "true",
		...o
	}) : null;
};
export { r as t };
