// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./circle-alert-DphG-Ztw.ts";
import { t } from "./circle-check-QpR5K4qp.ts";
import { t as n } from "./circle-dashed-B1ik78oL.ts";
import { t as r } from "./circle-dot-DzEudT09.ts";
import { t as i } from "./circle-pause-B1jshF2F.ts";
import { n as a, r as o, t as s } from "./loader-circle-CIuxuX7x.ts";
import { Icon as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
// packages/ui/src/components/primitives/session-indicator.tsx
var u = [
	"in_progress",
	"awaiting_input",
	"queued",
	"completed",
	"failed",
	"cancelled",
	"disconnected"
], d = (c) => c === "in_progress" ? s : c === "completed" ? t : c === "failed" ? e : c === "cancelled" ? o : c === "disconnected" ? i : c === "queued" ? a : c === "awaiting_input" ? r : n, f = (e) => e === "in_progress" ? "fg.info" : e === "completed" ? "fg.success" : e === "failed" ? "fg.error" : e === "cancelled" || e === "disconnected" ? "fg.warning" : e === "queued" ? "fg.info" : e === "awaiting_input" ? "fg.warning" : "fg.muted", p = (e) => {
	let { status: t, boxSize: n = "14px", ariaLabel: r = "Session status", cursor: i, onClick: a, color: o } = e;
	return /* @__PURE__ */ l(c, {
		as: d(t),
		boxSize: n,
		color: o ?? f(t),
		"aria-label": r,
		cursor: i,
		onClick: a
	});
};
export { u as i, f as n, d as r, p as t };
