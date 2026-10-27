// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./rich-message-BDq8UfVC.ts";
import { useEffect as a, useState as o } from "react";
import { Button as s, Stack as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/rich-message/streaming-motion.stories.tsx
var d = `Step 1. ${"I read the workspace files, compared them with the plan, and noted what changed. ".repeat(6)}`, f = {
	tags: ["motion"],
	title: "Patterns/Editors/RichMessage/Streaming Motion",
	component: () => {
		let [e, t] = o("Earlier text."), [n, r] = o(!1);
		return a(() => {
			if (!n) return;
			let e = 0, i = setInterval(() => {
				e += 1, t(`Earlier text.\n\n${d.slice(0, Math.ceil(d.length * e / 8))}`), e === 8 && (clearInterval(i), r(!1));
			}, 25);
			return () => clearInterval(i);
		}, [n]), /* @__PURE__ */ u(c, {
			maxW: "xl",
			children: [
				/* @__PURE__ */ l(s, {
					onClick: () => t(`${e} New chunk.`),
					children: "Append chunk"
				}),
				/* @__PURE__ */ l(s, {
					onClick: () => r(!0),
					children: "Replay stream"
				}),
				/* @__PURE__ */ l(i, {
					defaultState: e,
					streaming: !0,
					fullWidth: !0
				})
			]
		});
	}
}, p = { play: async ({ canvasElement: i }) => {
	let a = e(i), o = a.getByText("Earlier text.");
	await n.click(a.getByRole("button", { name: "Append chunk" })), await t(() => r(i.querySelector(".streaming-text-chunk")).toHaveTextContent("New chunk.")), await r(o.isConnected).toBe(!0), await r(o).toHaveTextContent("Earlier text.");
} }, m = { render: () => /* @__PURE__ */ l(i, {
	defaultState: d,
	fullWidth: !0
}) };
export { p as ChunkFade, m as History, f as default };
