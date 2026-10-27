// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useEffect as e, useRef as t } from "react";
import { ScrollArea as n } from "@pstdio/ui";
import { jsx as r } from "react/jsx-runtime";
// clients/landing-page/src/components/workbench/page-scroll.tsx
var i = (i) => {
	let { children: a, pageKey: o } = i, s = t(null);
	return e(() => {
		o && s.current?.scrollTo({
			top: 0,
			left: 0
		});
	}, [o]), /* @__PURE__ */ r(n, {
		height: "100%",
		width: "100%",
		viewportRef: s,
		children: a
	});
};
export { i as t };
