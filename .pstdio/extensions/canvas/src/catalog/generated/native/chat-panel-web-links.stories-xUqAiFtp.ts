// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./rich-message-Cb2R7n2r.ts";
import { useState as a } from "react";
import { Button as o, Text as s } from "@chakra-ui/react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-web-links.stories.tsx
var d = "Read [GitHub](https://github.com/pufflyai/prompt-studio), https://docs.example.com/guide, <https://angle.example.com/a> and www.example.org.\nOpen {{link('https://refs.example.com/page')}}, https://missing.example.com and https://broken.example.com.\n[Email](mailto:team@example.com) stays a plain link. [![Build](https://img.example.com/badge.png)](https://ci.example.com) keeps its image.\n\n| Link |\n| --- |\n| [Table docs](https://table.example.com/docs) |", f = (e) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="hsl(${e} 70% 45%)"/></svg>`)}`, p = {
	title: "Chat/ChatPanel/Web links",
	component: i,
	parameters: { layout: "padded" },
	args: {
		defaultState: d,
		linkHandler: {
			resolveHref: () => null,
			resolveIcon: async (e) => {
				let { hostname: t } = new URL(e);
				return t === "missing.example.com" ? null : t === "broken.example.com" ? "data:image/png;base64,AAAA" : f(t.length * 37);
			},
			open: () => {}
		}
	}
}, m = (e) => t(() => {
	let t = e.querySelector("img");
	return r(t?.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/), t;
}), h = { play: async ({ canvasElement: n }) => {
	let i = e(n);
	for (let [e, t] of Object.entries({
		GitHub: "https://github.com/pufflyai/prompt-studio",
		"https://docs.example.com/guide": "https://docs.example.com/guide",
		"https://angle.example.com/a": "https://angle.example.com/a",
		"www.example.org": "http://www.example.org",
		page: "https://refs.example.com/page",
		"Table docs": "https://table.example.com/docs"
	})) {
		let n = await i.findByRole("link", {
			name: e,
			exact: !0
		});
		await r(n).toHaveAttribute("href", t), await r(n).toHaveAttribute("target", "_blank"), await r(n).toHaveAttribute("rel", "noopener noreferrer"), await r(await m(n)).toHaveAttribute("alt", ""), await r(n.querySelector("[data-scope=\"tooltip\"]")).toBeNull();
	}
	for (let e of ["https://missing.example.com", "https://broken.example.com"]) {
		let n = await i.findByRole("link", {
			name: e,
			exact: !0
		});
		await t(() => r(n.querySelector("svg.lucide-globe")).not.toBeNull()), await r(n.querySelector("img")).toBeNull();
	}
	let a = i.getByRole("link", {
		name: "Build",
		exact: !0
	});
	await r(a).toHaveAttribute("href", "https://ci.example.com"), await r(a.querySelector("img[alt=\"Build\"]")).not.toBeNull();
	let o = i.getByRole("link", {
		name: "Email",
		exact: !0
	});
	await r(o).toHaveAttribute("href", "mailto:team@example.com"), await r(o.querySelector("img, svg")).toBeNull();
	let s = n.querySelector("[data-rich-message=\"true\"] [contenteditable]"), c = "";
	window.addEventListener("copy", (e) => c = e.clipboardData?.getData("text/html") ?? "", { once: !0 }), window.getSelection().selectAllChildren(s), document.execCommand("copy"), window.getSelection().removeAllRanges(), await r(c).toMatch(/<a href="https:\/\/github\.com\/pufflyai\/prompt-studio"[^>]*>GitHub<\/a>/);
} }, g = {
	args: { linkHandler: {
		resolveHref: () => null,
		open: () => {}
	} },
	play: async ({ canvasElement: t }) => {
		let n = e(t), i = await n.findByRole("link", {
			name: "GitHub",
			exact: !0
		});
		await r(i).toHaveAttribute("href", "https://github.com/pufflyai/prompt-studio"), await r(i.querySelector("img, svg")).toBeNull();
		let a = n.getByRole("link", {
			name: "https://docs.example.com/guide",
			exact: !0
		});
		await r(a.querySelector("img, svg")).toBeNull();
	}
}, _ = () => {
	let [e, t] = a("Read https://docs.exa"), [n, r] = a(!0), [d, p] = a([]);
	return /* @__PURE__ */ u(c, { children: [
		/* @__PURE__ */ l(i, {
			defaultState: e,
			streaming: n,
			linkHandler: {
				resolveHref: () => null,
				resolveIcon: async (e) => (p((t) => [...t, e]), f(200)),
				open: () => {}
			}
		}),
		/* @__PURE__ */ l(o, {
			onClick: () => t("Read https://docs.example.com/guide and more."),
			children: "Next chunk"
		}),
		/* @__PURE__ */ l(o, {
			onClick: () => r(!1),
			children: "Finish"
		}),
		/* @__PURE__ */ l(s, {
			"data-testid": "asked-icons",
			children: d.join(" ")
		})
	] });
}, v = {
	render: () => /* @__PURE__ */ l(_, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = await i.findByRole("link", {
			name: "https://docs.exa",
			exact: !0
		});
		await r(a.querySelector("svg.lucide-globe")).not.toBeNull(), await n.click(i.getByRole("button", { name: "Next chunk" }));
		let o = await i.findByRole("link", {
			name: "https://docs.example.com/guide",
			exact: !0
		});
		await r(o.querySelector("svg.lucide-globe")).not.toBeNull(), await r(i.getByTestId("asked-icons")).toHaveTextContent(/^$/), await n.click(i.getByRole("button", { name: "Finish" })), await m(i.getByRole("link", {
			name: "https://docs.example.com/guide",
			exact: !0
		})), await r(i.getByTestId("asked-icons")).toHaveTextContent(/^https:\/\/docs\.example\.com\/guide$/);
	}
};
export { g as HostWithoutIcons, h as SiteIcons, v as StreamingLinks, p as default };
