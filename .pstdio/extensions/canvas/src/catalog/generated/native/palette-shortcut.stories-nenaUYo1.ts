// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./tooltip-BweQW627.ts";
import { t } from "./palette-shortcut-01lOZVwG.ts";
import { Button as n, HStack as r, Kbd as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/command-palette/palette-shortcut.stories.tsx
var s = {
	title: "Components/PaletteShortcut",
	component: t,
	args: { binding: "Alt+Shift+N" }
}, c = {}, l = { args: { binding: ["Mod+K", "Mod+S"] } }, u = { render: (i) => /* @__PURE__ */ a(e, {
	open: !0,
	content: /* @__PURE__ */ o(r, { children: [/* @__PURE__ */ a("span", { children: "New note" }), /* @__PURE__ */ a(t, { ...i })] }),
	children: /* @__PURE__ */ a(n, { children: "New note" })
}) }, d = { render: () => /* @__PURE__ */ a(e, {
	open: !0,
	content: /* @__PURE__ */ o(r, { children: [/* @__PURE__ */ a("span", { children: "Open search" }), /* @__PURE__ */ o(r, {
		gap: "shortcut-key-gap",
		children: [/* @__PURE__ */ a(i, { children: "⌘" }), /* @__PURE__ */ a(i, { children: "K" })]
	})] }),
	children: /* @__PURE__ */ a(n, { children: "Open search" })
}) };
export { u as InTooltip, c as Inline, d as KeysInTooltip, l as Sequence, s as default };
