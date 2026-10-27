// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./rich-message-BDq8UfVC.ts";
import { useState as t } from "react";
import { Box as n, Button as r, Stack as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/rich-message/rich-message-editing.stories.tsx
var s = "Keep **source** spelling.\n\n[Notes][notes]\n\n[notes]: https://example.com \"Title\"\n\n~~~ts\nconst value = 1;\n~~~", c = {
	title: "Patterns/Chat/Rich Message Editing",
	component: e,
	tags: ["!manifest"]
};
function l() {
	let [c, l] = t(!1), [u, d] = t(s);
	return /* @__PURE__ */ o(i, { children: [
		/* @__PURE__ */ a(r, {
			onClick: () => l((e) => !e),
			children: c ? "Finish editing" : "Edit message"
		}),
		/* @__PURE__ */ a(e, {
			defaultState: s,
			isEditable: c,
			onChange: d
		}),
		/* @__PURE__ */ a(n, {
			as: "pre",
			"data-testid": "emitted-markdown",
			children: u
		})
	] });
}
var u = { render: () => /* @__PURE__ */ a(l, {}) };
export { u as EnableEditing, c as default };
