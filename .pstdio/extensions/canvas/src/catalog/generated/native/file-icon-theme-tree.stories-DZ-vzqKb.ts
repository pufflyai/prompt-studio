// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./folder-DJ8ZbA4G.ts";
import { t } from "./get-file-type-icon-Bq5BxZ4Y.ts";
import { t as n } from "./tree-list-Db4WJcm2.ts";
import { useState as r } from "react";
import { Stack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/utils/apply-file-icon-theme-preference.ts
var c = (e) => {
	let t = e.toLowerCase().split("."), n = [];
	for (let e = 1; e < t.length; e += 1) n.push(t.slice(e).join("."));
	return n;
}, l = (e, t, n) => {
	if (n) return e.defaults.folder;
	let r = e.fileNames[t.toLowerCase()];
	if (r) return r;
	for (let n of c(t)) {
		let t = e.fileExtensions[n];
		if (t) return t;
	}
	return e.defaults.file;
}, u = (e, t) => {
	if (t.fontId) {
		let n = e.fonts.find((n) => n.fontFamily === `${e.id}-${t.fontId}`);
		if (n) return n.fontFamily;
	}
	return e.fonts[0]?.fontFamily;
}, d = (e) => {
	let t = /^\\([0-9a-fA-F]+)$/.exec(e);
	return t ? String.fromCodePoint(Number.parseInt(t[1], 16)) : e;
}, f = (e, t, n = !1) => {
	if (!e) return;
	let r = l(e, t, n);
	if (!r) return;
	let i = e.definitions[r];
	if (!i?.fontCharacter) return;
	let a = u(e, i);
	if (a) return {
		fontFamily: a,
		fontCharacter: d(i.fontCharacter),
		fontColor: i.fontColor
	};
}, p = (n, r = {}) => {
	let { isDirectory: i = !1, theme: a, size: s = 16 } = r, c = f(a, n, i);
	if (c) {
		let e = {
			fontFamily: `"${c.fontFamily}"`,
			color: c.fontColor,
			fontSize: s,
			lineHeight: 1,
			display: "inline-flex"
		};
		return /* @__PURE__ */ o("span", {
			"aria-hidden": "true",
			style: e,
			children: c.fontCharacter
		});
	}
	if (i) return /* @__PURE__ */ o(e, { size: s });
	let l = t(n);
	return /* @__PURE__ */ o(l, { size: s });
}, m = {
	title: "Components/Data Display/File Icon Theme Tree",
	component: n
}, h = {
	id: "pstdio-base-themes.seti",
	title: "Seti (demo)",
	definitions: {
		_file: {
			fontCharacter: "\\E001",
			fontColor: "#9aa0a6"
		},
		_folder: {
			fontCharacter: "\\E002",
			fontColor: "#ddba78"
		},
		_typescript: {
			fontCharacter: "\\E099",
			fontColor: "#519aba"
		},
		_json: {
			fontCharacter: "\\E10A",
			fontColor: "#cbcb41"
		},
		_markdown: {
			fontCharacter: "\\E0A9",
			fontColor: "#519aba"
		}
	},
	fileExtensions: {
		ts: "_typescript",
		tsx: "_typescript",
		json: "_json",
		md: "_markdown"
	},
	fileNames: { "package.json": "_json" },
	defaults: {
		file: "_file",
		folder: "_folder"
	},
	fonts: [{
		fontFamily: "pstdio-base-themes.seti-seti",
		src: [{
			url: "data:font/woff;base64,",
			format: "woff"
		}]
	}]
}, g = [
	{
		id: "src",
		label: "src",
		isDirectory: !0
	},
	{
		id: "src/index.ts",
		label: "index.ts"
	},
	{
		id: "src/widget.tsx",
		label: "widget.tsx"
	},
	{
		id: "src/notes.md",
		label: "notes.md"
	},
	{
		id: "package.json",
		label: "package.json"
	},
	{
		id: "LICENSE",
		label: "LICENSE"
	}
], _ = (e) => [{
	id: "files",
	nodes: g.map((t) => ({
		id: t.id,
		label: t.label,
		icon: p(t.label, {
			isDirectory: t.id === "src",
			theme: e
		}),
		isNavigable: !0
	}))
}], v = ({ theme: e }) => {
	let [t, a] = r("src/index.ts");
	return /* @__PURE__ */ o(i, {
		maxW: "20rem",
		borderWidth: "1px",
		p: "xs",
		gap: "xs",
		children: /* @__PURE__ */ o(n, {
			sections: _(e),
			activeNodeId: t,
			rowVariant: "tree",
			onNavigate: (e) => a(e.nodeId)
		})
	});
}, y = { render: () => /* @__PURE__ */ s(i, {
	gap: "md",
	children: [/* @__PURE__ */ o(a, {
		textStyle: "paragraph/S/regular",
		color: "fg.muted",
		children: "Icons resolved from the contributed Seti theme (colored per file type)."
	}), /* @__PURE__ */ o(v, { theme: h })]
}) }, b = { render: () => /* @__PURE__ */ s(i, {
	gap: "md",
	children: [/* @__PURE__ */ o(a, {
		textStyle: "paragraph/S/regular",
		color: "fg.muted",
		children: "No active icon theme — falls back to built-in Lucide icons."
	}), /* @__PURE__ */ o(v, {})]
}) };
export { b as LucideFallback, y as WithSetiTheme, m as default };
