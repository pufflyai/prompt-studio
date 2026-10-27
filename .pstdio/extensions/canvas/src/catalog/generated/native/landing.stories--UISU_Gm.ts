// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./building-2-B0wTT9lj.ts";
import { t } from "./scale-CMLSNEQT.ts";
import { t as n } from "./shield-check-8abL6TC4.ts";
import { n as r } from "./use-landing-styles-CQWLl3TI.ts";
import { n as i, t as a } from "./assembly-frame-CwnHoQw-.ts";
import { i as o } from "./landing-content-Dr_aPkzK.ts";
import { i as s, n as c, o as l, r as u, s as d, t as f } from "./landing-route-DJns_G_o.ts";
import { a as p, c as m, o as h, r as g, u as _ } from "./landing-modules-CRGdVMXC.ts";
import { t as v } from "./page-scroll-CScB-LpO.ts";
import { t as y } from "./desktop-releases-TalCnyn2.ts";
import { t as b } from "./blog-categories-CjPY9ARM.ts";
import { t as x } from "./shape-field-DjTCIETU.ts";
import { n as ee, r as S, t as C } from "./resource-sidebar-BvXPTa61.ts";
import { Suspense as w, startTransition as T, useEffect as E, useRef as D, useState as O } from "react";
import { Box as k, Button as A, Flex as j, HStack as M, Text as N } from "@chakra-ui/react";
import { ResizableSplitLayout as P } from "@pstdio/ui";
import { jsx as F, jsxs as I } from "react/jsx-runtime";
// clients/landing-page/src/hooks/use-landing-document.ts
var L = (e) => `/documents${e.slice(0, -1)}.json`, R = (e, t) => {
	let [n, r] = O(() => new Map(t ? [[e.path, t]] : [])), [i, a] = O(e), o = !c(e) || n.has(e.path);
	return o && i !== e && a(e), E(() => {
		if (o) return;
		let t = new AbortController();
		return fetch(L(e.path), { signal: t.signal }).then((e) => {
			if (!e.ok) throw Error(`${e.status} ${e.statusText}`);
			return e.json();
		}).then((t) => r((n) => new Map(n).set(e.path, t))).catch(() => {
			t.signal.aborted || window.location.reload();
		}), () => t.abort();
	}, [e.path, o]), {
		shownPage: i,
		document: n.get(i.path),
		loading: !o
	};
}, z = `${o.siteUrl}/#website`, B = `${o.siteUrl}/#organization`, V = `${o.siteUrl}/#application`, H = {
	"@type": "Organization",
	"@id": B,
	name: "Pufflig AB",
	url: `${o.siteUrl}/`,
	logo: new URL(o.appleTouchIconPath, o.siteUrl).href
}, U = {
	"@type": "WebSite",
	"@id": z,
	url: `${o.siteUrl}/`,
	name: "Prompt Studio",
	description: o.description,
	publisher: { "@id": B }
}, W = {
	"@type": "SoftwareApplication",
	"@id": V,
	name: "Prompt Studio",
	description: o.description,
	applicationCategory: "DeveloperApplication",
	operatingSystem: "macOS, Windows, Linux",
	url: `${o.siteUrl}/`,
	downloadUrl: y,
	codeRepository: o.repositoryUrl,
	license: `${o.repositoryUrl}/blob/main/LICENSE`,
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD"
	},
	publisher: { "@id": B }
}, G = (e) => e.view === "post" ? "BlogPosting" : e.view === "blog" ? "Blog" : "WebPage", K = (e, t) => {
	let n = e.path === "/", r = {
		"@type": G(e),
		"@id": t,
		url: t,
		name: e.title,
		description: e.description,
		isPartOf: { "@id": z },
		...n ? { about: { "@id": V } } : {},
		...e.view === "post" ? {
			headline: e.label,
			datePublished: e.published,
			articleSection: b(e.category),
			author: {
				"@type": "Person",
				name: e.author.name,
				...e.author.avatarSrc ? { image: new URL(e.author.avatarSrc, o.siteUrl).href } : {}
			},
			timeRequired: `PT${e.readingMinutes}M`,
			publisher: { "@id": B },
			image: new URL(e.image.light.src, o.siteUrl).href
		} : {}
	};
	return {
		"@context": "https://schema.org",
		"@graph": n ? [
			H,
			U,
			r,
			W
		] : [
			H,
			U,
			r
		]
	};
}, q = (e, t) => {
	let n = e?.title ?? "Page not found | Prompt Studio", r = e?.description ?? "The requested Prompt Studio page could not be found.", i = new URL(e?.path ?? t, o.siteUrl).href, a = e ? K(e, i) : void 0, s = e?.view === "post" ? {
		path: e.image.light.src,
		width: e.image.light.width,
		height: e.image.light.height,
		alt: "Watercolor Prompt Studio tool shapes."
	} : o.banner;
	return {
		title: n,
		description: r,
		canonicalUrl: i,
		structuredData: a,
		banner: {
			...s,
			url: new URL(s.path, o.siteUrl).href
		},
		indexable: !!e
	};
}, J = (e) => {
	let t = q(e, e.path);
	document.title = t.title;
	for (let [n, r] of [
		["meta[name=\"description\"]", t.description],
		["meta[property=\"og:title\"]", t.title],
		["meta[property=\"og:description\"]", t.description],
		["meta[property=\"og:url\"]", t.canonicalUrl],
		["meta[name=\"twitter:title\"]", t.title],
		["meta[name=\"twitter:description\"]", t.description],
		["meta[name=\"twitter:url\"]", t.canonicalUrl],
		["meta[property=\"og:type\"]", e.view === "post" ? "article" : "website"],
		["meta[property=\"og:image\"]", t.banner.url],
		["meta[property=\"og:image:width\"]", String(t.banner.width)],
		["meta[property=\"og:image:height\"]", String(t.banner.height)],
		["meta[property=\"og:image:alt\"]", t.banner.alt],
		["meta[name=\"twitter:image\"]", t.banner.url],
		["meta[name=\"twitter:image:alt\"]", t.banner.alt]
	]) document.querySelector(n)?.setAttribute("content", r);
	document.querySelector("link[rel=\"canonical\"]")?.setAttribute("href", t.canonicalUrl);
	let n = document.querySelector("script[type=\"application/ld+json\"]");
	n && (n.textContent = JSON.stringify(t.structuredData));
}, te = (e) => !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey, Y = (e, t) => {
	let [n, r] = O(e), i = u(t, n), [a, o] = O(() => ({
		...f,
		[l(i)]: e
	})), [s, c] = O(!1);
	E(() => {
		s && S();
	}, [s]);
	let d = (e) => {
		let n = u(t, e);
		n && T(() => {
			r(e), o((t) => ({
				...t,
				[l(n)]: e
			}));
		});
	}, p = (e, t = !1) => {
		let n = new URL(e, window.location.href), r = `${n.pathname}${n.hash}`;
		r !== `${window.location.pathname}${window.location.hash}` && window.history[t ? "replaceState" : "pushState"]({}, "", r), d(n.pathname);
	};
	return E(() => {
		let e = (e) => {
			(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p" && (e.preventDefault(), c((e) => !e));
		}, n = (e) => {
			let n = e.target instanceof Element ? e.target.closest("a[href]") : null;
			if (!(n instanceof HTMLAnchorElement) || !te(e) || n.target || n.download) return;
			let r = new URL(n.href);
			r.origin === window.location.origin && u(t, r.pathname) && (r.pathname === window.location.pathname && r.hash || (e.preventDefault(), p(n.href)));
		}, r = () => d(window.location.pathname);
		return window.addEventListener("keydown", e), document.addEventListener("click", n), window.addEventListener("popstate", r), () => {
			window.removeEventListener("keydown", e), document.removeEventListener("click", n), window.removeEventListener("popstate", r);
		};
	}, []), E(() => J(i), [i]), {
		page: i,
		navigate: p,
		sectionPath: (e) => e === l(i) ? f[e] : a[e],
		paletteOpen: s,
		setPaletteOpen: c
	};
}, X = 96, Z = () => {
	let [e, t] = O(!1), [n, r] = O({
		x: 0,
		y: 0
	}), i = D(null);
	return E(() => {
		if (!e) return;
		let t = (e) => {
			let t = i.current;
			if (!t || t.id !== e.pointerId) return;
			let n = Math.max(0, window.innerWidth / 2), a = Math.max(0, window.innerHeight / 2 - X);
			r({
				x: Math.max(-n, Math.min(n, t.originX + e.clientX - t.startX)),
				y: Math.max(-96, Math.min(a, t.originY + e.clientY - t.startY))
			});
		}, n = () => {
			i.current = null;
		};
		return window.addEventListener("pointermove", t), window.addEventListener("pointerup", n), window.addEventListener("pointercancel", n), () => {
			window.removeEventListener("pointermove", t), window.removeEventListener("pointerup", n), window.removeEventListener("pointercancel", n);
		};
	}, [e]), {
		windowed: e,
		offset: n,
		toggleWindowed: () => {
			t((e) => (e && r({
				x: 0,
				y: 0
			}), !e));
		},
		onTitleBarPointerDown: (t) => {
			e && t.button === 0 && (t.currentTarget.setPointerCapture(t.pointerId), i.current = {
				id: t.pointerId,
				startX: t.clientX,
				startY: t.clientY,
				originX: n.x,
				originY: n.y
			});
		}
	};
}, Q = () => {
	let e = r();
	return /* @__PURE__ */ F(k, {
		css: e.hero,
		as: "section",
		"aria-labelledby": "download-panel-title",
		children: /* @__PURE__ */ F(v, { children: /* @__PURE__ */ I(k, {
			css: e.heroLayout,
			"data-assembly-area": "",
			children: [
				/* @__PURE__ */ F(i, { headingLevel: "h1" }),
				/* @__PURE__ */ F(k, {
					css: e.cardSpace,
					"aria-hidden": "true",
					children: /* @__PURE__ */ F(a, {})
				}),
				/* @__PURE__ */ F(x, {})
			]
		}) })
	});
}, ne = () => /* @__PURE__ */ I("svg", {
	width: "100%",
	height: "100%",
	viewBox: "0 0 48 48",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	children: [/* @__PURE__ */ F("title", { children: "Stockholm" }), /* @__PURE__ */ F("path", {
		d: "M3.54 18.54h7.92V39h1.08v-5.46h28.92V39h1.08v-9.96h1.92V39h1.08V28.5c0-.06-.02-.12-.03-.17l.01-.01-1.48-4.41V19.5h-1.08v4.41l-1.47 4.42c-.02.05-.03.11-.03.17v3.2l-1.92-1.92V27h-1.08v2.46H12.54V15h-1.08v2.4A2.47 2.47 0 0 1 9.54 15v-3.96h.96V9.96H8.8l.58-.58a.54.54 0 0 0 0-.76L8.04 7.28V4.72l1.34-1.34-.76-.76-.58.58V1.5H6.96v1.7l-.58-.58-.76.76 1.34 1.34v2.56L5.62 8.62a.54.54 0 0 0 0 .76l.58.58H4.5v1.08h.96V15c0 1.17-.82 2.15-1.92 2.4V15H2.46v24h1.08V18.54Zm39.21 9.42.75-2.25.75 2.25h-1.5ZM7.5 8.26 8.24 9l-.74.74L6.76 9l.74-.74ZM6.48 15.54h2.03c.12.74.45 1.4.95 1.92H5.54c.5-.52.83-1.18.94-1.92Zm32.3 15 1.92 1.92H12.54v-1.92h26.24ZM8.46 11.04v3.42H6.54v-3.42h1.92ZM5.46 28.5h1.08V39H5.46V28.5Zm3 0h1.08V39H8.46V28.5Zm-1.92-6H5.46V21h1.08v1.5Zm3 0H8.46V21h1.08v1.5ZM15.96 39v-3h1.08v3h-1.08Zm3 0v-3h1.08v3h-1.08Zm3 0v-3h1.08v3h-1.08Zm3 0v-3h1.08v3h-1.08Zm3 0v-3h1.08v3h-1.08Zm3 0v-3h1.08v3h-1.08Zm3 0v-3h1.08v3h-1.08Zm3 0v-3h1.08v3h-1.08ZM46.84 44.58c.23.2.27.54.08.77-1.68 2.02-4.59 2.2-6.42.44a4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0A4.33 4.33 0 0 1 1.5 47.04a.54.54 0 1 1 0-1.08c.97 0 1.88-.46 2.58-1.3a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.68 3.77 1.67 5.17 0 .19-.23.53-.27.76-.08Zm0-3c.23.2.27.54.08.77-1.68 2.02-4.59 2.2-6.42.44a4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0 4.34 4.34 0 0 1-6 0A4.33 4.33 0 0 1 1.5 44.04a.54.54 0 1 1 0-1.08c.97 0 1.88-.46 2.58-1.3a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.67 3.77 1.67 5.16 0a.54.54 0 0 1 .84 0c1.39 1.68 3.77 1.67 5.17 0 .19-.23.53-.27.76-.08Z",
		fill: "currentColor"
	})]
}), re = [
	{
		label: "Privacy",
		path: "/privacy/",
		icon: n
	},
	{
		label: "Terms",
		path: "/terms/",
		icon: t
	},
	{
		label: "Imprint",
		path: "/imprint/",
		icon: e
	}
], $ = () => {
	let e = r();
	return /* @__PURE__ */ I(M, {
		as: "footer",
		"aria-label": "Workbench status",
		css: e.status,
		children: [re.map((e) => /* @__PURE__ */ F(A, {
			asChild: !0,
			size: "xs",
			variant: "ghost",
			color: "fg.muted",
			children: /* @__PURE__ */ I("a", {
				href: e.path,
				children: [/* @__PURE__ */ F(e.icon, {}), e.label]
			})
		}, e.path)), /* @__PURE__ */ I(M, {
			gap: "xs",
			color: "fg",
			ms: "auto",
			flexShrink: "0",
			children: [/* @__PURE__ */ F(k, {
				boxSize: "icon-md",
				flexShrink: "0",
				children: /* @__PURE__ */ F(ne, {})
			}), /* @__PURE__ */ F(N, {
				css: e.copyright,
				children: "© Pufflig AB. Stockholm, 2026"
			})]
		})]
	});
}, ie = (e) => [
	"start",
	"what-is-prompt-studio",
	"examples",
	"features"
].includes(e.view), ae = (e) => {
	let { page: t, onNavigate: n } = e;
	if (t.view === "start") return /* @__PURE__ */ F(Q, {});
	let r = /* @__PURE__ */ F(h.Component, {});
	return t.view === "examples" && (r = /* @__PURE__ */ F(p.Component, {
		exampleId: t.exampleId,
		onNavigate: (e, t) => n(s(e), t)
	})), t.view === "what-is-prompt-studio" && (r = /* @__PURE__ */ F(_.Component, {})), /* @__PURE__ */ F(k, {
		layerStyle: "panel",
		bg: "bg",
		width: "full",
		minWidth: "0",
		height: "full",
		overflow: "hidden",
		children: r
	});
}, oe = {
	title: "Theme/Landing Pages",
	component: (e) => {
		let { initialPath: t, pages: n, initialDocument: i } = e, { page: a, navigate: o, sectionPath: s, paletteOpen: c, setPaletteOpen: u } = Y(t, n), { shownPage: d, document: f, loading: p } = R(a, i), { windowed: h, offset: _, toggleWindowed: v, onTitleBarPointerDown: y } = Z(), b = r(h), x = /* @__PURE__ */ F(j, {
			direction: "column",
			flex: "1",
			minWidth: "0",
			children: /* @__PURE__ */ F(k, {
				as: "main",
				css: b.main,
				"aria-busy": p || void 0,
				children: /* @__PURE__ */ F(w, {
					fallback: null,
					children: ie(d) ? /* @__PURE__ */ F(ae, {
						page: d,
						onNavigate: o
					}) : /* @__PURE__ */ F(m.Component, {
						page: d,
						pages: n,
						document: f
					})
				})
			})
		});
		return /* @__PURE__ */ I(k, {
			css: b.root,
			children: [/* @__PURE__ */ I(j, {
				css: b.window,
				style: { transform: h ? `translate(${_.x}px, ${_.y}px)` : void 0 },
				children: [
					/* @__PURE__ */ F(ee, {
						windowed: h,
						selected: l(a),
						sectionPath: s,
						onToggleWindowed: v,
						onTitleBarPointerDown: y,
						onTitleBarDoubleClick: v,
						actionMenuOpen: c,
						onOpenActionMenu: () => u(!0)
					}),
					/* @__PURE__ */ F(j, {
						css: b.body,
						children: /* @__PURE__ */ F(P, {
							layout: {
								base: "content",
								lg: "split"
							},
							width: "full",
							height: "full",
							defaultSizePx: 220,
							minSizePx: 180,
							maxSizePx: 320,
							contentMinSizePx: 600,
							collapsible: !1,
							resizeLabel: "Resize navigation",
							resizablePanel: /* @__PURE__ */ F(C, {
								page: a,
								pages: n,
								onNavigate: o
							}),
							contentPanel: x
						})
					}),
					/* @__PURE__ */ F($, {})
				]
			}), c && /* @__PURE__ */ F(w, {
				fallback: null,
				children: /* @__PURE__ */ F(g.Component, {
					open: !0,
					pages: n,
					onClose: () => u(!1),
					onNavigate: o
				})
			})]
		});
	},
	parameters: { layout: "fullscreen" },
	args: {
		initialPath: "/",
		pages: d,
		initialDocument: void 0
	}
}, se = { parameters: { docs: { description: { story: "The download copy and editor stay vertically centered in the main area on wide desktops." } } } }, ce = { parameters: { docs: { description: { story: "Home fits a 1080p desktop with browser chrome, including collapsed window mode. The download column keeps its width; vertical spacing and the editor height are compact." } } } }, le = {
	decorators: [(e) => /* @__PURE__ */ F(k, {
		width: "1199px",
		maxWidth: "full",
		children: /* @__PURE__ */ F(e, {})
	})],
	parameters: { docs: { description: { story: "The download panel and editor stack when their main area is below 1200 pixels." } } }
}, ue = { decorators: [(e) => /* @__PURE__ */ F(k, {
	width: "sm",
	maxWidth: "full",
	children: /* @__PURE__ */ F(e, {})
})] }, de = { args: { initialPath: "/what-is-prompt-studio/" } }, fe = { args: { initialPath: "/examples/coding-agent-dashboard/" } }, pe = { args: { initialPath: "/features/" } };
export { ce as CompactDesktop, se as Desktop, fe as Examples, pe as Features, ue as Mobile, le as SingleColumn, de as WhatIsPromptStudio, oe as default };
