import { useState } from "react";

export const people = [
  { id: "alex", name: "Alex Morgan", handle: "alexmorgan", owner: true },
  { id: "morgan", name: "Morgan Lee", handle: "morganlee" },
  { id: "lana", name: "Lana Steiner", handle: "lanasteiner" },
  { id: "sofia", name: "Sofia Davis", handle: "sofiadavis" },
  { id: "drew", name: "Drew Cano", handle: "drewcano" },
  { id: "marcus", name: "Marcus Lane", handle: "marcuslane" },
  { id: "riley", name: "Riley Chen", handle: "rileychen" },
];

export const extensions = [
  { id: "pulse", name: "Onefin Pulse", publisher: "Onefin", version: "1.2.0", icon: "activity" },
  { id: "planner", name: "Planner", publisher: "Prompt Studio", version: "0.48.0", icon: "list-checks" },
  { id: "notes", name: "Notes", publisher: "Prompt Studio", version: "0.48.0", icon: "notebook-pen" },
  { id: "files", name: "Files", publisher: "Prompt Studio", version: "0.48.0", icon: "folder" },
];

export const useTeamDemo = (viewer: string) => {
  const [members, setMembers] = useState(people.filter((person) => person.id !== "riley").map((person) => person.id));
  const [invitation, setInvitation] = useState<string>();
  const [managed, setManaged] = useState(["pulse"]);
  return {
    viewer,
    owner: viewer === "alex",
    joined: members.includes(viewer),
    members,
    invitation,
    managed,
    invite: () => setInvitation((current) => current ?? `STUDIO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`),
    revoke: () => setInvitation(undefined),
    removeMember: (id: string) => setMembers((current) => current.filter((member) => member !== id)),
    join(code: string) {
      if (!invitation || code.trim() !== invitation) return false;
      setMembers((current) => [...new Set([...current, viewer])]);
      setInvitation(undefined);
      return true;
    },
    setManaged(id: string, checked: boolean) {
      setManaged((current) => (checked ? [...new Set([...current, id])] : current.filter((entry) => entry !== id)));
    },
  };
};

export type TeamDemo = ReturnType<typeof useTeamDemo>;
