// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./markdown-editor-CsmXwmxe.ts";
import { useState as t } from "react";
import { Box as n, SimpleGrid as r, Stack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/markdown-editor/markdown-editor-lossless.stories.tsx
var c = "# Source preservation\n\nEdit one word in this sentence. Keep {{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}} unchanged.\n\n| Name |Value|\n|:---|---:|\n| Alice | 1 |\n\n[Prompt Studio][project]\n\n[project]: https://example.com  \"Project\"\n\n~~~json\n{\"enabled\": true}\n~~~", l = (l) => {
	let { source: u = c } = l, [d, f] = t(u);
	return /* @__PURE__ */ s(r, {
		columns: {
			base: 1,
			lg: 2
		},
		gap: "md",
		children: [/* @__PURE__ */ o(n, {
			borderWidth: "1px",
			borderColor: "border.subtle",
			minH: "30rem",
			children: /* @__PURE__ */ o(e, {
				defaultState: u,
				isEditable: !0,
				onChange: f
			})
		}), /* @__PURE__ */ s(i, {
			gap: "sm",
			minW: "0",
			children: [/* @__PURE__ */ o(a, {
				textStyle: "label/M/medium",
				children: "Emitted Markdown source"
			}), /* @__PURE__ */ o(n, {
				as: "pre",
				"data-testid": "markdown-editor-output",
				bg: "bg.subtle",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "sm",
				minH: "30rem",
				overflow: "auto",
				p: "sm",
				textStyle: "mono/XS",
				whiteSpace: "pre-wrap",
				children: d
			})]
		})]
	});
}, u = {
	title: "Patterns/Editors/Markdown Editor/Source Preservation",
	component: e,
	parameters: { layout: "padded" }
}, d = { render: () => /* @__PURE__ */ o(l, {}) }, f = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ o(l, { source: "First paragraph.\n\n\n\nSecond paragraph.\n\n\n\nThird paragraph." })
};
export { d as LosslessEditing, f as SelectAllHeadings, u as default };
