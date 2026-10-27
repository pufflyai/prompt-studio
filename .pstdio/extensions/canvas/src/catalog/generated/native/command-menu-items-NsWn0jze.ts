// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { s as e } from "./workbench-core-N58OeDyx.ts";
import { t } from "./icon-D3uE7jD-.ts";
import { n, r } from "./menu-entries-CDhtPgU6.ts";
import { Box as i, Image as a } from "@chakra-ui/react";
import { PaletteShortcut as o, Tooltip as s } from "@pstdio/ui";
import { jsx as c } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/menus/command-menu-items.tsx
var l = (e) => {
	let { icon: n, iconSrc: r } = e;
	return r ? /* @__PURE__ */ c(i, {
		boxSize: "16px",
		bg: "white",
		borderRadius: "4px",
		p: "1px",
		display: "grid",
		placeItems: "center",
		children: /* @__PURE__ */ c(a, {
			src: r,
			alt: "",
			"aria-hidden": "true",
			htmlWidth: 14,
			htmlHeight: 14,
			display: "block",
			w: "full",
			h: "full",
			fit: "contain"
		})
	}) : n ? /* @__PURE__ */ c(t, { name: n }) : void 0;
}, u = (e) => {
	let { binding: n, external: r, disabledReason: a, readOnly: l } = e;
	if (l && a) return /* @__PURE__ */ c(s, {
		content: a,
		children: /* @__PURE__ */ c(i, {
			as: "span",
			tabIndex: 0,
			"aria-label": a,
			children: /* @__PURE__ */ c(t, { name: "Info" })
		})
	});
	if (r) return /* @__PURE__ */ c(t, {
		name: "ArrowUpRight",
		size: 14,
		color: "fg.muted"
	});
	if (n) return /* @__PURE__ */ c(o, { binding: n });
}, d = (t, n, r) => ({
	id: n.id,
	label: n.label,
	group: n.group,
	commandId: n.commandId,
	description: n.description,
	icon: l(n),
	endContent: u({
		external: n.external,
		binding: n.binding,
		disabledReason: n.description,
		readOnly: n.readOnly
	}),
	disabled: n.disabled,
	readOnly: n.readOnly,
	separatorBefore: n.separatorBefore,
	onAction: n.run ? () => {
		n.run?.().catch((i) => {
			r ? r(i) : e(t, n.label, i);
		});
	} : void 0
}), f = (e) => {
	let t = n(e), r = (n) => t.filter((e) => e.kernel === n).map((t) => d(e.workbench, t, e.onCommandError));
	return {
		regularItems: r(!1),
		kernelItems: r(!0)
	};
}, p = (e) => {
	let { regularItems: t, kernelItems: n } = f(e);
	return [...t, ...r(n, t.length > 0)];
};
export { f as n, p as r, u as t };
