import { createWorkbench } from "../../core";
import { PigeonComposer } from "./pigeon-composer";
import { PigeonInbox } from "./pigeon-inbox";
import { Folders, PigeonNav } from "./pigeon-navigation";
import { pigeonHomePage, pigeonResourcePage } from "./pigeon-pages";
import { PigeonReadingPane } from "./pigeon-reading-pane";
import { pigeonTheme } from "./themes";

export const createPigeonWorkbench = () => {
  const workbench = createWorkbench({ startPage: pigeonHomePage, initialSidePanelMode: "floating" });
  workbench.themes.register([pigeonTheme]);
  workbench.modes.registerMode({
    id: "pigeon",
    label: "Pigeon",
    chrome: { nav: "pigeon.nav", sidenav: "pigeon.folders", activity: false },
    resourceKinds: ["pigeon.thread"],
    regionSettings: {
      sidenav: { size: { defaultPx: 220, minPx: 200, maxPx: 280 }, collapsible: false },
      side: { size: { defaultPx: 480, minPx: 360, maxPx: 600 } },
    },
    activate: () => undefined,
  });
  workbench.views.registerView({
    id: "pigeon.nav",
    title: "Pigeon",
    body: { kind: "react", render: () => <PigeonNav /> },
  });
  workbench.views.registerView({
    id: "pigeon.folders",
    title: "Folders",
    body: { kind: "react", render: (input) => <Folders workbench={input.workbench} /> },
  });
  workbench.views.registerView({
    id: "pigeon.inbox",
    title: "Inbox",
    body: { kind: "react", render: (input) => <PigeonInbox input={input} /> },
  });
  workbench.views.registerView({
    id: "pigeon.reader",
    title: "Message",
    body: { kind: "react", render: (input) => <PigeonReadingPane input={input} /> },
  });
  workbench.views.registerView({
    id: "pigeon.composer",
    title: "New message",
    body: { kind: "react", render: (input) => <PigeonComposer input={input} /> },
  });
  workbench.overlays.registerOverlay({ id: "pigeon.compose", viewId: "pigeon.composer", closable: true });
  workbench.pages.registerPage({
    id: "pigeon.home",
    ref: pigeonHomePage,
    title: "Inbox",
    path: "pigeon/inbox",
    modeId: "pigeon",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "pigeon.inbox",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "pigeon.resource",
    ref: pigeonResourcePage,
    title: "Inbox",
    path: "pigeon/inbox/resource",
    modeId: "pigeon",
    parentId: "pigeon.home",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "pigeon.thread",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "pigeon.inbox",
      },
      cardinality: "one",
    },
    slots: [
      {
        id: "reader",
        region: "side",
        openOn: "page-resource",
        item: {
          kind: "binding",
          binding: {
            kinds: [
              {
                kind: "resource-kind",
                id: "pigeon.thread",
              },
            ],
            view: {
              kind: "view",
              id: "pigeon.reader",
            },
            cardinality: "one",
          },
        },
      },
    ],
  });
  workbench.pageLocations.switchProject("storybook-pigeon");
  workbench.pageLocations.navigate({ kind: "page", page: pigeonHomePage });
  return workbench;
};
