// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useEffect as e, useRef as t } from "react";
import { Box as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// extensions/pstdio-artifacts/src/components/html-preview-theme.ts
var i = {
	bg: "colors-bg",
	surface: "colors-bg-muted",
	fg: "colors-fg",
	muted: "colors-fg-muted",
	border: "colors-border",
	accent: "colors-fg-info",
	font: "fonts-body"
}, a = (e, t) => {
	if (!e) return;
	let n = getComputedStyle(document.documentElement), r = n.colorScheme === "dark" ? "dark" : "light";
	e.style.colorScheme = r;
	let a = Object.fromEntries(Object.entries(i).map(([e, t]) => [`--artifact-${e}`, n.getPropertyValue(`--chakra-${t}`).trim()]));
	e.contentWindow?.postMessage({
		type: "pstdio.preview-theme",
		mode: r,
		variables: a,
		title: t
	}, "*");
}, o = (e = !1) => {
	window.addEventListener("message", (t) => {
		if (t.source !== window.parent || t.data?.type !== "pstdio.preview-theme") return;
		let n = document.documentElement;
		n.dataset.theme = t.data.mode, n.style.colorScheme = t.data.mode;
		for (let [e, r] of Object.entries(t.data.variables)) typeof r == "string" && r && n.style.setProperty(e, r);
		if (e) {
			let e = document.querySelector("iframe");
			e && (e.title = t.data.title, e.style.colorScheme = t.data.mode, e.contentWindow?.postMessage(t.data, "*"));
		}
	});
}, s = `<style>
:root { color-scheme: light dark; }
body {
  background: var(--artifact-bg, Canvas);
  color: var(--artifact-fg, CanvasText);
  font-family: var(--artifact-font, system-ui, sans-serif);
}
</style><script>(${o.toString()})()<\/script>`, c = `<script>(${o.toString()})(true)<\/script>`, l = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'", u = (e) => e.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"), d = (e) => `<!doctype html><meta http-equiv="Content-Security-Policy" content="${l}">
<meta name="referrer" content="no-referrer">
<style>html,body{height:100%;margin:0}iframe{display:block;width:100%;height:100%;border:0}</style>
${c}
<iframe sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${u(`<!doctype html><meta name="referrer" content="no-referrer">${s}${e}`)}"></iframe>`, f = (i) => {
	let { html: o, title: s } = i, c = t(null);
	return e(() => {
		a(c.current, s);
		let e = new MutationObserver(() => a(c.current, s));
		return e.observe(window.document.documentElement, {
			attributes: !0,
			attributeFilter: [
				"class",
				"style",
				"data-theme",
				"data-color-mode"
			]
		}), () => e.disconnect();
	}, [s]), /* @__PURE__ */ r(n, {
		asChild: !0,
		width: "full",
		height: "full",
		minHeight: "0",
		border: "none",
		bg: "bg",
		children: /* @__PURE__ */ r("iframe", {
			ref: c,
			title: s,
			srcDoc: d(o),
			sandbox: "allow-scripts",
			referrerPolicy: "no-referrer",
			onLoad: () => a(c.current, s)
		})
	});
};
export { f as t };
