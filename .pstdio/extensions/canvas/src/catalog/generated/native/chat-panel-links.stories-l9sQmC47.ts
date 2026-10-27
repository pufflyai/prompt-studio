// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./chat-panel-CAnDU0Lx.ts";
import { c as i } from "./chat-link-anchor-kdoOkLgc.ts";
import { t as a } from "./alert-D8nHP1tF.ts";
import { t as o } from "./rich-message-BDq8UfVC.ts";
import { useState as s } from "react";
import { Box as c, Text as l } from "@chakra-ui/react";
import { Fragment as u, jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-links.stories.tsx
var p = (e) => e.source === "missing.ts" || i(e)?.kind === "external" ? null : `/projects/demo/workspace?document=${encodeURIComponent(e.source)}`, m = async (e) => {
	let t = p(e);
	return t ? { href: t } : null;
}, h = (e) => {
	let { streaming: t = !1 } = e, [n, i] = s(null);
	return /* @__PURE__ */ d(r, {
		streaming: t,
		messages: [{
			id: "user",
			role: "user",
			parts: [{
				type: "text",
				text: "Review [README](README.md), `src/app.ts:12`, and {{link('$PROJECT/src/app.ts')}}."
			}]
		}, {
			id: "assistant",
			role: "assistant",
			parts: [
				{
					type: "text",
					text: "[Source](src/app.ts:12:4)\n\n| File | Review |\n| --- | --- |\n| [Draft](.pstdio/tickets/PS-105/ticket.md) | `src/app.ts` |\n\n[Missing file](missing.ts) and [Website](https://example.com).\n\n`src/deeply/nested/features/conversations/document-navigation/long-file-name.ts`\n\n```ts\nconst path = 'src/app.ts';\n```"
				},
				{
					type: "reasoning",
					text: "Inspect `src/app.ts` before changing it."
				},
				{
					type: "tool",
					tool: "read",
					status: "completed",
					state: {
						input: { file_path: "src/app.ts" },
						output: "[Tool source](src/app.ts:2)"
					}
				}
			]
		}],
		linkHandler: {
			resolveHref: p,
			resolveResource: async (e) => {
				let t = p(e);
				return t ? { href: t } : null;
			},
			describe: (e) => `Workspace demo: ${e.source}`,
			open: (e) => i(e.source)
		},
		conversationNotices: n ? /* @__PURE__ */ d(a, {
			status: n === "missing.ts" ? "error" : "info",
			title: n === "missing.ts" ? "Workspace file not found" : "Opened link",
			onClose: () => i(null),
			children: n
		}) : void 0,
		emptyStateTitle: "Conversation",
		emptyStateDescription: "Inspect workspace links",
		chatInputPlaceholder: "Reply…"
	});
}, g = () => {
	let e = "[Source](src/app.ts \"Original title\") after README.md.", [t, n] = s(e);
	return /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(o, {
		defaultState: e,
		isEditable: !0,
		onChange: n,
		linkHandler: {
			resolveHref: () => "/projects/demo/workspace?document=src%2Fapp.ts",
			describe: () => "Workspace demo: src/app.ts",
			open: () => {}
		}
	}), /* @__PURE__ */ d(l, {
		"data-testid": "exported-markdown",
		children: t
	})] });
}, _ = {
	title: "Chat/ChatPanel/Links",
	component: h,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ d(c, {
		h: "100vh",
		children: /* @__PURE__ */ d(e, {})
	})]
}, v = { play: async ({ canvasElement: r }) => {
	let i = e(r), a = await i.findByRole("link", { name: "Source" });
	await n(a.querySelector("svg.lucide-file-code")).not.toBeNull(), a.focus(), await n(a).toHaveFocus(), await t.keyboard("{Enter}"), await n(await i.findByText("Opened link")).toBeVisible(), await t.click(i.getByRole("button", { name: "Missing file" })), await n(await i.findByText("Workspace file not found")).toBeVisible();
} }, y = { args: { streaming: !0 } }, b = {
	render: () => /* @__PURE__ */ d(o, {
		defaultState: "Open {{link('https://example.com')}}.",
		linkHandler: {
			resolveHref: () => null,
			resolveResource: async () => null,
			open: () => {}
		}
	}),
	play: async ({ canvasElement: t }) => {
		let r = await e(t).findByRole("link", { name: "example.com" });
		await n(r).toHaveAttribute("href", "https://example.com"), await n(r).toHaveAttribute("target", "_blank"), await n(r).toHaveAttribute("rel", "noopener noreferrer"), await n(r.querySelector("[data-scope=\"tooltip\"]")).toBeNull(), r.focus(), await n(r).toHaveFocus();
	}
}, x = {
	render: () => {
		let [e, t] = s();
		return /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(o, {
			defaultState: "Review tickets/T-1/ticket.md, [ticket](tickets/T-1/ticket.md), `tickets/T-1/ticket.md`, and {{link('tickets/T-1/ticket.md')}}. Read tickets/T-1/files/notes.md. [Website](https://example.com) stays a web link.",
			linkHandler: {
				resolveHref: () => null,
				resolveResource: async (e) => ({
					label: e.source.endsWith("notes.md") ? "notes.md" : "T-1 Fix resource links",
					icon: e.source.endsWith("notes.md") ? "file-text" : "component",
					href: "/projects/demo/ticket/T-1"
				}),
				open: (e) => t(e.source)
			}
		}), e ? /* @__PURE__ */ d(l, { children: e }) : null] });
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = await i.findAllByRole("link", { name: "T-1 Fix resource links" });
		await n(a).toHaveLength(4);
		for (let e of a) await n(e.querySelector("svg.lucide-component")).not.toBeNull(), await n(e.querySelector("[data-scope=\"tooltip\"]")).toBeNull(), await n(e.closest("[data-scope=\"tooltip\"]")).toBeNull();
		let o = await i.findByRole("link", { name: "notes.md" });
		await n(o.querySelector("svg.lucide-file-text")).not.toBeNull(), await t.hover(a[0]), await n(getComputedStyle(a[0]).textDecorationLine).toBe("none"), a[0].focus(), await t.keyboard("{Enter}"), await n(i.getByText("tickets/T-1/ticket.md")).toBeVisible(), await n(i.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://example.com");
	}
}, S = /* @__PURE__ */ new Set(["src/app.ts", "README.md"]), C = {
	render: () => /* @__PURE__ */ d(o, {
		defaultState: "Local `main` matches `origin/main`. See github.com, **Node.js**, the U.S. market and Node 18.x. Read `src/app.ts`, README.md and src/missing.ts, or {{link('src/app.ts')}}.\n\n| Ref | File |\n| --- | --- |\n| `origin/main` | `src/app.ts` |",
		linkHandler: {
			resolveHref: p,
			resolveResource: async (e) => S.has(e.source) ? { href: p(e) } : null,
			open: () => {}
		}
	}),
	play: async ({ canvasElement: t }) => {
		let r = e(t);
		await n(await r.findAllByRole("link", {
			name: "src/app.ts",
			exact: !0
		})).toHaveLength(2), await n(await r.findByRole("link", {
			name: "README.md",
			exact: !0
		})).toBeVisible(), await n(await r.findByRole("link", {
			name: "app.ts",
			exact: !0
		})).toBeVisible();
		let i = t.querySelector("table");
		await n(await e(i).findByRole("link", {
			name: "src/app.ts",
			exact: !0
		})).toBeVisible(), await n(e(i).queryByRole("link", {
			name: "origin/main",
			exact: !0
		})).toBeNull();
		for (let e of [
			"main",
			"origin/main",
			"github.com",
			"Node.js",
			"U.S",
			"18.x",
			"src/missing.ts"
		]) await n(r.queryByRole("link", {
			name: e,
			exact: !0
		})).toBeNull();
		await n(r.getAllByText("origin/main")[0].closest("code")).not.toBeNull(), await n(r.getByText("Node.js").closest("strong")).not.toBeNull();
		let a = t.querySelector("[data-rich-message=\"true\"] [contenteditable]"), o = window.getSelection();
		o.selectAllChildren(a);
		let s = "";
		window.addEventListener("copy", (e) => {
			s = e.clipboardData?.getData("text/html") ?? "";
		}, { once: !0 }), document.execCommand("copy"), o.removeAllRanges();
		for (let e of [
			"origin/main",
			"<code>src/app.ts</code>",
			"README.md",
			"<strong>Node.js</strong>"
		]) await n(s).toContain(e);
		await n(s).toContain("{{link('src/app.ts')}}");
	}
}, w = { render: () => /* @__PURE__ */ d(o, {
	defaultState: "[Source](src/app.ts:2) and `src/app.ts`.",
	linkHandler: {
		resolveHref: p,
		resolveResource: m,
		open: () => {}
	}
}) }, T = {
	render: () => {
		let [e, t] = s();
		return /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(o, {
			defaultState: "Read src/app/(dashboard)/page.ts and (src/app/[id]/page.ts).",
			linkHandler: {
				resolveHref: p,
				resolveResource: m,
				open: (e) => t(e.source)
			}
		}), /* @__PURE__ */ d(l, {
			"data-testid": "opened-path",
			children: e
		})] });
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = "src/app/(dashboard)/page.ts", o = await i.findByRole("link", {
			name: a,
			exact: !0
		});
		await n(o).toHaveAttribute("href", "/projects/demo/workspace?document=src%2Fapp%2F(dashboard)%2Fpage.ts"), await t.click(o), await n(i.getByTestId("opened-path")).toHaveTextContent(a), await n(i.getByRole("link", {
			name: "src/app/[id]/page.ts",
			exact: !0
		})).toBeVisible(), await n(i.queryByRole("link", {
			name: "/page.ts",
			exact: !0
		})).toBeNull();
	}
}, E = {
	render: () => /* @__PURE__ */ d(g, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = await i.findByRole("textbox");
		await t.click(a), await t.type(a, " updated", { skipClick: !0 }), await n(i.getByTestId("exported-markdown")).toHaveTextContent("\"Original title\""), await n(i.getByTestId("exported-markdown")).toHaveTextContent("updated"), await n(i.getByTestId("exported-markdown")).toHaveTextContent("README.md"), await n(i.getByTestId("exported-markdown")).not.toHaveTextContent("Workspace demo");
	}
};
export { E as EditableSource, b as ExternalReferences, v as FileLinks, C as GuessedPaths, T as ParenthesizedPaths, x as ResourceBubbles, w as StandaloneRichMessage, y as StreamingLinks, _ as default };
