// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./html-preview-DhmLvXIL.ts";
import { Box as t, Button as n, Stack as r } from "@chakra-ui/react";
import { ThemePreferenceProvider as i, useThemePreference as a } from "@pstdio/ui";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// extensions/pstdio-artifacts/src/components/html-preview.stories.tsx
var c = {
	title: "Extensions/Artifacts/HtmlPreview",
	component: e,
	decorators: [(e) => /* @__PURE__ */ o(t, {
		height: "lg",
		children: /* @__PURE__ */ o(e, {})
	})],
	args: {
		title: "Interactive artifact",
		html: "<h1>Release checklist</h1><p>An interactive, self-contained page.</p><button onclick=\"this.textContent = 'Complete'\">Mark complete</button>"
	}
}, l = {}, u = {
	tags: ["!manifest"],
	args: {
		title: "Navigation isolation",
		html: "<h1>Local preview</h1>\n<button onclick=\"this.textContent='Complete'\">Mark complete</button>\n<button onclick=\"location.href='https://artifact-network.test/script'\">Script navigation</button>\n<a href=\"https://artifact-network.test/link\">Link navigation</a>\n<button onclick=\"const meta=document.createElement('meta');meta.httpEquiv='refresh';meta.content='0;url=https://artifact-network.test/refresh';document.head.append(meta)\">Meta refresh</button>"
	}
}, d = { args: { html: `<h1>Release notes</h1>${"<p>A saved update that remains available after the workspace is removed.</p>".repeat(30)}` } }, f = () => {
	let { toggleThemePreference: t } = a();
	return /* @__PURE__ */ s(r, {
		height: "full",
		children: [/* @__PURE__ */ o(n, {
			onClick: t,
			children: "Toggle theme"
		}), /* @__PURE__ */ o(e, {
			title: "Theme-aware artifact",
			html: "<style>section{background:var(--artifact-surface);border:1px solid var(--artifact-border);padding:24px}p{color:var(--artifact-muted)}button{color:var(--artifact-accent)}</style><section><h1>Release checklist</h1><p>Theme colors follow the dashboard.</p><button onclick=\"this.textContent='Complete'\">Mark complete</button></section>"
		})]
	});
}, p = { render: () => /* @__PURE__ */ o(i, {
	initialPreference: "pstdio-light",
	children: /* @__PURE__ */ o(f, {})
}) };
export { l as Interactive, d as LongContent, u as NavigationIsolation, p as ThemeAware, c as default };
