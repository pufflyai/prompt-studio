// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, d as t, g as n, l as r, m as i, n as a, p as o, v as s, y as c } from "./schemas-D84h_Ad-.ts";
// packages/pstdio-api-contracts/src/extensions/common.ts
var l = i(n(), c()), u = i(n(), r()).meta({
	type: "object",
	additionalProperties: !0
}), d = o({
	$l10n: n(),
	default: n().optional()
}), f = s([n(), d]);
a(["global", "project"]), a([
	"boolean",
	"number",
	"string",
	"array",
	"object"
]), a(["stored", "default"]);
var p = a([
	"info",
	"warning",
	"error"
]);
o({
	code: n(),
	severity: p,
	message: n(),
	extensionId: n().optional(),
	commandId: n().optional(),
	sourcePath: n().optional(),
	metadata: l.optional()
}), o({
	id: n(),
	name: n(),
	displayName: n(),
	extensionInstanceId: n().optional(),
	installedExtensionId: n().optional(),
	installName: n().optional(),
	version: n().optional(),
	description: n().optional(),
	sourcePath: n()
});
var m = o({
	kind: t("package-asset"),
	path: n(),
	baseUrl: n()
});
a([
	"first",
	"default",
	"last"
]);
var h = a([
	"menu",
	"panel",
	"settings",
	"renderer",
	"kanbanRenderer",
	"dataTableRenderer"
]), g = a([
	"cli",
	"dashboard",
	"api",
	"schedule",
	"event",
	"automation",
	"command-panel"
]);
o({
	mode: s([n(), e(n())]).optional(),
	source: e(g).optional(),
	viewId: s([n(), e(n())]).optional(),
	resourceType: e(n()).optional(),
	metadata: l.optional()
}), o({
	entry: m,
	title: f.optional(),
	capabilities: e(n()).optional()
}).extend({
	runtimeUrl: n(),
	moduleUrl: n(),
	styles: e(n()).optional()
});
// packages/pstdio-api-contracts/src/extensions/resource-ref.ts
var _ = o({
	device: o({
		ownerId: n(),
		id: n(),
		name: n()
	}).optional(),
	shorthand: n().optional(),
	type: n(),
	id: n(),
	projectId: n().optional(),
	label: n().optional(),
	icon: n().optional(),
	extensionId: n().optional(),
	metadata: u.optional()
});
export { u as a, l as i, g as n, h as r, _ as t };
