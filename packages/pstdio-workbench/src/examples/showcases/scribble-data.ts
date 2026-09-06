export interface ScribbleDocument {
  id: string;
  title: string;
  icon: string;
  eyebrow: string;
  intro: string;
  sections: readonly { title: string; body: string }[];
  tasks: readonly string[];
}

export const scribbleDocuments: readonly ScribbleDocument[] = [
  {
    id: "north-star",
    title: "North star",
    icon: "Compass",
    eyebrow: "PLANNING · UPDATED 2 MIN AGO",
    intro: "A small map of the work we want to be proud of this autumn.",
    sections: [
      { title: "Why now", body: "The team has the right pieces. Our job is to connect them without adding noise." },
      {
        title: "What good looks like",
        body: "Every project starts with context, ends with a decision, and stays easy to revisit.",
      },
    ],
    tasks: ["Interview five teams", "Publish the first working draft", "Plan the September review"],
  },
  {
    id: "field-notes",
    title: "Field notes",
    icon: "NotebookPen",
    eyebrow: "RESEARCH · YESTERDAY",
    intro: "Loose observations from a week spent watching people plan their work.",
    sections: [
      { title: "Patterns", body: "People write before they structure. The best tools let order arrive later." },
      { title: "Open question", body: "How can a workspace feel calm when the work itself changes every day?" },
    ],
    tasks: ["Tag interview notes", "Share the summary"],
  },
  {
    id: "oslo-weekend",
    title: "Oslo weekend",
    icon: "Map",
    eyebrow: "PERSONAL · FRIDAY",
    intro: "Coffee, long walks, and enough empty time to get pleasantly lost.",
    sections: [
      { title: "Saturday", body: "Start at Tim Wendelboe, walk the river, then take the ferry before dinner." },
      { title: "Pack", body: "Rain shell, paperback, headphones, and the small camera." },
    ],
    tasks: ["Book the sauna", "Download the ferry map", "Charge the camera"],
  },
  {
    id: "reading-list",
    title: "Reading list",
    icon: "Library",
    eyebrow: "LIBRARY · 12 NOTES",
    intro: "Books and essays worth returning to, with the useful bits close at hand.",
    sections: [
      { title: "Up next", body: "The Creative Act, Ways of Seeing, and a long essay about urban trees." },
      { title: "Recently saved", body: "A field guide to typography and an interview with Maggie Nelson." },
    ],
    tasks: ["Finish Ways of Seeing", "Find the typography essay"],
  },
];
