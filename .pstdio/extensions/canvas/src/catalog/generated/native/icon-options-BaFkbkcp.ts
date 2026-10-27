// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { C as e, S as t, T as n, _ as r, a as i, b as a, c as ee, d as te, f as ne, g as re, h as o, i as s, l as c, m as l, n as u, o as d, p as f, r as p, s as m, t as h, u as g, v as _, w as v, x as y, y as b } from "./zap-Dajcy3HI.ts";
import { t as x } from "./archive-DozS7A-I.ts";
import { t as S } from "./bell-Cw2yL2ca.ts";
import { t as C } from "./book-open-OD77qyyJ.ts";
import { t as w } from "./bot-DyijWSfK.ts";
import { t as T } from "./circle-B0quX-xX.ts";
import { t as E } from "./cpu-DJuq_2-_.ts";
import { t as D } from "./eye-D2mhng7S.ts";
import { t as O } from "./file-text-B9-uT4dU.ts";
import { t as k } from "./folder-DJ8ZbA4G.ts";
import { t as A } from "./git-branch-BjWwGBn9.ts";
import { n as j, t as M } from "./user-round-BbCM7Opj.ts";
import { n as N, t as ie } from "./ticket-CH4ueYVY.ts";
import { t as P } from "./list-tree-wIq_OI-O.ts";
import { t as F } from "./message-square-C0JbtaT-.ts";
import { t as I } from "./pause-C8r-dHaS.ts";
import { t as L } from "./pencil-DsB6zW8x.ts";
import { t as R } from "./play-crlvkPMv.ts";
import { t as z } from "./puzzle-BKD3K9Fw.ts";
import { t as B } from "./scale-CMLSNEQT.ts";
import { t as V } from "./settings-DjkPFa7Q.ts";
import { t as H } from "./sparkles-GpXFEeOw.ts";
import { t as U } from "./square-kanban-DzsMXKKR.ts";
import { t as W } from "./star-DtQKFyMr.ts";
import { t as G } from "./tag-CIM9XYhf.ts";
import { t as K } from "./terminal-B2gAfUK-.ts";
import { t as q } from "./timer-B6AbcL3H.ts";
import { t as J } from "./trash-2-C03vrbuo.ts";
import { chakra as Y } from "@chakra-ui/react";
import { jsx as ae } from "react/jsx-runtime";
// packages/ui/src/components/primitives/glyph-icon.tsx
var oe = new Map(Array.from("@font-face {\n  font-family: \"prompt-studio-icons\";\n  src: url(\"$fonts/prompt-studio-icons.eot?959122fb\");\n  src:\n    url(\"$fonts/prompt-studio-icons.eot?959122fb#iefix\") format(\"embedded-opentype\"),\n    url(\"$fonts/prompt-studio-icons.woff2?959122fb\") format(\"woff2\"),\n    url(\"$fonts/prompt-studio-icons.woff?959122fb\") format(\"woff\"),\n    url(\"$fonts/prompt-studio-icons.ttf?959122fb\") format(\"truetype\"),\n    url(\"$fonts/prompt-studio-icons.svg?959122fb#prompt-studio-icons\") format(\"svg\");\n  font-weight: normal;\n  font-style: normal;\n  font-display: block;\n}\n\n[class^=\"icon-\"]::before,\n[class*=\" icon-\"]::before {\n  font-family: \"prompt-studio-icons\", sans-serif;\n  font-style: normal;\n  font-weight: normal;\n  speak: never;\n  display: inline-block;\n  text-decoration: inherit;\n  width: 1em;\n  margin-right: 0.2em;\n  text-align: center;\n  font-variant: normal;\n  text-transform: none;\n  line-height: 1em;\n  margin-left: 0.2em;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n\n.icon-cloud-add::before {\n  content: \"\\e800\";\n}\n.icon-credit-usage-50::before {\n  content: \"\\e801\";\n}\n.icon-history::before {\n  content: \"\\e802\";\n}\n.icon-data-string::before {\n  content: \"\\e803\";\n}\n.icon-data-object::before {\n  content: \"\\e804\";\n}\n.icon-data-integer::before {\n  content: \"\\e805\";\n}\n.icon-data-double::before {\n  content: \"\\e806\";\n}\n.icon-add::before {\n  content: \"\\e807\";\n}\n.icon-add-circle::before {\n  content: \"\\e808\";\n}\n.icon-data-boolean::before {\n  content: \"\\e809\";\n}\n.icon-add-square::before {\n  content: \"\\e80a\";\n}\n.icon-data-array::before {\n  content: \"\\e80b\";\n}\n.icon-status-backlog::before {\n  content: \"\\e80c\";\n}\n.icon-metrics::before {\n  content: \"\\e80d\";\n}\n.icon-pie-donut::before {\n  content: \"\\e80e\";\n}\n.icon-area-plot::before {\n  content: \"\\e80f\";\n}\n.icon-treemap::before {\n  content: \"\\e810\";\n}\n.icon-align-bottom::before {\n  content: \"\\e811\";\n}\n.icon-align-horizontally::before {\n  content: \"\\e812\";\n}\n.icon-align-left::before {\n  content: \"\\e813\";\n}\n.icon-align-right::before {\n  content: \"\\e814\";\n}\n.icon-align-vertically::before {\n  content: \"\\e815\";\n}\n.icon-radar-column-chart::before {\n  content: \"\\e816\";\n}\n.icon-pie-full::before {\n  content: \"\\e817\";\n}\n.icon-archive-1::before {\n  content: \"\\e818\";\n}\n.icon-archive-2::before {\n  content: \"\\e819\";\n}\n.icon-archive-add::before {\n  content: \"\\e81a\";\n}\n.icon-ct::before {\n  content: \"\\e81b\";\n}\n.icon-archive-minus::before {\n  content: \"\\e81c\";\n}\n.icon-archive-slash::before {\n  content: \"\\e81d\";\n}\n.icon-archive-tick::before {\n  content: \"\\e81e\";\n}\n.icon-min::before {\n  content: \"\\e81f\";\n}\n.icon-ctd::before {\n  content: \"\\e820\";\n}\n.icon-std::before {\n  content: \"\\e821\";\n}\n.icon-var::before {\n  content: \"\\e822\";\n}\n.icon-max::before {\n  content: \"\\e823\";\n}\n.icon-sum::before {\n  content: \"\\e824\";\n}\n.icon-status-todo::before {\n  content: \"\\e825\";\n}\n.icon-status-progress::before {\n  content: \"\\e826\";\n}\n.icon-status-review::before {\n  content: \"\\e827\";\n}\n.icon-status-done::before {\n  content: \"\\e828\";\n}\n.icon-status-canceled::before {\n  content: \"\\e829\";\n}\n.icon-level-low::before {\n  content: \"\\e82a\";\n}\n.icon-arrow-down::before {\n  content: \"\\e82b\";\n}\n.icon-arrow-down-1::before {\n  content: \"\\e82c\";\n}\n.icon-level-mid::before {\n  content: \"\\e82d\";\n}\n.icon-arrow-left::before {\n  content: \"\\e82e\";\n}\n.icon-level-high::before {\n  content: \"\\e82f\";\n}\n.icon-arrow-left-2::before {\n  content: \"\\e830\";\n}\n.icon-level-xhigh::before {\n  content: \"\\e831\";\n}\n.icon-arrow-right::before {\n  content: \"\\e832\";\n}\n.icon-arrow-right-1::before {\n  content: \"\\e833\";\n}\n.icon-arrow-right-3::before {\n  content: \"\\e835\";\n}\n.icon-arrow-right-4::before {\n  content: \"\\e836\";\n}\n.icon-arrow-square-down::before {\n  content: \"\\e838\";\n}\n.icon-arrow-square-left::before {\n  content: \"\\e839\";\n}\n.icon-arrow-square-up::before {\n  content: \"\\e83a\";\n}\n.icon-arrow-up-2::before {\n  content: \"\\e83f\";\n}\n.icon-arrow-up-3::before {\n  content: \"\\e840\";\n}\n.icon-book::before {\n  content: \"\\e868\";\n}\n.icon-book-1::before {\n  content: \"\\e869\";\n}\n.icon-box::before {\n  content: \"\\e86e\";\n}\n.icon-pointing-arrow::before {\n  content: \"\\e87d\";\n}\n.icon-data-structure::before {\n  content: \"\\e87e\";\n}\n.icon-brush-4::before {\n  content: \"\\e87f\";\n}\n.icon-folder::before {\n  content: \"\\e880\";\n}\n.icon-import-2::before {\n  content: \"\\e881\";\n}\n.icon-refresh::before {\n  content: \"\\e882\";\n}\n.icon-message-text-1::before {\n  content: \"\\e883\";\n}\n.icon-messages-2::before {\n  content: \"\\e884\";\n}\n.icon-global::before {\n  content: \"\\e885\";\n}\n.icon-briefcase::before {\n  content: \"\\e886\";\n}\n.icon-row-vertical::before {\n  content: \"\\e887\";\n}\n.icon-format-square::before {\n  content: \"\\e888\";\n}\n.icon-document-copy::before {\n  content: \"\\e889\";\n}\n.icon-document-forward::before {\n  content: \"\\e88a\";\n}\n.icon-tick-circle-1::before {\n  content: \"\\e88b\";\n}\n.icon-data-timestamp::before {\n  content: \"\\e88c\";\n}\n.icon-more-2::before {\n  content: \"\\e88d\";\n}\n.icon-notification::before {\n  content: \"\\e88e\";\n}\n.icon-search-normal-1::before {\n  content: \"\\e890\";\n}\n.icon-home-1::before {\n  content: \"\\e891\";\n}\n.icon-brush-1::before {\n  content: \"\\e892\";\n}\n.icon-paperclip-2::before {\n  content: \"\\e893\";\n}\n.icon-grid-4::before {\n  content: \"\\e894\";\n}\n.icon-mouse-circle::before {\n  content: \"\\e895\";\n}\n.icon-message-question::before {\n  content: \"\\e896\";\n}\n.icon-saving::before {\n  content: \"\\e898\";\n}\n.icon-chevron-double::before {\n  content: \"\\e899\";\n}\n.icon-close::before {\n  content: \"\\e89a\";\n}\n.icon-more-info::before {\n  content: \"\\e89b\";\n}\n.icon-arrow-up::before {\n  content: \"\\e89c\";\n}\n.icon-reorder::before {\n  content: \"\\e89d\";\n}\n.icon-refresh-1::before {\n  content: \"\\e89e\";\n}\n.icon-text-variable::before {\n  content: \"\\e89f\";\n}\n.icon-header-horizontal::before {\n  content: \"\\e8a0\";\n}\n.icon-edit-1::before {\n  content: \"\\e8a1\";\n}\n.icon-credit-usage-0::before {\n  content: \"\\e8a2\";\n}\n.icon-credit-usage-25::before {\n  content: \"\\e8a3\";\n}\n.icon-credit-usage-75::before {\n  content: \"\\e8a4\";\n}\n.icon-card::before {\n  content: \"\\e8a5\";\n}\n.icon-credit-usage-100::before {\n  content: \"\\e8a6\";\n}\n.icon-coding-language::before {\n  content: \"\\e8ab\";\n}\n.icon-table::before {\n  content: \"\\e8ad\";\n}\n.icon-check::before {\n  content: \"\\e8ae\";\n}\n.icon-logo-google::before {\n  content: \"\\e8af\";\n}\n.icon-data-date::before {\n  content: \"\\e8b0\";\n}\n.icon-llms::before {\n  content: \"\\e8b1\";\n}\n.icon-logo-openai::before {\n  content: \"\\e8b2\";\n}\n.icon-logo-anthropic::before {\n  content: \"\\e8b3\";\n}\n.icon-logo-meta::before {\n  content: \"\\e8b4\";\n}\n.icon-data-variant::before {\n  content: \"\\e8b5\";\n}\n.icon-chart-1::before {\n  content: \"\\e8b6\";\n}\n.icon-schema::before {\n  content: \"\\e8b7\";\n}\n.icon-ascending::before {\n  content: \"\\e8b8\";\n}\n.icon-bar-chart-100stacked::before {\n  content: \"\\e8ba\";\n}\n.icon-results::before {\n  content: \"\\e8bc\";\n}\n.icon-bar-chart::before {\n  content: \"\\e8be\";\n}\n.icon-descending::before {\n  content: \"\\e8bf\";\n}\n.icon-bar-chart-vertical::before {\n  content: \"\\e8c0\";\n}\n.icon-step-before-points::before {\n  content: \"\\e8c4\";\n}\n.icon-step-after-points::before {\n  content: \"\\e8c6\";\n}\n.icon-line-rounded::before {\n  content: \"\\e8c9\";\n}\n.icon-line-sharp::before {\n  content: \"\\e8cb\";\n}\n.icon-bar-chart-simple::before {\n  content: \"\\e8cc\";\n}\n.icon-pie-chart::before {\n  content: \"\\e8cd\";\n}\n.icon-bar-chart-stacked::before {\n  content: \"\\e8ce\";\n}\n.icon-map::before {\n  content: \"\\e8cf\";\n}\n.icon-radar-bar-chart::before {\n  content: \"\\e8d0\";\n}\n.icon-radar-chart::before {\n  content: \"\\e8d1\";\n}\n.icon-metric::before {\n  content: \"\\e8d2\";\n}\n.icon-area-plot-1::before {\n  content: \"\\e8d3\";\n}\n.icon-avg::before {\n  content: \"\\e8d4\";\n}\n.icon-area-plot-stacked100::before {\n  content: \"\\e8d5\";\n}\n.icon-scatter-bubbles::before {\n  content: \"\\e8d6\";\n}\n.icon-code::before {\n  content: \"\\e8d7\";\n}\n.icon-code-1::before {\n  content: \"\\e8d8\";\n}\n.icon-code-circle::before {\n  content: \"\\e8d9\";\n}\n.icon-scatter-plot::before {\n  content: \"\\e8db\";\n}\n.icon-scatter-dots::before {\n  content: \"\\e8dc\";\n}\n.icon-med::before {\n  content: \"\\e8dd\";\n}\n.icon-command-square::before {\n  content: \"\\e8e1\";\n}\n.icon-component::before {\n  content: \"\\e8e2\";\n}\n.icon-copy::before {\n  content: \"\\e8e9\";\n}\n.icon-danger::before {\n  content: \"\\e8f5\";\n}\n.icon-visualization::before {\n  content: \"\\e8fc\";\n}\n.icon-document-1::before {\n  content: \"\\e911\";\n}\n.icon-document-code::before {\n  content: \"\\e913\";\n}\n.icon-document-download::before {\n  content: \"\\e916\";\n}\n.icon-document-text-1::before {\n  content: \"\\e91f\";\n}\n.icon-document-upload::before {\n  content: \"\\e920\";\n}\n.icon-edit::before {\n  content: \"\\e927\";\n}\n.icon-edit-2::before {\n  content: \"\\e928\";\n}\n.icon-eraser-1::before {\n  content: \"\\e939\";\n}\n.icon-export-1::before {\n  content: \"\\e93b\";\n}\n.icon-export-3::before {\n  content: \"\\e93d\";\n}\n.icon-eye::before {\n  content: \"\\e93f\";\n}\n.icon-eye-slash::before {\n  content: \"\\e940\";\n}\n.icon-flash-1::before {\n  content: \"\\e950\";\n}\n.icon-folder-2::before {\n  content: \"\\e955\";\n}\n.icon-glass::before {\n  content: \"\\e97c\";\n}\n.icon-home-2::before {\n  content: \"\\e9aa\";\n}\n.icon-import-1::before {\n  content: \"\\e9b5\";\n}\n.icon-info-circle::before {\n  content: \"\\e9b7\";\n}\n.icon-key::before {\n  content: \"\\e9bc\";\n}\n.icon-data::before {\n  content: \"\\e9c7\";\n}\n.icon-link-2::before {\n  content: \"\\e9d1\";\n}\n.icon-location::before {\n  content: \"\\e9d5\";\n}\n.icon-location-slash::before {\n  content: \"\\e9d9\";\n}\n.icon-login-1::before {\n  content: \"\\e9e0\";\n}\n.icon-logout-1::before {\n  content: \"\\e9e2\";\n}\n.icon-magicpen::before {\n  content: \"\\e9e4\";\n}\n.icon-maximize-2::before {\n  content: \"\\e9f0\";\n}\n.icon-maximize-4::before {\n  content: \"\\e9f2\";\n}\n.icon-maximize-21::before {\n  content: \"\\e9f3\";\n}\n.icon-menu-1::before {\n  content: \"\\e9f8\";\n}\n.icon-message::before {\n  content: \"\\e9fa\";\n}\n.icon-messages::before {\n  content: \"\\ea06\";\n}\n.icon-microphone-2::before {\n  content: \"\\ea11\";\n}\n.icon-minus-cirlce::before {\n  content: \"\\ea18\";\n}\n.icon-moon::before {\n  content: \"\\ea2e\";\n}\n.icon-more::before {\n  content: \"\\ea2f\";\n}\n.icon-note::before {\n  content: \"\\ea44\";\n}\n.icon-paperclip::before {\n  content: \"\\ea56\";\n}\n.icon-play::before {\n  content: \"\\ea6a\";\n}\n.icon-presention-chart::before {\n  content: \"\\ea6f\";\n}\n.icon-redo::before {\n  content: \"\\ea9c\";\n}\n.icon-rotate-left::before {\n  content: \"\\eaa8\";\n}\n.icon-rotate-right::before {\n  content: \"\\eaaa\";\n}\n.icon-search-zoom-in-1::before {\n  content: \"\\eac8\";\n}\n.icon-search-zoom-out::before {\n  content: \"\\eac9\";\n}\n.icon-send-1::before {\n  content: \"\\ead1\";\n}\n.icon-setting-2::before {\n  content: \"\\ead6\";\n}\n.icon-setting-4::before {\n  content: \"\\ead8\";\n}\n.icon-setting-5::before {\n  content: \"\\ead9\";\n}\n.icon-shuffle::before {\n  content: \"\\eae9\";\n}\n.icon-sidebar-bottom::before {\n  content: \"\\eaea\";\n}\n.icon-sidebar-left::before {\n  content: \"\\eaeb\";\n}\n.icon-sidebar-right::before {\n  content: \"\\eaec\";\n}\n.icon-sidebar-top::before {\n  content: \"\\eaed\";\n}\n.icon-slash::before {\n  content: \"\\eaf3\";\n}\n.icon-smallcaps::before {\n  content: \"\\eaf9\";\n}\n.icon-sms::before {\n  content: \"\\eafd\";\n}\n.icon-star::before {\n  content: \"\\eb07\";\n}\n.icon-stop::before {\n  content: \"\\eb0e\";\n}\n.icon-sun-1::before {\n  content: \"\\eb15\";\n}\n.icon-tag-cross::before {\n  content: \"\\eb19\";\n}\n.icon-task::before {\n  content: \"\\eb1c\";\n}\n.icon-task-square::before {\n  content: \"\\eb1d\";\n}\n.icon-teacher::before {\n  content: \"\\eb1e\";\n}\n.icon-text::before {\n  content: \"\\eb1f\";\n}\n.icon-textalign-center::before {\n  content: \"\\eb20\";\n}\n.icon-textalign-justifycenter::before {\n  content: \"\\eb21\";\n}\n.icon-textalign-left::before {\n  content: \"\\eb24\";\n}\n.icon-textalign-right::before {\n  content: \"\\eb25\";\n}\n.icon-text-block::before {\n  content: \"\\eb26\";\n}\n.icon-text-bold::before {\n  content: \"\\eb27\";\n}\n.icon-text-italic::before {\n  content: \"\\eb28\";\n}\n.icon-text-underline::before {\n  content: \"\\eb29\";\n}\n.icon-tick-circle::before {\n  content: \"\\eb2a\";\n}\n.icon-timer-1::before {\n  content: \"\\eb32\";\n}\n.icon-trash::before {\n  content: \"\\eb3c\";\n}\n.icon-undo::before {\n  content: \"\\eb47\";\n}\n.icon-user::before {\n  content: \"\\eb4a\";\n}\n.icon-video-vertical::before {\n  content: \"\\eb61\";\n}\n.icon-wallet-2::before {\n  content: \"\\eb6d\";\n}\n.icon-wifi::before {\n  content: \"\\eb7b\";\n}\n.icon-stockholm::before {\n  content: \"\\eb81\";\n}\n.icon-perplexity-ai::before {\n  content: \"\\eb82\";\n}\n".matchAll(/\.icon-([\w-]+)::before\s*\{\s*content:\s*"(\\[0-9a-f]+)"/g), ([, e, t]) => [e, t])), se = 89.5, ce = "0.209em", le = Y("span"), ue = (e, t) => ({
	position: "relative",
	display: "inline-block",
	verticalAlign: "middle",
	flexShrink: 0,
	boxSize: "1em",
	lineHeight: 1,
	containerType: "size",
	"&::before": {
		content: e,
		fontSize: t,
		position: "absolute",
		inset: 0,
		fontFamily: "\"prompt-studio-icons\", sans-serif",
		fontStyle: "normal",
		fontWeight: "normal",
		lineHeight: "100cqmin",
		textAlign: "center",
		transform: `translateY(${ce})`
	}
}), X = (e, t = {}) => {
	let n = ue(`"${oe.get(e) ?? ""}"`, `${(se * (t.scale ?? 1)).toFixed(1)}cqmin`), r = (e) => /* @__PURE__ */ ae(le, {
		"aria-hidden": !0,
		...e,
		css: n
	});
	return r.displayName = `GlyphIcon(${e})`, r;
}, de = [
	"gray",
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"blue",
	"cyan",
	"purple",
	"pink"
], Z = (e, t) => ({
	value: e,
	label: t,
	icon: X(e)
}), Q = (e, t) => ({
	value: e,
	label: t,
	icon: X(e, { scale: .82 })
}), $ = [
	{
		value: null,
		label: "none",
		icon: v
	},
	{
		value: "flag",
		label: "flag",
		icon: _
	},
	{
		value: "bug",
		label: "bug",
		icon: t
	},
	{
		value: "sparkles",
		label: "sparkles",
		icon: H
	},
	{
		value: "book-open",
		label: "book open",
		icon: C
	},
	{
		value: "wrench",
		label: "wrench",
		icon: u
	},
	{
		value: "zap",
		label: "zap",
		icon: h
	},
	{
		value: "feather",
		label: "feather",
		icon: b
	},
	{
		value: "scale",
		label: "scale",
		icon: B
	},
	{
		value: "layers",
		label: "layers",
		icon: te
	},
	{
		value: "star",
		label: "star",
		icon: W
	},
	{
		value: "flame",
		label: "flame",
		icon: r
	},
	{
		value: "lightbulb",
		label: "lightbulb",
		icon: g
	},
	{
		value: "shield",
		label: "shield",
		icon: m
	},
	{
		value: "eye",
		label: "eye",
		icon: D
	},
	{
		value: "clock",
		label: "clock",
		icon: q
	},
	{
		value: "tag",
		label: "tag",
		icon: G
	},
	{
		value: "code",
		label: "code",
		icon: y
	},
	{
		value: "rocket",
		label: "rocket",
		icon: ee
	},
	{
		value: "heart",
		label: "heart",
		icon: o
	},
	{
		value: "bookmark",
		label: "bookmark",
		icon: e
	},
	{
		value: "target",
		label: "target",
		icon: d
	},
	{
		value: "bell",
		label: "bell",
		icon: S
	},
	{
		value: "hash",
		label: "hash",
		icon: j
	},
	Z("status-backlog", "status backlog"),
	Z("status-todo", "status todo"),
	Z("status-progress", "status in progress"),
	Z("status-review", "status in review"),
	Z("status-done", "status done"),
	Z("status-canceled", "status canceled"),
	{
		value: "ticket",
		label: "ticket",
		icon: ie
	},
	{
		value: "git-branch",
		label: "git branch",
		icon: A
	},
	Q("level-low", "level low"),
	Q("level-mid", "level medium"),
	Q("level-high", "level high"),
	Q("level-xhigh", "level very high"),
	{
		value: "bot",
		label: "bot",
		icon: w
	},
	{
		value: "puzzle",
		label: "puzzle",
		icon: z
	},
	{
		value: "workflow",
		label: "workflow",
		icon: p
	},
	{
		value: "kanban",
		label: "kanban",
		icon: ne
	},
	{
		value: "message-square",
		label: "message square",
		icon: F
	},
	{
		value: "folder",
		label: "folder",
		icon: k
	},
	{
		value: "file-text",
		label: "file text",
		icon: O
	},
	{
		value: "history",
		label: "history",
		icon: l
	},
	{
		value: "play",
		label: "play",
		icon: R
	},
	{
		value: "terminal",
		label: "terminal",
		icon: K
	},
	{
		value: "cpu",
		label: "CPU",
		icon: E
	},
	{
		value: "users",
		label: "users",
		icon: s
	},
	{
		value: "component",
		label: "ticket",
		icon: a
	},
	{
		value: "square-kanban",
		label: "board",
		icon: U
	},
	{
		value: "git-commit-horizontal",
		label: "workspace",
		icon: re
	},
	{
		value: "inbox",
		label: "notifications",
		icon: f
	},
	{
		value: "list-checks",
		label: "checklist",
		icon: c
	},
	{
		value: "archive",
		label: "archive",
		icon: x
	},
	{
		value: "link",
		label: "link",
		icon: N
	},
	{
		value: "settings",
		label: "settings",
		icon: V
	}
], fe = {
	pause: I,
	pencil: L,
	trash: J,
	"trash-2": J,
	"list-tree": P,
	"archive-restore": n,
	"user-round": M,
	"user-check": i
}, pe = (e, t = $) => {
	let n = (e ?? "circle").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([a-zA-Z])([0-9])/g, "$1-$2").toLowerCase();
	return t.find((e) => e.value === n)?.icon ?? fe[n] ?? T;
};
export { de as n, $ as r, pe as t };
