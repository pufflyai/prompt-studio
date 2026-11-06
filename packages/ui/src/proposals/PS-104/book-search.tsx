import { BookOpen, FileCode2 } from "lucide-react";
import { Palette } from "../../components/command-palette/palette";
import { type Rule, ruleSearchEntries, testSourceHref } from "./book-model";

interface SearchProps {
  rules: Rule[];
  open: boolean;
  onOpen: (ref: string) => void;
  onClose: () => void;
}
export function BookSearch({ rules, open, onOpen, onClose }: SearchProps) {
  const tests = [...new Set(rules.flatMap((rule) => rule.acceptance.flatMap((condition) => condition.tests)))];
  return (
    <Palette
      open={open}
      label="Search resources"
      placeholder="Search resources…"
      onClose={onClose}
      entries={[
        ...ruleSearchEntries(rules).map((entry) => ({
          ...entry,
          group: "Requirements",
          icon: <BookOpen />,
          onActivate: () => {
            onClose();
            onOpen(entry.id);
          },
        })),
        ...tests.map((path) => ({
          id: path,
          label: path.split("/").pop()!,
          secondaryLabel: path,
          group: "Tests",
          assetType: "file",
          icon: <FileCode2 />,
          onActivate: () => {
            onClose();
            window.open(testSourceHref(path), "_blank", "noopener,noreferrer");
          },
        })),
      ]}
    />
  );
}
