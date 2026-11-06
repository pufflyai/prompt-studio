import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ScrollArea } from "../../components/primitives/scroll-area";

type Section = "Findings" | "Undocumented" | "Suggestions" | "Chapters";
const sections: Section[] = ["Findings", "Undocumented", "Suggestions", "Chapters"];
const requirements = [
  {
    ref: "RB 1.A.1",
    level: "L1",
    title: "Editing stays responsive",
    statement: "Preserving work must not block local editing.",
  },
  {
    ref: "RB 2.A.1",
    level: "L2",
    title: "Make the save policy explicit",
    statement: "The editor has an explicit persistence policy.",
  },
];

function RequirementBook(props: { initialSection: Section; stale?: boolean }) {
  const { initialSection, stale = false } = props;
  const [section, setSection] = useState(initialSection);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [mapped, setMapped] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [drafted, setDrafted] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const needsReconciliation = stale && !reconciled;
  const openRequirement = (ref: string) => {
    setSelected(ref);
    setSection("Chapters");
  };
  return (
    <Stack h="full" minH="0" p="lg" gap="md" bg="bg" color="fg">
      <Text textStyle="heading/M">Requirement book</Text>
      <Text color="fg.muted">Illustrative preview · main @ demo-a1 · Accepted repository intent</Text>
      <HStack flexWrap="wrap" gap="sm">
        {sections.map((item) => (
          <Button key={item} variant={section === item ? "solid" : "ghost"} onClick={() => setSection(item)}>
            {item}
          </Button>
        ))}
      </HStack>
      <Input
        aria-label="Search requirements"
        placeholder="Search reference or statement"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected("");
          setSection("Chapters");
        }}
      />
      <ScrollArea flex="1" minH="0">
        <Stack gap="lg" p="sm">
          {section === "Findings" && (
            <>
              <Text textStyle="heading/S">F-1 · Potential conflict · Needs review</Text>
              <Text>
                A change to the save handler triggered a focused check. Per-keystroke persistence may affect local
                responsiveness; no executed measurement is attached.
              </Text>
              {requirements.map((item) => (
                <Stack key={item.ref} gap="xs">
                  <Button variant="outline" onClick={() => openRequirement(item.ref)}>
                    {item.ref} · {item.level} · {item.title}
                  </Button>
                  <Text>{item.statement}</Text>
                </Stack>
              ))}
              <Text color="fg.muted">
                Evidence: code inspection · working tree based on demo-a1 · editor save handler. Semantic coverage is
                incomplete.
              </Text>
              <Button
                alignSelf="start"
                onClick={() => {
                  setDrafted(true);
                  setSection("Suggestions");
                }}
              >
                Draft a suggestion
              </Button>
            </>
          )}
          {section === "Undocumented" && (
            <>
              <Text textStyle="heading/S">
                {mapped ? "No unmapped observations" : "O-1 · Test assertion · Unmapped"}
              </Text>
              {!mapped && (
                <>
                  <Text>
                    The illustrative test asserts that page A opens within 200 ms. This is not an executed result or an
                    accepted product budget.
                  </Text>
                  <Text color="fg.muted">
                    Evidence: test assertion · demo-a1 · fixture workload. Execution and environment have not been
                    verified.
                  </Text>
                  <HStack flexWrap="wrap">
                    <Button onClick={() => setMapped(true)}>Map to RB 2.A.1</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDrafted(true);
                        setSection("Suggestions");
                      }}
                    >
                      Propose a new requirement
                    </Button>
                  </HStack>
                </>
              )}
              {mapped && (
                <Button variant="outline" onClick={() => openRequirement("RB 2.A.1")}>
                  View retained evidence on RB 2.A.1
                </Button>
              )}
            </>
          )}
          {section === "Suggestions" && (
            <>
              <Text textStyle="heading/S">S-1 · Clarify persistence and responsiveness</Text>
              <Text>
                {drafted ? "Draft created in this preview" : "Local draft"} · Base demo-a1 ·{" "}
                {reviewed ? "Locally reviewed" : "Not reviewed"}
              </Text>
              <Text>Reason: expose the save policy and its performance implications together.</Text>
              <Text>AMEND · RB 2.A.1 · Editor</Text>
              <Text color="fg.muted">Before: The editor has an explicit persistence policy.</Text>
              <Text>After: Each edit requests persistence while local typing remains responsive.</Text>
              <Text>AMEND · RB 1.A.1 · Product principles</Text>
              <Text color="fg.muted">Before: Preserving work must not block local editing.</Text>
              <Text>
                After: Preserving work must not block local editing; assess the save workload with a stated environment
                and measurement method.
              </Text>
              <Text>
                Supporting finding: F-1. Implementation and executed performance evidence remain pending. These proposed
                policies are illustrative.
              </Text>
              {needsReconciliation && (
                <>
                  <Text>
                    Stale comparison: RB 2.A.1 changed at demo-b2. Review and application are unavailable until
                    reconciled.
                  </Text>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReconciled(true);
                      setReviewed(false);
                    }}
                  >
                    Simulate reconciliation
                  </Button>
                </>
              )}
              <HStack flexWrap="wrap">
                <Button disabled={needsReconciliation || reviewed} onClick={() => setReviewed(true)}>
                  Mark locally reviewed
                </Button>
                <Button variant="outline" disabled={needsReconciliation || applied} onClick={() => setApplied(true)}>
                  Simulate apply to branch
                </Button>
              </HStack>
              {applied && (
                <Text>
                  Preview only: changes would be proposed on feature/save-policy. No repository was edited and no PR was
                  created. Accepted main intent is unchanged.
                </Text>
              )}
            </>
          )}
          {section === "Chapters" && (
            <>
              <Text textStyle="heading/S">Chapters · Product principles / Editor</Text>
              {requirements
                .filter((item) =>
                  selected
                    ? item.ref === selected
                    : `${item.ref} ${item.title} ${item.statement}`.toLowerCase().includes(query.toLowerCase()),
                )
                .map((item) => (
                  <Stack key={item.ref} gap="sm">
                    <Text>
                      {item.ref} · {item.level} · {item.title}
                    </Text>
                    <Text>{item.statement}</Text>
                    <Button
                      alignSelf="start"
                      variant="outline"
                      onClick={() => openRequirement(item.ref === "RB 1.A.1" ? "RB 2.A.1" : "RB 1.A.1")}
                    >
                      Open related {item.ref === "RB 1.A.1" ? "behavior RB 2.A.1" : "intent RB 1.A.1"}
                    </Button>
                    <Button alignSelf="start" variant="ghost" onClick={() => setSection("Findings")}>
                      Inspect finding F-1
                    </Button>
                    {mapped && item.ref === "RB 2.A.1" && (
                      <>
                        <Text>O-1 · Test assertion · Not measured · Mapping does not establish compliance.</Text>
                        <Button
                          alignSelf="start"
                          variant="outline"
                          onClick={() => {
                            setMapped(false);
                            setSection("Undocumented");
                          }}
                        >
                          Remove final mapping
                        </Button>
                      </>
                    )}
                  </Stack>
                ))}
            </>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

export default {
  title: "Proposals/PS-104 Requirement book",
  description:
    "Synthetic workflow exploration. All data and branch actions are local to each frame; this does not implement the extension.",
  fullscreen: true,
} satisfies CanvasMeta;

export const FindingsAndIntent = () => <RequirementBook initialSection="Findings" />;
export const ObservationMapping = () => <RequirementBook initialSection="Undocumented" />;
export const SuggestionReview = () => <RequirementBook initialSection="Suggestions" />;
export const StaleSuggestion = () => <RequirementBook initialSection="Suggestions" stale />;
