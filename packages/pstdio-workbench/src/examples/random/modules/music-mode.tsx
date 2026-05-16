import type {
  Disposable,
  WorkbenchAreaSize,
  WorkbenchModeActivationContext,
  WorkbenchModuleContributionContext,
} from "../../../core";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import { MusicControls, MusicPlayer, MusicQueue, MusicStatus, MusicTopBar } from "../components/music";
import { itemResource, musicWidgetIds, railWidgetId, randomWorkbenchModes } from "../mock-data/data";

const musicMode = randomWorkbenchModes.music;

interface MusicWidgetSetup {
  id: string;
  title: string;
  area: "top" | "main" | "main-right" | "main-bottom" | "status";
  areaSize?: WorkbenchAreaSize;
  areaCollapsible?: boolean;
  render: (input: WorkbenchWidgetRenderInput) => React.ReactNode;
}

const musicWidgets: MusicWidgetSetup[] = [
  {
    id: musicWidgetIds.top,
    title: "Now playing header",
    area: "top",
    render: (input) => <MusicTopBar input={input} />,
  },
  { id: musicWidgetIds.player, title: "Now playing", area: "main", render: (input) => <MusicPlayer input={input} /> },
  { id: musicWidgetIds.queue, title: "Queue", area: "main-right", render: (input) => <MusicQueue input={input} /> },
  {
    id: musicWidgetIds.controls,
    title: "Playback controls",
    area: "main-bottom",
    areaSize: { defaultPx: 72, minPx: 72, maxPx: 72 },
    areaCollapsible: false,
    render: () => <MusicControls />,
  },
  { id: musicWidgetIds.status, title: "Music status", area: "status", render: () => <MusicStatus /> },
];

const setupMusicMode = (ctx: WorkbenchModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [];

  for (const widget of musicWidgets) {
    disposables.push(
      ctx.renderers.registerRenderer({ id: widget.id, render: widget.render }),
      ctx.layout.registerWidget({
        id: widget.id,
        title: widget.title,
        area: widget.area,
        areaSize: widget.areaSize,
        areaCollapsible: widget.areaCollapsible,
        singleton: true,
        rendererId: widget.id,
      }),
    );
  }

  ctx.layout.openWidget(railWidgetId, { pinned: true });

  const defaultItem = musicMode.items.find((item) => item.id === musicMode.defaultItemId) ?? musicMode.items[0];
  ctx.layout.openWidget(musicWidgetIds.player, {
    resource: itemResource(musicMode.id, defaultItem),
    title: defaultItem.title,
  });
  for (const widget of musicWidgets) {
    if (widget.id === musicWidgetIds.player) continue;
    ctx.layout.openWidget(widget.id, { pinned: true });
  }

  return disposables;
};

export const registerMusicMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: musicMode.id,
    label: musicMode.label,
    activate: setupMusicMode,
  });
};
