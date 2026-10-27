// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./use-landing-styles-CQWLl3TI.ts";
import { t } from "./docs-tree-GMnaff3L.ts";
import { n, t as r } from "./doc-column-G6d3T2RC.ts";
import { t as i } from "./blog-categories-CjPY9ARM.ts";
import { Fragment as a, useEffect as o, useState as s } from "react";
import { Badge as c, Box as l, Image as u, chakra as d } from "@chakra-ui/react";
import { ActivityAvatar as f, AlertMessage as p } from "@pstdio/ui";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
// clients/landing-page/src/components/blog/post-banner.tsx
var g = (t) => {
	let { image: n, loading: r = "eager" } = t, i = e();
	return /* @__PURE__ */ m(l, {
		as: "span",
		css: i.postArtwork,
		children: ["light", "dark"].map((e) => /* @__PURE__ */ m(u, {
			"data-art-tone": e,
			src: n[e].src,
			htmlWidth: n[e].width,
			htmlHeight: n[e].height,
			alt: "",
			loading: r,
			decoding: "async",
			css: i.postBanner
		}, e))
	});
}, _ = new Intl.DateTimeFormat("en-US", {
	dateStyle: "long",
	timeZone: "UTC"
}), v = (e) => {
	let { published: t } = e;
	return /* @__PURE__ */ m("time", {
		dateTime: t,
		children: _.format(new Date(t))
	});
}, y = (t) => {
	let { page: n } = t, r = e();
	return /* @__PURE__ */ h(l, {
		css: r.postMeta,
		children: [
			/* @__PURE__ */ h(l, {
				css: r.postAuthor,
				children: [/* @__PURE__ */ m(f, { actor: n.author }), /* @__PURE__ */ m("span", { children: n.author.name })]
			}),
			/* @__PURE__ */ h(l, {
				css: r.postDetails,
				children: [
					/* @__PURE__ */ m(v, { published: n.published }),
					/* @__PURE__ */ m("span", {
						"aria-hidden": "true",
						children: "·"
					}),
					/* @__PURE__ */ h("span", { children: [n.readingMinutes, " min read"] })
				]
			}),
			/* @__PURE__ */ m(c, {
				variant: "chip",
				size: "sm",
				children: i(n.category)
			})
		]
	});
}, b = (t) => {
	let { page: n, featured: r } = t, i = e();
	return /* @__PURE__ */ h(d.a, {
		href: n.path,
		"data-featured": r || void 0,
		css: i.postListItem,
		children: [r && /* @__PURE__ */ m(g, { image: n.image }), /* @__PURE__ */ h(l, {
			css: i.postSummary,
			children: [
				/* @__PURE__ */ m("h2", { children: n.label }),
				/* @__PURE__ */ m(y, { page: n }),
				/* @__PURE__ */ m("p", { children: n.description })
			]
		})]
	});
}, x = (e) => {
	let { page: t, pages: n } = e, i = n.filter((e) => e.view === "post").sort((e, t) => t.published.localeCompare(e.published));
	return /* @__PURE__ */ h(r, {
		pageKey: t.path,
		children: [
			/* @__PURE__ */ m("h1", { children: "Blog" }),
			/* @__PURE__ */ m("p", { children: t.description }),
			i.map((e, t) => /* @__PURE__ */ m(b, {
				page: e,
				featured: t === 0
			}, e.path))
		]
	});
}, S = (t) => {
	let { headings: n } = t, r = e(), i = n.filter((e) => e.depth === 2), [a, c] = s(i[0]?.slug), u = i.map((e) => e.slug).join(" ");
	return o(() => {
		let e = () => {
			let e = u.split(" ").flatMap((e) => document.getElementById(e) ?? []), t = window.innerHeight / 3, n = e.filter((e) => e.getBoundingClientRect().top <= t);
			c((n.at(-1) ?? e[0])?.id);
		};
		return e(), document.addEventListener("scroll", e, !0), window.addEventListener("resize", e), () => {
			document.removeEventListener("scroll", e, !0), window.removeEventListener("resize", e);
		};
	}, [u]), i.length < 2 ? null : /* @__PURE__ */ h(l, {
		as: "nav",
		"aria-label": "On this page",
		css: r.outline,
		children: [/* @__PURE__ */ m(l, {
			css: r.outlineTitle,
			children: "On this page"
		}), i.map((e) => /* @__PURE__ */ m(d.a, {
			href: `#${e.slug}`,
			css: r.outlineLink,
			"aria-current": e.slug === a ? "location" : void 0,
			children: e.text
		}, e.slug))]
	});
}, C = (e) => {
	let { page: t, document: i } = e;
	return /* @__PURE__ */ h(r, {
		pageKey: t.path,
		aside: /* @__PURE__ */ m(S, { headings: i.headings }, t.path),
		children: [
			/* @__PURE__ */ m(g, { image: t.image }),
			/* @__PURE__ */ h("header", { children: [/* @__PURE__ */ m("h1", { children: t.label }), /* @__PURE__ */ m(y, { page: t })] }),
			t.category === "release" && /* @__PURE__ */ m(p, {
				role: "note",
				"aria-label": "Alpha release notice",
				status: "info",
				variant: "subtle",
				title: "Prompt Studio is still in alpha",
				children: "The APIs and core feature set are not fully defined yet. They can change day by day, introducing breaking changes until we reach beta."
			}),
			/* @__PURE__ */ m(n, { html: i.html })
		]
	});
}, w = (n) => {
	let { page: i, pages: o } = n, s = e(), c = t(o), u = c.map(({ section: e }) => ({
		depth: 2,
		slug: e.toLowerCase(),
		text: e
	}));
	return /* @__PURE__ */ h(r, {
		pageKey: i.path,
		aside: /* @__PURE__ */ m(S, { headings: u }),
		children: [
			/* @__PURE__ */ m("h1", { children: "Docs" }),
			/* @__PURE__ */ m("p", { children: i.description }),
			c.map(({ section: e, topics: t }) => /* @__PURE__ */ h(a, { children: [/* @__PURE__ */ m("h2", {
				id: e.toLowerCase(),
				children: e
			}), /* @__PURE__ */ m(l, {
				css: s.homeTopics,
				children: t.map(({ topic: e, pages: t }) => /* @__PURE__ */ h("div", { children: [/* @__PURE__ */ m("h3", { children: e.label }), /* @__PURE__ */ m("ul", { children: t.map((e) => /* @__PURE__ */ m("li", { children: /* @__PURE__ */ m("a", {
					href: e.path,
					children: e.label
				}) }, e.path)) })] }, e.path))
			})] }, e))
		]
	});
}, T = (e) => {
	let { page: t, document: i } = e;
	return /* @__PURE__ */ m(r, {
		pageKey: t.path,
		aside: /* @__PURE__ */ m(S, { headings: i.headings }, t.path),
		children: /* @__PURE__ */ m(n, { html: i.html })
	});
};
export { x as i, w as n, C as r, T as t };
