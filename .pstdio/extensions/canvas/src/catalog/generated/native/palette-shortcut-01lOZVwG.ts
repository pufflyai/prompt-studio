// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-left-DwicprnJ.ts";
import { t } from "./arrow-right-C4vsuHeN.ts";
import { t as n } from "./command-Dtx3XZCF.ts";
import { t as r } from "./option-Dxq8j7Pk.ts";
import { Fragment as i } from "react";
import { Kbd as a, chakra as o, defineRecipe as s } from "@chakra-ui/react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/theme/recipes/shortcut-keys.ts
var d = s({ base: {
	display: "inline-flex",
	alignItems: "center",
	gap: "shortcut-key-gap",
	verticalAlign: "middle",
	whiteSpace: "nowrap"
} }), f = o("span", d), p = {
	alt: { label: "Alt" },
	control: { label: "Ctrl" },
	ctrl: { label: "Ctrl" },
	mod: { label: "Ctrl" },
	shift: { label: "Shift" }
}, m = {
	alt: {
		label: "Option",
		Icon: r
	},
	cmd: {
		label: "Command",
		Icon: n
	},
	command: {
		label: "Command",
		Icon: n
	},
	meta: {
		label: "Command",
		Icon: n
	},
	mod: {
		label: "Command",
		Icon: n
	},
	option: {
		label: "Option",
		Icon: r
	},
	shift: { label: "Shift" }
}, h = {
	arrowleft: {
		label: "Arrow Left",
		Icon: e
	},
	arrowright: {
		label: "Arrow Right",
		Icon: t
	}
}, g = () => {
	if (typeof navigator > "u") return "linux";
	let e = navigator.platform?.toLowerCase() ?? "";
	return e.includes("mac") ? "mac" : e.includes("win") ? "win" : "linux";
}, _ = (e, t = g()) => {
	let n = e.toLowerCase(), r = t === "mac" ? m : p;
	return h[n] ?? r[n] ?? { label: e };
}, v = (e) => e.split("+").map((e) => e.trim()).filter(Boolean), y = (e) => (Array.isArray(e) ? e.map(v) : [v(e)]).map((e) => e.map((e) => _(e))), b = (e) => {
	let { binding: t } = e, n = y(t);
	return /* @__PURE__ */ l(c, { children: n.map((e, t) => /* @__PURE__ */ u(i, { children: [/* @__PURE__ */ l(f, { children: e.map((e, t) => /* @__PURE__ */ l(a, {
		"aria-label": e.label,
		children: e.Icon ? /* @__PURE__ */ l(e.Icon, {
			size: 12,
			"aria-hidden": "true"
		}) : e.label
	}, `${e.label}-${t}`)) }), t < n.length - 1 ? " then " : null] }, `${e.map((e) => e.label).join("+")}-${t}`)) });
};
export { b as t };
