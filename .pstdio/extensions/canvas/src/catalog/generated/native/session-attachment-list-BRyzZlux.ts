// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./paperclip-CoBJq1oI.ts";
import { t } from "./x-DqEAa6-d.ts";
import { r as n } from "./api-file-url-CTxskOjG.ts";
import { useRef as r, useState as i } from "react";
import { Box as a, Dialog as o, IconButton as s, Image as c, Stack as l } from "@chakra-ui/react";
import { ResourceBadge as u, Tooltip as d } from "@pstdio/ui";
import { Fragment as f, jsx as p, jsxs as m } from "react/jsx-runtime";
var h = Object.keys({
	c: "text/plain",
	cc: "text/plain",
	cpp: "text/plain",
	cs: "text/plain",
	css: "text/css",
	csv: "text/csv",
	cxx: "text/plain",
	go: "text/plain",
	h: "text/plain",
	hpp: "text/plain",
	html: "text/html",
	java: "text/plain",
	js: "application/javascript",
	jsx: "text/plain",
	json: "application/json",
	jsonc: "application/json",
	kt: "text/plain",
	kts: "text/plain",
	lua: "text/plain",
	markdown: "text/markdown",
	md: "text/markdown",
	mjs: "application/javascript",
	pdf: "application/pdf",
	php: "text/plain",
	png: "image/png",
	py: "text/plain",
	rb: "text/plain",
	rs: "text/plain",
	sh: "text/plain",
	sql: "text/plain",
	svg: "image/svg+xml",
	swift: "text/plain",
	toml: "text/plain",
	ts: "text/plain",
	tsx: "text/plain",
	txt: "text/plain",
	vue: "text/plain",
	xml: "text/xml",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	yaml: "text/plain",
	yml: "text/plain"
}).map((e) => `.${e}`).join(","), g = (t) => {
	let { projectId: n, uploading: i, onAttachFiles: o } = t, c = r(null);
	return /* @__PURE__ */ m(f, { children: [/* @__PURE__ */ p(a, {
		display: "none",
		children: /* @__PURE__ */ p("input", {
			ref: c,
			type: "file",
			multiple: !0,
			accept: h,
			onChange: (e) => {
				let t = Array.from(e.currentTarget.files ?? []);
				e.currentTarget.value = "", o(t);
			}
		})
	}), /* @__PURE__ */ p(d, {
		content: "Attach files",
		children: /* @__PURE__ */ p(s, {
			"aria-label": "Attach files",
			size: "xs",
			variant: "ghost",
			disabled: !n || i,
			onClick: () => c.current?.click(),
			children: /* @__PURE__ */ p(e, { size: 14 })
		})
	})] });
}, _ = (e) => {
	let { src: t, ...r } = e;
	return /* @__PURE__ */ p(c, {
		...r,
		src: n(t)
	});
}, v = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i, y = (e) => e.mime_type?.startsWith("image/") || v.test(e.name), b = (e) => {
	let { attachments: n, onRemove: r } = e, [a, c] = i(null);
	return n.length === 0 ? null : /* @__PURE__ */ m(f, { children: [/* @__PURE__ */ p(l, {
		direction: "row",
		gap: "1",
		flexWrap: "wrap",
		alignItems: "center",
		children: n.map((e) => {
			let t = y(e);
			return /* @__PURE__ */ p(u, {
				fileName: e.name,
				size: "md",
				tone: "neutral",
				icon: t ? /* @__PURE__ */ p(_, {
					src: e.url,
					alt: `${e.name} preview thumbnail`,
					boxSize: "18px",
					borderRadius: "xs",
					objectFit: "cover"
				}) : void 0,
				onSelect: t ? () => c(e) : void 0,
				onRemove: () => r(e.file_id)
			}, e.file_id);
		})
	}), /* @__PURE__ */ m(o.Root, {
		open: !!a,
		onOpenChange: (e) => {
			e.open || c(null);
		},
		children: [/* @__PURE__ */ p(o.Backdrop, {}), /* @__PURE__ */ p(o.Positioner, { children: /* @__PURE__ */ m(o.Content, {
			maxW: "min(48rem, calc(100vw - 2rem))",
			children: [/* @__PURE__ */ m(o.Header, { children: [/* @__PURE__ */ p(o.Title, { children: a?.name }), /* @__PURE__ */ p(o.CloseTrigger, {
				asChild: !0,
				children: /* @__PURE__ */ p(s, {
					"aria-label": "Close preview",
					size: "sm",
					variant: "ghost",
					children: /* @__PURE__ */ p(t, { size: 16 })
				})
			})] }), /* @__PURE__ */ p(o.Body, {
				p: "md",
				children: a && /* @__PURE__ */ p(_, {
					src: a.url,
					alt: `${a.name} preview`,
					maxH: "70vh",
					maxW: "100%",
					mx: "auto",
					objectFit: "contain"
				})
			})]
		}) })]
	})] });
};
export { g as n, b as t };
