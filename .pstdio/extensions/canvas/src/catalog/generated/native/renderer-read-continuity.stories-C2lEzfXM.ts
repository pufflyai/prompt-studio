// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./use-renderer-read-CxbGovUR.ts";
import { t as a } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as o } from "react";
import { Button as s, Stack as c, Text as l } from "@chakra-ui/react";
import { TreeList as u } from "@pstdio/ui";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/renderer-read-continuity.stories.tsx
var p = [{
	id: "navigation",
	nodes: [{
		id: "ticket",
		label: "Ticket"
	}, {
		id: "workspace",
		label: "Project folder"
	}]
}], m = {
	title: "pstdio-workbench/Guides/Progressive read continuity",
	component: () => {
		let [e] = o(() => r()), [t, n] = o(0), [m, h] = o(0), [g] = o(() => Promise.withResolvers()), _ = i({
			workbench: e,
			ownerKey: "navigation",
			queryKey: "navigation",
			refreshKey: String(t),
			load: async (e, n) => (n([]), t === 0 ? (await Promise.resolve(), n(p), h(1), await new Promise((t) => e.addEventListener("abort", () => t(), { once: !0 }))) : (h(2), e.addEventListener("abort", () => g.resolve(), { once: !0 }), await g.promise), e.throwIfAborted(), p),
			subscribe: () => () => {}
		});
		return /* @__PURE__ */ d(a, { children: /* @__PURE__ */ f(c, {
			gap: "md",
			p: "md",
			children: [
				/* @__PURE__ */ d(l, { children: "Keep visible navigation while a replacement read is loading." }),
				/* @__PURE__ */ d(s, {
					onClick: () => n(t + 1),
					children: "Refresh navigation"
				}),
				/* @__PURE__ */ d(s, {
					onClick: () => g.resolve(),
					children: "Finish loading"
				}),
				/* @__PURE__ */ f(l, { children: [
					"Read ",
					m,
					" started"
				] }),
				/* @__PURE__ */ d(l, { children: _.loading ? "Loading" : "Ready" }),
				/* @__PURE__ */ d(u, {
					sections: _.value ?? [],
					expandedSectionIds: ["navigation"]
				})
			]
		}) });
	},
	tags: ["!manifest"],
	parameters: { layout: "fullscreen" }
}, h = { play: async ({ canvasElement: r }) => {
	let i = t(r), a = await i.findByRole("option", { name: /^Ticket$/ }), o = i.getByRole("option", { name: /^Project folder$/ });
	await e.click(i.getByRole("button", { name: "Refresh navigation" })), await i.findByText("Read 2 started"), await n(a).toBeVisible(), await n(o).toBeVisible(), await e.click(i.getByRole("button", { name: "Finish loading" })), await i.findByText("Ready"), await n(a).toBeVisible(), await n(o).toBeVisible();
} };
export { h as RefreshBeforeCompletion, m as default };
