export interface PigeonThread {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  body: readonly string[];
  unread?: boolean;
  starred?: boolean;
}

export const pigeonThreads: readonly PigeonThread[] = [
  {
    id: "launch-notes",
    sender: "Maya Chen",
    subject: "Launch notes for Friday",
    preview: "I pulled the final screenshots into the brief...",
    time: "10:42",
    unread: true,
    starred: true,
    body: [
      "Hey team,",
      "I pulled the final screenshots into the brief and tightened the opening section. The only open item is the mobile crop.",
      "Can someone give it one last read before 15:00?",
      "Maya",
    ],
  },
  {
    id: "build-green",
    sender: "Build Bot",
    subject: "Main is green again",
    preview: "All 412 checks passed on the latest commit.",
    time: "09:18",
    unread: true,
    body: ["All 412 checks passed on the latest commit.", "Total time: 8m 14s. No flaky tests detected."],
  },
  {
    id: "studio-visit",
    sender: "Lena Ortiz",
    subject: "Studio visit next week",
    preview: "Thursday afternoon works well for us...",
    time: "Yesterday",
    body: [
      "Hi Alex,",
      "Thursday afternoon works well for us. Come by any time after 14:00 and we can walk through the new space.",
      "See you then,",
      "Lena",
    ],
  },
  {
    id: "receipt",
    sender: "Paper & Co.",
    subject: "Your receipt #1842",
    preview: "Thanks for your order. Your parcel is on the way.",
    time: "Tue",
    body: ["Thanks for your order.", "Your parcel is on the way and should arrive in two business days."],
  },
  {
    id: "weekend",
    sender: "Jon Bell",
    subject: "Weekend route",
    preview: "The coastal train leaves at 08:06...",
    time: "Mon",
    starred: true,
    body: [
      "The coastal train leaves at 08:06. If we take that one, we can be at the trail before ten.",
      "I will bring coffee.",
    ],
  },
];
