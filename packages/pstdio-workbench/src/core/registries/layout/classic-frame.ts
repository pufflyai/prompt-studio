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
          { kind: "slot", id: "activity", owner: "project", role: "chrome" },
          {
            kind: "split",
            id: "sidebar-content",
            direction: "row",
            children: [
              {
                kind: "split",
                id: "sidebar",
                direction: "column",
                children: [
                  {
                    kind: "slot",
                    id: "left-header",
                    owner: "project",
                    role: "projection",
                    reads: ["primary"],
                  },
                  {
                    kind: "slot",
                    id: "left",
                    owner: "project",
                    role: "projection",
                    reads: ["primary"],
                    navigator: true,
                    targetable: true,
                    size: { defaultPx: 240, minPx: 200 },
                  },
                ],
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
                  },
                  {
                    kind: "split",
                    id: "body",
                    direction: "column",
                    children: [
                      {
                        kind: "slot",
                        id: "main-header",
                        owner: "resource",
                        role: "projection",
                        reads: ["primary"],
                      },
                      {
                        kind: "split",
                        id: "main-row",
                        direction: "row",
                        children: [
                          {
                            kind: "slot",
                            id: "main-left",
                            owner: "resource",
                            role: "projection",
                            reads: ["primary"],
                            companionOf: "main",
                            targetable: true,
                            size: { defaultPx: 240, minPx: 180, maxPx: 420 },
                          },
                          {
                            kind: "slot",
                            id: "main",
                            owner: "resource",
                            role: "panels",
                            targetable: true,
                          },
                          {
                            kind: "slot",
                            id: "main-right",
                            owner: "resource",
                            role: "projection",
                            reads: ["primary"],
                            companionOf: "main",
                            targetable: true,
                            size: { defaultPx: 320, minPx: 240, maxPx: 520 },
                          },
                        ],
                      },
                      {
                        kind: "split",
                        id: "bottom",
                        direction: "column",
                        children: [
                          {
                            kind: "slot",
                            id: "secondary-header",
                            owner: "resource",
                            role: "projection",
                            reads: ["primary"],
                          },
                          {
                            kind: "slot",
                            id: "secondary",
                            owner: "resource",
                            role: "panels",
                            targetable: true,
                            size: { defaultPx: 240, minPx: 128, maxPx: 420 },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: "slot",
        id: "status",
        owner: "project",
        role: "projection",
        reads: ["primary", "attached"],
      },
      {
        kind: "split",
        id: "layers",
        direction: "column",
        children: [
          { kind: "slot", id: "overlay", owner: "project", role: "transient" },
          {
            kind: "slot",
            id: "floating-header",
            owner: "project",
            role: "projection",
            reads: ["attached"],
          },
          {
            kind: "slot",
            id: "floating",
            owner: "project",
            role: "panels",
            presentations: ["docked", "floating", "hidden"],
          },
        ],
      },
    ],
  },
  primary: "main",
  secondary: { slot: "secondary", persistence: "derived", candidates: "scoped" },
  attached: { slot: "floating", persistence: "detached", candidates: "scoped" },
});
