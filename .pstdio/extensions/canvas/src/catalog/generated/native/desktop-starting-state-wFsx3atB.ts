// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useEffect as e, useState as t } from "react";
import { Heading as n, Spinner as r, Stack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// clients/desktop/src/renderer/desktop-starting-state.tsx
var c = {
	discovery: "Connecting to Prompt Studio on your computer…",
	verification: "Checking the app files…",
	environment: "Loading your local tools…",
	spawning: "Starting Prompt Studio in the background…",
	database: "Preparing your local data…",
	retiring: "Backing up data from your previous version…",
	migrations: "Updating your local data…",
	extensions: "Loading your tools…",
	readiness: "Preparing your workbench…"
}, l = (e) => {
	let { phase: t, takingLonger: l = !1 } = e;
	return /* @__PURE__ */ s(i, {
		align: "center",
		gap: "lg",
		role: "status",
		"aria-live": "polite",
		children: [/* @__PURE__ */ o(r, {
			size: "lg",
			color: "fg.muted",
			"aria-hidden": "true",
			_motionReduce: { display: "none" }
		}), /* @__PURE__ */ s(i, {
			align: "center",
			gap: "xs",
			textAlign: "center",
			children: [
				/* @__PURE__ */ o(n, {
					textStyle: "heading/M",
					children: "Opening Prompt Studio"
				}),
				/* @__PURE__ */ o(a, {
					color: "fg.muted",
					textStyle: "paragraph/M/regular",
					children: c[t]
				}),
				l && /* @__PURE__ */ o(a, {
					color: "fg.muted",
					textStyle: "paragraph/S/regular",
					children: "This is taking longer than usual. Prompt Studio is still starting. You can keep waiting."
				})
			]
		})]
	});
}, u = (n) => {
	let { phase: r } = n, [i, a] = t(!1);
	return e(() => {
		let e = setTimeout(() => a(!0), 2e4);
		return () => clearTimeout(e);
	}, []), /* @__PURE__ */ o(l, {
		phase: r,
		takingLonger: i
	});
};
export { l as n, u as t };
