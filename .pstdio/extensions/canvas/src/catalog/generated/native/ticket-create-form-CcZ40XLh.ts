// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { l10n as e } from "@pstdio/sdk/extensions";
// extensions/pstdio-planner/src/ticket-create-form.ts
var t = {
	title: e("kanbanRenderers.tickets.createRow.title", "New ticket"),
	submitLabel: e("kanbanRenderers.tickets.createRow.submitLabel", "Create ticket"),
	params: {
		content: {
			type: "markdown",
			label: e("kanbanRenderers.tickets.createRow.content.label", "Description"),
			placeholder: e("kanbanRenderers.tickets.createRow.content.placeholder", "Describe the ticket..."),
			required: !0
		},
		files: {
			type: "files",
			label: e("kanbanRenderers.tickets.createRow.attachments.label", "Attach files"),
			multiple: !0
		}
	},
	labels: {
		cancel: e("kanbanRenderers.tickets.createRow.cancel", "Cancel"),
		properties: e("kanbanRenderers.tickets.createRow.properties", "Properties"),
		submitError: e("kanbanRenderers.tickets.createRow.submitError", "Could not create ticket"),
		removeFile: e("kanbanRenderers.tickets.createRow.removeFile", "Remove file")
	}
}, n = (e, t) => typeof e == "string" ? e : t(e.$l10n, e.default), r = (e) => ({
	title: n(t.title, e),
	submitLabel: n(t.submitLabel, e),
	fields: Object.entries(t.params).map(([t, r]) => ({
		type: r.type,
		..."required" in r ? { required: r.required } : {},
		..."multiple" in r ? { multiple: r.multiple } : {},
		id: t,
		label: n(r.label, e),
		..."placeholder" in r ? { placeholder: n(r.placeholder, e) } : {}
	})),
	labels: {
		cancel: n(t.labels.cancel, e),
		properties: n(t.labels.properties, e),
		submitError: n(t.labels.submitError, e),
		removeFile: n(t.labels.removeFile, e)
	}
});
export { n, r as t };
