import { defineFrame } from "./frame";

export const classicFrame = defineFrame({
  id: "classic",
  root: {
    kind: "split",
    id: "workbench",
    direction: "column",
    children: [
      {
        kind: "split",
        id: "shell",
        direction: "row",
        children: [
          {
            kind: "slot",
            id: "activity",
            owner: "project",
            role: "chrome",
            size: { defaultPx: 56, minPx: 56, maxPx: 56 },
          },
          {
            kind: "slot",
            id: "left",
            owner: "project",
            role: "projection",
            reads: ["primary"],
            navigator: true,
            targetable: true,
            regions: { header: "left-header" },
            size: { defaultPx: 240, minPx: 200 },
          },
          {
            kind: "split",
            id: "content",
            direction: "column",
            children: [
              {
                kind: "slot",
                id: "nav",
                owner: "project",
                role: "projection",
                reads: ["primary", "attached"],
                size: { defaultPx: 40, minPx: 40, maxPx: 40 },
              },
              {
                kind: "split",
                id: "body",
                direction: "column",
                children: [
                  {
                    kind: "slot",
                    id: "main",
                    owner: "resource",
                    role: "panels",
                    targetable: true,
                    regions: {
                      header: "main-header",
                      leftMenu: "main-left-menu",
                      rightMenu: "main-right-menu",
                    },
                  },
                  {
                    kind: "slot",
                    id: "secondary",
                    owner: "resource",
                    role: "panels",
                    targetable: true,
                    regions: {
                      header: "secondary-header",
                      leftMenu: "secondary-left-menu",
                      rightMenu: "secondary-right-menu",
                    },
                    size: { defaultPx: 240, minPx: 128, maxPx: 420 },
                  },
                ],
              },
            ],
          },
          {
            kind: "slot",
            id: "side",
            owner: "project",
            role: "panels",
            targetable: true,
            presentations: ["docked", "floating"],
            regions: {
              header: "side-header",
              leftMenu: "side-left-menu",
              rightMenu: "side-right-menu",
            },
            size: { defaultPx: 448, minPx: 320 },
          },
          { kind: "slot", id: "overlay", owner: "project", role: "transient" },
        ],
      },
      {
        kind: "slot",
        id: "status",
        owner: "project",
        role: "projection",
        reads: ["primary", "attached"],
        size: { defaultPx: 28, minPx: 28, maxPx: 28 },
      },
    ],
  },
  primary: "main",
  secondary: { slot: "secondary", persistence: "derived", candidates: "scoped" },
  attached: { slot: "side", persistence: "detached", candidates: "scoped" },
});
