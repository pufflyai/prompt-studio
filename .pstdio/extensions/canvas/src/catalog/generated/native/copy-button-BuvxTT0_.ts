// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./copy-COTDVt4R.ts";
import { t as n } from "./tooltip-BweQW627.ts";
import { useEffect as r, useRef as i, useState as a } from "react";
import { IconButton as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
// packages/ui/src/components/primitives/copy-button.tsx
var c = (c) => {
	let { text: l, label: u = "Copy", onCopy: d, onCopyError: f, disabled: p, ...m } = c, [h, g] = a("ready"), _ = i(null);
	r(() => () => {
		_.current && clearTimeout(_.current);
	}, []);
	let v = async () => {
		try {
			await navigator.clipboard.writeText(typeof l == "function" ? l() : l), g("copied"), d?.();
		} catch (e) {
			g("failed"), f?.(e);
		}
		_.current && clearTimeout(_.current), _.current = setTimeout(() => g("ready"), 1500);
	}, y = u;
	return h === "copied" && (y = "Copied"), h === "failed" && (y = "Copy failed. Try again."), /* @__PURE__ */ s(n, {
		content: y,
		closeDelay: 150,
		children: /* @__PURE__ */ s(o, {
			variant: "ghost",
			size: "sm",
			...m,
			"aria-label": y,
			disabled: p || !l,
			onClick: v,
			children: s(h === "copied" ? e : t, {})
		})
	});
};
export { c as t };
