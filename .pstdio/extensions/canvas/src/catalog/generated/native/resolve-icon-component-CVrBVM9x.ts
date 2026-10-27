// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./createLucideIcon-C77ufEku.ts";
import { t } from "./lucide-react-CiGXWUCb.ts";
import { r as n } from "./icon-options-BaFkbkcp.ts";
// packages/ui/src/utils/messages-circle-icon.ts
var r = e("MessagesCircle", [["path", {
	d: "M15.5 9a6.5 6.5 0 0 1-6.5 6.5 6.4 6.4 0 0 1-3-.7L2 16l1.2-4A6.4 6.4 0 0 1 2.5 9a6.5 6.5 0 0 1 13 0Z",
	key: "front"
}], ["path", {
	d: "M17 8.8a6.5 6.5 0 0 1 3.8 9.2L22 22l-4-1.2a6.5 6.5 0 0 1-9.2-3.8",
	key: "back"
}]]), i = (e) => e.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((e) => `${e.charAt(0).toUpperCase()}${e.slice(1)}`).join(""), a = (e) => {
	let a = n.find((t) => t.value === e);
	if (a) return a.icon;
	let o = i(e);
	if (o === "MessagesCircle") return r;
	for (let n of [
		e,
		o,
		`${o}Icon`
	]) {
		let e = t[n];
		if (e && (typeof e == "function" || typeof e == "object")) return e;
	}
};
export { a as t };
