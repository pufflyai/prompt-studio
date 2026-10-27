// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./chat-panel-DXY6mCVA.ts";
import { useState as i } from "react";
import { Box as a, Button as o, Stack as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/collapsed-user-message.stories.tsx
var u = "Please review the release checklist and explain each remaining risk. Include the current status, the responsible owner, the next action, and the validation evidence for every item. Keep the summary useful for someone who has not read the source code.", d = (e) => [{
	id: "prompt",
	role: "user",
	parts: [{
		type: "text",
		text: e
	}]
}, {
	id: "answer",
	role: "assistant",
	parts: [{
		type: "text",
		text: "I will review the remaining risks."
	}]
}];
function f(e) {
	let { text: t, narrow: n = !1, resizable: u = !1 } = e, [f, p] = i(n);
	return /* @__PURE__ */ l(s, { children: [u ? /* @__PURE__ */ c(o, {
		onClick: () => p(!f),
		children: "Resize panel"
	}) : null, /* @__PURE__ */ c(a, {
		width: f ? "280px" : "960px",
		maxWidth: "full",
		height: "520px",
		bg: "bg",
		overflow: "hidden",
		children: /* @__PURE__ */ c(r, {
			messages: d(t),
			emptyStateTitle: "No messages",
			emptyStateDescription: "Send a message",
			chatInputPlaceholder: "Type a message..."
		})
	})] });
}
var p = {
	title: "Patterns/Chat/Collapsed User Message",
	parameters: { layout: "padded" },
	tags: ["!manifest"]
}, m = {
	render: () => /* @__PURE__ */ c(f, {
		text: u,
		narrow: !0
	}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = await i.findByRole("button", { name: "Show more" });
		await n(a).toBeVisible();
		let o = a.closest(".ai-message__content");
		await n(o.getBoundingClientRect().height).toBe(128), await n(getComputedStyle(o).borderTopWidth).toBe("0px");
		let s = o.lastElementChild, c = getComputedStyle(s);
		await n(c.backgroundColor).toBe(getComputedStyle(o).backgroundColor), await n(c.paddingTop).toBe("0px");
		let l = o.querySelector("[data-sticky-user-message-content]"), u = l.querySelector("[data-part=\"content\"]").firstElementChild;
		await n(getComputedStyle(u).paddingBottom).toBe("0px"), await n(l.getBoundingClientRect().bottom).toBeLessThanOrEqual(s.getBoundingClientRect().top), await n(getComputedStyle(s, "::before").height).toBe("48px"), await n(getComputedStyle(s, "::before").backgroundImage).toContain("75%"), await n(getComputedStyle(s, "::before").backgroundImage).toContain(getComputedStyle(o).backgroundColor), await t.click(a);
		let d = await i.findByRole("button", { name: "Show less" });
		await n(d).toBeVisible(), await n(l.dataset.scope).toBe("scroll-area"), await n(l.dataset.part).toBe("viewport"), await n(l.getBoundingClientRect().bottom).toBeLessThanOrEqual(s.getBoundingClientRect().top), await t.click(d), await n(a).toBeVisible();
	}
}, h = {
	render: () => /* @__PURE__ */ c(f, { text: "# Release status\n# Remaining risks\n# Next actions" }),
	play: async ({ canvasElement: t }) => {
		await n(await e(t).findByRole("button", { name: "Show more" })).toBeVisible();
	}
}, g = {
	render: () => /* @__PURE__ */ c(f, {
		text: u,
		resizable: !0
	}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await n(i.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument(), await t.click(i.getByRole("button", { name: "Resize panel" }));
		let a = await i.findByRole("button", { name: "Show more" });
		await t.click(a), await n(i.getByRole("button", { name: "Show less" })).toBeVisible(), await t.click(i.getByRole("button", { name: "Resize panel" })), await n(i.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument(), await n(i.queryByRole("button", { name: "Show less" })).not.toBeInTheDocument();
	}
}, _ = {
	render: () => /* @__PURE__ */ c(f, {
		text: "Review the release checklist.",
		narrow: !0
	}),
	play: async ({ canvasElement: t }) => {
		await n(e(t).queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
	}
};
function v() {
	let [e, t] = i("Review the release checklist.");
	return /* @__PURE__ */ l(s, { children: [/* @__PURE__ */ c(o, {
		onClick: () => t(u),
		children: "Load full prompt"
	}), /* @__PURE__ */ c(f, {
		text: e,
		narrow: !0
	})] });
}
var y = {
	render: () => /* @__PURE__ */ c(v, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await n(i.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument(), await t.click(i.getByRole("button", { name: "Load full prompt" })), await n(await i.findByRole("button", { name: "Show more" })).toBeVisible();
	}
}, b = { render: () => /* @__PURE__ */ c(f, {
	text: u,
	narrow: !0
}) };
export { h as MarkdownHeadings, g as ResizeWrappedPrompt, _ as ShortPrompt, b as ThemePreview, y as UpdatedContent, m as WrappedPrompt, p as default };
