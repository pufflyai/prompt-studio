// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import "@pstdio/sdk/extensions";
// packages/pstdio-api-contracts/src/extension-kernel/l10n.ts
var e = (e) => typeof e == "object" && !!e && "$l10n" in e && typeof e.$l10n == "string", t = (t, n = "") => t === void 0 ? n : e(t) ? t.default ?? t.$l10n : t, n = async (e, n, r, i, a) => {
	let o = n.resourceMutation;
	if (!o) return a();
	let s = r?.[o.idParam] ?? i?.resource?.id;
	if (typeof s != "string") return a();
	let c = {
		type: o.resourceType,
		id: s,
		extensionId: n.extensionId,
		projectId: e.projectId
	};
	if (o.kind === "remove" && !await e.workbench.commandPalette.requestConfirmation(t(n.title, "Delete"))) return;
	let l = o.kind === "rename" ? r?.[o.labelParam] : void 0;
	if (o.kind === "rename" && (typeof l != "string" || !l.trim())) return a();
	let u = e.workbench.resources.preview.begin(c, o.kind === "remove" ? { removed: !0 } : { label: l.trim() });
	try {
		let t = await e.workbench.resources.preview.persist(c, a);
		return await u.commit(), t;
	} catch (e) {
		throw u.rollback(), e;
	}
};
export { t as n, n as t };
