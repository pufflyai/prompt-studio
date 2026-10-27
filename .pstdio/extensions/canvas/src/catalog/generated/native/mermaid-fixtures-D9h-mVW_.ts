// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/ui/src/components/mermaid-renderer/mermaid-fixtures.ts
var e = {
	ps81Flowchart: "flowchart LR\n  Editor[\"Markdown document<br/>editor\"] -->|\"fenced mermaid block\"| Node[\"MermaidNode\"]\n  Node -->|\"source code\"| Renderer[\"MermaidRenderer\"]\n  Renderer -->|\"stable SVG preview\"| Preview[\"Readable inline preview\"]\n  Preview -->|\"zoomed past 100 percent\"| Pan[\"Pannable viewport\"]\n  Renderer -->|\"fullscreen inspect\"| Fullscreen[\"Fullscreen preview\"]\n  Fullscreen -->|\"Download as PNG\"| Export[\"Raster export\"]",
	sequence: "sequenceDiagram\n  participant User\n  participant Editor\n  participant Renderer\n  User->>Editor: Open document\n  Editor->>Renderer: Render mermaid source\n  Renderer-->>Editor: SVG preview\n  User->>Renderer: Zoom and inspect",
	state: "stateDiagram-v2\n  [*] --> Preview\n  Preview --> Editing: Edit\n  Editing --> Preview: Preview\n  Preview --> Fullscreen: Fullscreen\n  Fullscreen --> Preview: Close",
	er: "erDiagram\n  DOCUMENT ||--o{ MERMAID_BLOCK : contains\n  MERMAID_BLOCK ||--|| SVG_PREVIEW : renders\n  SVG_PREVIEW ||--o{ PNG_EXPORT : creates\n  DOCUMENT {\n    string id\n    string title\n  }\n  MERMAID_BLOCK {\n    string source\n  }",
	class: "classDiagram\n  class MermaidRenderer {\n    +code\n    +zoom()\n    +fullscreen()\n  }\n  class MermaidNode {\n    +getCode()\n    +setCode()\n  }\n  MermaidNode --> MermaidRenderer",
	gantt: "gantt\n  title Mermaid rendering workflow\n  dateFormat  YYYY-MM-DD\n  section Preview\n  Render SVG           :done, render, 2026-06-01, 2d\n  Inspect fullscreen   :active, inspect, after render, 3d\n  section Export\n  Download PNG         :export, after inspect, 1d",
	invalid: "flowchart TD\n  A -->"
};
export { e as t };
