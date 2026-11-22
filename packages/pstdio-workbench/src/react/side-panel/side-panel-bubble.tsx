import { BubbleButton, type ResourceContextAction, ResourceContextMenu } from "@pstdio/ui";
import { MessageCircle } from "lucide-react";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import {
  getSidePanelBubblePanels,
  openSidePanelBubble,
  sidePanelBubblePreferences,
} from "../../core/controllers/side-panel/side-panel-bubble";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchCompositionRegionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface SidePanelBubbleProps {
  workbench: WorkbenchCore;
  buttonRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  bottom: string;
  icon?: ReactNode;
  defaultPanelLabel?: string;
  onOpen?: () => void | Promise<void>;
}

const alignments = ["left", "center", "right"] as const;
type Alignment = (typeof alignments)[number];
const alignmentAt = (x: number, width: number) => alignments[Math.min(2, Math.max(0, Math.floor(x / (width / 3))))]!;

export const SidePanelBubble = (props: SidePanelBubbleProps) => {
  "use no memo";

  const { workbench, buttonRef, isOpen, bottom, icon, defaultPanelLabel, onOpen } = props;
  const alignment = useWorkbenchStore(
    workbench.preferences.store,
    () => workbench.preferences.getValue(sidePanelBubblePreferences.alignment) as Alignment,
  );
  const selected = useWorkbenchStore(workbench.preferences.store, () =>
    workbench.preferences.getValue(sidePanelBubblePreferences.panel),
  );
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  useWorkbenchCompositionRegionPanels(workbench, "side");
  const [previewAlignment, setPreviewAlignment] = useState<Alignment>();
  const drag = useRef<{ x: number; moved: boolean; alignment: Alignment } | null>(null);
  const suppressClick = useRef(false);
  const save = (name: string, value: string) =>
    runUserAction(workbench, "Customize Side Panel bubble", () =>
      workbench.preferences.setValue(name, value, { scope: "user" }),
    );
  const choosePanel = (id: string) => () => save(sidePanelBubblePreferences.panel, id);
  const choices: ResourceContextAction[] = [
    ...(onOpen
      ? [
          {
            key: "default",
            label: defaultPanelLabel ? `Default (${defaultPanelLabel})` : "Default",
            isSelected: selected === "default",
            onClick: choosePanel("default"),
          },
        ]
      : []),
    {
      key: "none",
      label: "Side Panel",
      isSelected: selected === "none" || (selected === "default" && !onOpen),
      onClick: choosePanel("none"),
    },
    ...getSidePanelBubblePanels(workbench).map((panel) => ({
      key: `panel:${panel.id}`,
      label: panel.title,
      isSelected: selected === `panel:${panel.id}`,
      onClick: choosePanel(`panel:${panel.id}`),
    })),
  ];
  const actions: ResourceContextAction[] = [
    ...alignments.map((value) => ({
      key: value,
      label: `Align ${value}`,
      isSelected: alignment === value,
      onClick: () => save(sidePanelBubblePreferences.alignment, value),
    })),
    { key: "panel", label: "Default panel", separatorBefore: true, items: choices },
  ];
  const shownAlignment = previewAlignment ?? alignment;
  const justify = { left: "flex-start", center: "center", right: "flex-end" } as const;
  return (
    <ResourceContextMenu actions={actions}>
      <BubbleButton
        ref={buttonRef}
        isOpen={isOpen}
        aria-label="Open Side Panel"
        tooltip="Open Side Panel"
        aria-keyshortcuts="Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
        data-side-panel-bubble-alignment={shownAlignment}
        containerProps={{
          bottom,
          left: "6",
          right: "6",
          display: "flex",
          justifyContent: justify[shownAlignment],
          pointerEvents: "none",
        }}
        pointerEvents="auto"
        onPointerDown={(event) => {
          if (event.button !== 0 || event.pointerType === "touch") return;
          suppressClick.current = false;
          drag.current = { x: event.clientX, moved: false, alignment };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current || (!current.moved && Math.abs(event.clientX - current.x) < 6)) return;
          current.moved = true;
          current.alignment = alignmentAt(event.clientX, event.currentTarget.ownerDocument.documentElement.clientWidth);
          setPreviewAlignment(current.alignment);
        }}
        onPointerUp={() => {
          const current = drag.current;
          drag.current = null;
          setPreviewAlignment(undefined);
          if (!current?.moved) return;
          suppressClick.current = true;
          void save(sidePanelBubblePreferences.alignment, current.alignment);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPreviewAlignment(undefined);
        }}
        onKeyDown={(event) => {
          if (!event.altKey || !event.shiftKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const next = alignments[alignments.indexOf(alignment) + (event.key === "ArrowLeft" ? -1 : 1)];
          if (next) void save(sidePanelBubblePreferences.alignment, next);
        }}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            event.preventDefault();
            return;
          }
          void runUserAction(workbench, "Open Side Panel", () =>
            fullscreen
              ? workbench.commands.executeCommand("workbench.showFullscreenSide")
              : openSidePanelBubble(workbench, onOpen),
          );
        }}
      >
        {icon ?? <MessageCircle size={20} strokeWidth={2} />}
      </BubbleButton>
    </ResourceContextMenu>
  );
};
