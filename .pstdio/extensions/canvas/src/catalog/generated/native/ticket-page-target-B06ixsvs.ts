// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// extensions/pstdio-planner/src/data/document-selection.ts
var e = (e) => ({
	kind: "page",
	id: e,
	extensionId: "pstdio.pstdio-planner"
}), t = {
	id: "ticket-requests",
	ref: e("ticket-requests")
}, n = "review-requests", r = {
	kind: "page",
	page: e("tickets")
}, i = (t) => {
	let n = t.metadata?.resourceParent, a = n && typeof n == "object" && "metadata" in n ? n.metadata : void 0, o = n && typeof n == "object" && "type" in n && n.type === "ticket" && "id" in n && typeof n.id == "string" ? {
		type: n.type,
		id: n.id,
		...typeof n.shorthand == "string" ? { shorthand: n.shorthand } : {},
		...typeof n.label == "string" ? { label: n.label } : {},
		...typeof n.extensionId == "string" ? { extensionId: n.extensionId } : {},
		...typeof n.projectId == "string" ? { projectId: n.projectId } : {},
		...a && typeof a == "object" && !Array.isArray(a) ? { metadata: a } : {}
	} : void 0;
	return {
		kind: "page",
		page: e("ticket"),
		resource: t,
		parent: o ? i(o) : r
	};
}, a = (e) => ({
	kind: "page",
	page: t.ref,
	resource: {
		...e,
		metadata: {
			...e.metadata,
			documentId: n
		}
	},
	parent: i(e)
});
export { a as n, i as t };
