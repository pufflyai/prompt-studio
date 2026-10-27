// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./palette-CNb9VaIS.ts";
import { useState as t } from "react";
import { Button as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/components/command-palette/palette-live-entries.stories.tsx
var i = (e) => ({
	id: e,
	label: e,
	onActivate: () => void 0
}), a = () => {
	let [a, o] = t(!1), s = a ? [
		i("pstdio-light"),
		i("monokai"),
		i("pstdio-dark")
	] : [i("pstdio-light"), i("pstdio-dark")];
	return /* @__PURE__ */ r(e, {
		open: !0,
		entries: s,
		initialActiveIndex: a ? 2 : 1,
		placeholder: "Choose a theme",
		footerEnd: /* @__PURE__ */ r(n, {
			onClick: () => o(!a),
			children: "Toggle contributed themes"
		}),
		onClose: () => void 0
	});
}, o = {
	title: "Components/Overlays/Palette/Live entries",
	component: a,
	parameters: { layout: "fullscreen" }
}, s = { render: () => /* @__PURE__ */ r(a, {}) };
export { s as PreservesHighlight, o as default };
