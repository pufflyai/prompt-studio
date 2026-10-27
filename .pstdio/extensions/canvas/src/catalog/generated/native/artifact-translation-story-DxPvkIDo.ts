// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createContext as e, useContext as t } from "react";
import { jsx as n } from "react/jsx-runtime";
import { qualifyRef as r } from "@pstdio/sdk/extensions";
// extensions/pstdio-artifacts/src/translations.tsx
var i = e(null), a = () => {
	let e = t(i);
	if (!e) throw Error("Artifact translations are not available.");
	return e;
}, o = "pstdio.pstdio-artifacts", s = r(o, {
	kind: "page",
	id: "artifacts"
});
r(o, {
	kind: "placement",
	id: "library"
}), r(o, {
	kind: "placement",
	id: "artifact"
}), r(o, {
	kind: "page-slot",
	page: s,
	id: "library"
});
var c = {
	id: "artifact",
	ref: r(o, {
		kind: "page",
		id: "artifact"
	}),
	path: "artifacts/view"
};
r(o, {
	kind: "page-slot",
	page: s,
	id: "artifact"
});
// extensions/pstdio-artifacts/src/contracts.ts
var l = (e, t, n) => ({
	type: "artifact",
	id: t,
	extensionId: o,
	projectId: e,
	...n ? { label: n } : {}
}), u = {
	id: "revision-1",
	artifactId: "artifact-1",
	revisionId: "revision-1",
	title: "Release overview",
	favicon: "📦",
	label: "First draft",
	publishedAt: "2026-09-08T10:00:00Z",
	size: 1200,
	hash: "example",
	url: "/example",
	resource: {
		type: "artifact",
		id: "artifact-1",
		projectId: "project-1",
		extensionId: "pstdio.pstdio-artifacts"
	},
	target: ((e, t, n) => ({
		kind: "page",
		page: c.ref,
		resource: l(e, t, n),
		open: "pin"
	}))("project-1", "artifact-1", "Release overview")
}, d = {
	"mounts.sites": "HTML publié",
	"navigation.artifacts": "Artefacts",
	"skills.publish": "Publier un artefact",
	"resources.artifact": "Artefact",
	"search.artifacts": "Artefacts",
	"views.artifacts": "Artefacts",
	"views.openArtifact": "Ouvrir un artefact",
	"pages.artifacts": "Artefacts",
	"pages.artifact": "Artefact",
	"commands.publish": "Publier un artefact",
	"commands.list": "Lister les artefacts",
	"commands.read": "Lire un artefact",
	"commands.revisions": "Lister les versions de l’artefact",
	"commands.open": "Ouvrir un artefact",
	"commands.rename": "Renommer un artefact",
	"commands.delete": "Supprimer un artefact",
	"params.filePath": "Chemin du fichier HTML",
	"params.url": "URL de l’artefact existant",
	"params.favicon": "Émoji",
	"params.label": "Libellé de la version",
	"params.search": "Rechercher",
	"library.editedNow": "Modifié à l’instant",
	"library.editedYesterday": "Modifié hier",
	"library.editedAt": "Modifié {{date}}",
	"library.emptyTitle": "Votre premier artefact commence par une idée",
	"library.emptyHint": "Demandez à un agent de créer et de publier une page HTML interactive.",
	"library.thumbnail": "Aperçu miniature : {{title}}",
	"reader.versions": "Versions",
	"reader.version": "Version {{number}}",
	"reader.latest": " · Dernière version",
	"reader.rename": "Renommer l’artefact…",
	"reader.delete": "Supprimer l’artefact…",
	"reader.preview": "Aperçu : {{title}}",
	"rename.name": "Nom de l’artefact",
	"commands.startCreation": "Créer un artefact",
	"params.example": "Exemple",
	"library.makeNew": "Créer quelque chose",
	"library.creationHint": "Choisissez un exemple pour démarrer une session avec un agent, ou demandez à une session de créer et publier une page interactive. Elle apparaîtra ici.",
	"library.briefTitle": "Présentation du projet",
	"library.briefDescription": "Objectifs, décisions et prochaines étapes",
	"library.diagramTitle": "Diagramme du système",
	"library.diagramDescription": "Composants, connexions et flux de données"
}, f = (e) => {
	let { children: t, locale: r = "en" } = e, a = r === "fr" ? d : {};
	return /* @__PURE__ */ n(i, {
		value: {
			locale: r,
			t: (e, t = e, n = {}) => Object.entries(n).reduce((e, [t, n]) => e.replaceAll(`{{${t}}}`, String(n)), a[e] ?? t)
		},
		children: t
	});
};
export { u as n, a as r, f as t };
