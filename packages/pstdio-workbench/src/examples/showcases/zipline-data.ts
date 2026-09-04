export type IssueStatus = "Backlog" | "In progress" | "Done";

export interface ZiplineIssue {
  id: string;
  title: string;
  team: string;
  status: IssueStatus;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  summary: string;
}

export const ziplineIssues: readonly ZiplineIssue[] = [
  {
    id: "ZIP-142",
    title: "Polish command menu transitions",
    team: "Product",
    status: "In progress",
    priority: "High",
    assignee: "Maya Chen",
    summary: "Keep keyboard focus stable while results update and the menu changes height.",
  },
  {
    id: "ZIP-137",
    title: "Add weekly project digest",
    team: "Growth",
    status: "Backlog",
    priority: "Medium",
    assignee: "Noah Kim",
    summary: "Send a short Monday digest with project movement, blockers, and upcoming milestones.",
  },
  {
    id: "ZIP-131",
    title: "Reduce cold start time",
    team: "Platform",
    status: "In progress",
    priority: "High",
    assignee: "Iris Bell",
    summary: "Load the shell first and defer non-critical workspace data until after first paint.",
  },
  {
    id: "ZIP-126",
    title: "Document notification rules",
    team: "Product",
    status: "Done",
    priority: "Low",
    assignee: "Alex Stone",
    summary: "Explain which changes trigger notifications and how personal preferences alter delivery.",
  },
  {
    id: "ZIP-119",
    title: "Review empty states",
    team: "Design",
    status: "Backlog",
    priority: "Medium",
    assignee: "Maya Chen",
    summary: "Make empty projects useful by showing the next concrete action and one example.",
  },
];
