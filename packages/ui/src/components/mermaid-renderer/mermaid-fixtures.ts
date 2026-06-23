export const mermaidFixtures = {
  ps81Flowchart: `flowchart LR
  Editor["Markdown document<br/>editor"] -->|"fenced mermaid block"| Node["MermaidNode"]
  Node -->|"source code"| Renderer["MermaidRenderer"]
  Renderer -->|"stable SVG preview"| Preview["Readable inline preview"]
  Preview -->|"zoomed past 100 percent"| Pan["Pannable viewport"]
  Renderer -->|"fullscreen inspect"| Fullscreen["Fullscreen preview"]
  Fullscreen -->|"Download as PNG"| Export["Raster export"]`,

  sequence: `sequenceDiagram
  participant User
  participant Editor
  participant Renderer
  User->>Editor: Open document
  Editor->>Renderer: Render mermaid source
  Renderer-->>Editor: SVG preview
  User->>Renderer: Zoom and inspect`,

  state: `stateDiagram-v2
  [*] --> Preview
  Preview --> Editing: Edit
  Editing --> Preview: Preview
  Preview --> Fullscreen: Fullscreen
  Fullscreen --> Preview: Close`,

  er: `erDiagram
  DOCUMENT ||--o{ MERMAID_BLOCK : contains
  MERMAID_BLOCK ||--|| SVG_PREVIEW : renders
  SVG_PREVIEW ||--o{ PNG_EXPORT : creates
  DOCUMENT {
    string id
    string title
  }
  MERMAID_BLOCK {
    string source
  }`,

  class: `classDiagram
  class MermaidRenderer {
    +code
    +zoom()
    +fullscreen()
  }
  class MermaidNode {
    +getCode()
    +setCode()
  }
  MermaidNode --> MermaidRenderer`,

  gantt: `gantt
  title Mermaid rendering workflow
  dateFormat  YYYY-MM-DD
  section Preview
  Render SVG           :done, render, 2026-06-01, 2d
  Inspect fullscreen   :active, inspect, after render, 3d
  section Export
  Download PNG         :export, after inspect, 1d`,

  invalid: `flowchart TD
  A -->`,
} as const;
