import type {
  Disposable,
  TreeNode,
  WorkbenchModeActivationContext,
  WorkbenchModuleContributionContext,
} from "../../../core";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import { MailParticipants, MailReader, MailStatus, MailTopBar } from "../components/mail";
import { itemResource, mailWidgetIds, railWidgetId, randomResourceKind, randomWorkbenchModes } from "../mock-data/data";

const mailMode = randomWorkbenchModes.mail;

interface MailWidgetSetup {
  id: string;
  title: string;
  region: "nav" | "main" | "main-right-menu" | "status";
  render: (input: WorkbenchWidgetRenderInput) => React.ReactNode;
}

const mailWidgets: MailWidgetSetup[] = [
  { id: mailWidgetIds.top, title: "Mail header", region: "nav", render: (input) => <MailTopBar input={input} /> },
  { id: mailWidgetIds.reader, title: "Reading pane", region: "main", render: (input) => <MailReader input={input} /> },
  {
    id: mailWidgetIds.participants,
    title: "Participants",
    region: "main-right-menu",
    render: () => <MailParticipants />,
  },
  { id: mailWidgetIds.status, title: "Inbox status", region: "status", render: () => <MailStatus /> },
];

const buildMailTreeSections = () =>
  mailMode.folders.map((folder) => ({
    id: folder.id,
    label: folder.label,
    nodes: folder.itemIds.flatMap((itemId): TreeNode[] => {
      const item = mailMode.items.find((candidate) => candidate.id === itemId);
      if (!item) return [];
      const resource = itemResource(mailMode.id, item);
      return [
        {
          id: `${folder.id}.${resource.uri}`,
          label: item.title,
          icon: "Mail",
          description: item.subtitle,
          resource,
        },
      ];
    }),
  }));

const setupMailMode = (ctx: WorkbenchModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [];

  for (const widget of mailWidgets) {
    disposables.push(
      ctx.renderers.registerRenderer({ id: widget.id, render: widget.render }),
      ctx.layout.registerWidget({
        id: widget.id,
        title: widget.title,
        region: widget.region,
        singleton: true,
        rendererId: widget.id,
      }),
    );
  }

  disposables.push(
    ctx.renderers.registerTreeRenderer({
      id: "mail.navigation",
      title: mailMode.label,
      getBody: () => buildMailTreeSections(),
      getChildren: () => [],
    }),
    ctx.layout.registerWidget({
      id: "mail.navigation",
      title: mailMode.label,
      region: "main-left-menu",
      rendererId: "mail.navigation",
    }),
    ctx.resources.registerOpener({
      id: "mail.opener",
      canOpen: (resource) => resource.kind === randomResourceKind && resource.metadata?.modeId === mailMode.id,
      open: (resource, input) =>
        ctx.layout.openWidget(mailWidgetIds.reader, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    }),
  );

  ctx.layout.openWidget(railWidgetId, { pinned: true });
  ctx.layout.openWidget("mail.navigation");

  const defaultThread = mailMode.items.find((item) => item.id === mailMode.defaultItemId) ?? mailMode.items[0];
  ctx.layout.openWidget(mailWidgetIds.reader, {
    resource: itemResource(mailMode.id, defaultThread),
    title: defaultThread.title,
  });
  for (const widget of mailWidgets) {
    if (widget.id === mailWidgetIds.reader) continue;
    ctx.layout.openWidget(widget.id, { pinned: true });
  }

  return disposables;
};

export const registerMailMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: mailMode.id,
    label: mailMode.label,
    activate: setupMailMode,
  });
};
