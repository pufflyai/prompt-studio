import { boomboxTracks } from "./apps/boombox-data";
import { kilnObjects } from "./apps/kiln-data";
import { pigeonThreads } from "./apps/pigeon-data";
import { scribbleDocuments } from "./apps/scribble-data";
import { type IssueStatus, ziplineIssues } from "./apps/zipline-data";

export const documentMarkdown = (document: (typeof scribbleDocuments)[number]) =>
  [
    document.intro,
    "",
    ...document.sections.flatMap((section) => [`## ${section.title}`, "", section.body, ""]),
    "## Next steps",
    "",
    ...document.tasks.map((task, index) => `- [${document.id === "north-star" && index === 0 ? "x" : " "}] ${task}`),
  ].join("\n");

export const exampleDefaults = {
  scribble: {
    query: "",
    favoriteIds: ["north-star"],
    documents: scribbleDocuments,
    contentById: Object.fromEntries(scribbleDocuments.map((document) => [document.id, documentMarkdown(document)])),
  },
  boombox: {
    playing: true,
    likedIds: ["paper-moon"],
    queueIds: ["afterimage", "still-life"],
    filter: "Your library",
    query: "",
  },
  zipline: {
    statuses: Object.fromEntries(ziplineIssues.map((issue) => [issue.id, issue.status])) as Record<string, IssueStatus>,
  },
  pigeon: {
    query: "",
    archivedIds: [] as string[],
    starredIds: pigeonThreads.filter((thread) => thread.starred).map((thread) => thread.id),
    readIds: [] as string[],
    folder: "Inbox",
    composing: false,
    sent: [] as { id: string; to: string; subject: string; body: string }[],
    draft: { to: "", subject: "", body: "" },
  },
  kiln: {
    frame: 42,
    playing: false,
    playbackStartedAt: 0,
    objectStates: Object.fromEntries(
      kilnObjects.map((object) => [
        object.id,
        { position: object.position, rotation: object.rotation, scale: object.scale, visible: true },
      ]),
    ),
  },
};

export type ExampleName = keyof typeof exampleDefaults;
export type ExampleState<Name extends ExampleName> = (typeof exampleDefaults)[Name];
export const exampleNames = Object.keys(exampleDefaults) as ExampleName[];
export const exampleResources = {
  scribble: scribbleDocuments.map((doc) => ({ type: "scribble.document", id: doc.id, label: doc.title })),
  boombox: boomboxTracks.map((track) => ({ type: "boombox.track", id: track.id, label: track.title })),
  zipline: ziplineIssues.map((issue) => ({ type: "zipline.issue", id: issue.id, label: issue.title })),
  pigeon: pigeonThreads.map((thread) => ({ type: "pigeon.thread", id: thread.id, label: thread.subject })),
  kiln: kilnObjects.map((object) => ({ type: "kiln.object", id: object.id, label: object.name })),
};
