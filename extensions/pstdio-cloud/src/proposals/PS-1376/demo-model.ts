import { useState } from "react";

export const people = [
  { id: "alex", name: "Alex Morgan", role: "Owner" },
  { id: "morgan", name: "Morgan Lee", role: "Member" },
  { id: "riley", name: "Riley Chen", role: "Member" },
];

export const initialProjects = [
  { id: "a", name: "Project A", members: ["alex", "morgan"] },
  { id: "b", name: "Project B", members: ["alex"] },
];

export interface DemoTool {
  id: string;
  name: string;
  enabled: boolean;
  required: boolean;
}

const initialTools = (): Record<string, DemoTool[]> => ({
  a: [
    { id: "pulse", name: "Onefin Pulse", enabled: true, required: true },
    { id: "notes", name: "Notes", enabled: true, required: false },
  ],
  b: [{ id: "notes", name: "Notes", enabled: true, required: false }],
});

export const useTeamDemo = () => {
  const [viewer, setViewer] = useState("alex");
  const [members, setMembers] = useState(["alex", "morgan"]);
  const [projects, setProjects] = useState(initialProjects);
  const [tools, setTools] = useState(initialTools);
  const [invitation, setInvitation] = useState<string>();
  const [managedPreview, setManagedPreview] = useState(false);
  const owner = viewer === "alex";
  const joined = members.includes(viewer);
  const updateTool = (project: string, id: string, change: Partial<DemoTool>) =>
    setTools((current) => ({
      ...current,
      [project]: current[project].map((tool) => (tool.id === id ? { ...tool, ...change } : tool)),
    }));
  return {
    viewer,
    setViewer,
    members,
    projects,
    tools,
    invitation,
    managedPreview,
    setManagedPreview,
    owner,
    joined,
    invite: () => setInvitation(`STUDIO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`),
    revoke: () => setInvitation(undefined),
    join(code: string) {
      if (!invitation || code.trim() !== invitation) return false;
      setMembers((current) => [...new Set([...current, viewer])]);
      setInvitation(undefined);
      return true;
    },
    removeMember(id: string) {
      setMembers((current) => current.filter((member) => member !== id));
      setProjects((current) =>
        current.map((project) => ({ ...project, members: project.members.filter((m) => m !== id) })),
      );
    },
    toggleAccess(projectId: string, id: string) {
      setProjects((current) =>
        current.map((project) =>
          project.id !== projectId
            ? project
            : {
                ...project,
                members: project.members.includes(id)
                  ? project.members.filter((member) => member !== id)
                  : [...project.members, id],
              },
        ),
      );
    },
    updateTool,
    removeTool(project: string, id: string) {
      setTools((current) => ({ ...current, [project]: current[project].filter((tool) => tool.id !== id) }));
    },
    restoreNotes(project: string) {
      setTools((current) => ({
        ...current,
        [project]: [...current[project], { id: "notes", name: "Notes", enabled: true, required: false }],
      }));
    },
  };
};

export type TeamDemo = ReturnType<typeof useTeamDemo>;
