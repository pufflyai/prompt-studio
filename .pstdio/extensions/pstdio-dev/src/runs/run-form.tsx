import { Button, Fieldset, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { Checkbox, Chip, SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { X } from "lucide-react";
import { useState } from "react";
import { PLATFORMS, SAMPLE_COUNTS, SUITES } from "../benchmarks/platforms";

export interface RunRequest {
  commits: string[];
  suites: string[];
  platforms: string[];
  samples: number;
}

interface QuickCommit {
  label: string;
  ref: string;
}

interface RunFormProps {
  value: RunRequest;
  quick: QuickCommit[];
  pending: boolean;
  error?: string;
  onChange: (value: RunRequest) => void;
  onStart: () => void;
}

const toggle = (list: string[], item: string) =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

// Suites run as parallel jobs, so the slowest chosen suite sets the length. Each commit builds once first.
export const estimateMinutes = (request: RunRequest) => {
  const chosen = SUITES.filter((suite) => request.suites.includes(suite.id));
  const slowest = Math.max(0, ...chosen.map((suite) => suite.minutes));
  return request.commits.length * (10 + slowest * request.samples);
};

const problemOf = (request: RunRequest) => {
  if (!request.commits.length) return "Add at least one commit.";
  if (!request.suites.length) return "Pick at least one suite.";
  if (!request.platforms.length) return "Pick at least one platform.";
  return undefined;
};

export const RunForm = (props: RunFormProps) => {
  const { value, quick, pending, error, onChange, onStart } = props;
  const [draft, setDraft] = useState("");
  const problem = problemOf(value);
  const minutes = estimateMinutes(value);
  const addCommit = (ref: string) => {
    if (ref.trim()) onChange({ ...value, commits: [...value.commits, ref.trim()] });
    setDraft("");
  };
  return (
    <SimpleCard>
      <SimpleCardBody display="flex" flexDirection="column" gap="lg">
        <Text textStyle="heading/S">New run</Text>
        <Stack gap="xs">
          <Text textStyle="label/S/regular" color="fg.muted">
            Commits, branches, or tags · the first one is the base
          </Text>
          {value.commits.map((ref, index) => (
            <HStack key={`${ref}-${index}`} gap="sm" bg="bg.subtle" borderRadius="xs" px="sm" py="2xs">
              <Text textStyle="mono/XS" flex="1" truncate>
                {ref}
              </Text>
              <Text textStyle="label/XS" color="fg.muted">
                {index ? "Head" : "Base"}
              </Text>
              <IconButton
                size="xs"
                variant="ghost"
                aria-label={`Remove ${ref}`}
                onClick={() => onChange({ ...value, commits: value.commits.filter((_, entry) => entry !== index) })}
              >
                <X />
              </IconButton>
            </HStack>
          ))}
          <HStack
            as="form"
            gap="xs"
            onSubmit={(event) => {
              event.preventDefault();
              addCommit(draft);
            }}
          >
            <Input
              size="sm"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="main, pstdio@0.45.0, or a pushed SHA"
              aria-label="Add a commit, branch, or tag"
            />
            <Button size="sm" variant="outline" type="submit">
              Add
            </Button>
          </HStack>
          <HStack gap="xs" wrap="wrap">
            {quick.map((entry) => (
              <Chip key={entry.label} as="button" cursor="pointer" onClick={() => addCommit(entry.ref)}>
                + {entry.label}
              </Chip>
            ))}
          </HStack>
        </Stack>
        <Fieldset.Root>
          <Fieldset.Legend textStyle="label/S/regular" color="fg.muted">
            Suites
          </Fieldset.Legend>
          <Stack gap="xs" pt="xs">
            {SUITES.map((suite) => (
              <Checkbox
                key={suite.id}
                checked={value.suites.includes(suite.id)}
                onCheckedChange={() => onChange({ ...value, suites: toggle(value.suites, suite.id) })}
              >
                {suite.label}
              </Checkbox>
            ))}
          </Stack>
        </Fieldset.Root>
        <Fieldset.Root>
          <Fieldset.Legend textStyle="label/S/regular" color="fg.muted">
            Platforms
          </Fieldset.Legend>
          <HStack gap="md" wrap="wrap" pt="xs">
            {PLATFORMS.map((platform) => (
              <Checkbox
                key={platform.id}
                checked={value.platforms.includes(platform.id)}
                onCheckedChange={() => onChange({ ...value, platforms: toggle(value.platforms, platform.id) })}
              >
                {platform.label}
              </Checkbox>
            ))}
          </HStack>
        </Fieldset.Root>
        <Stack gap="xs">
          <Text textStyle="label/S/regular" color="fg.muted">
            Samples per commit
          </Text>
          <SegmentedControl
            aria-label="Samples per commit"
            value={String(value.samples)}
            onValueChange={(samples) => onChange({ ...value, samples: Number(samples) })}
            options={SAMPLE_COUNTS.map((count) => ({ value: String(count), label: String(count) }))}
          />
          <Text textStyle="label/XS" color="fg.muted">
            Commits take turns on one runner, sample by sample, so runner drift affects them equally.
          </Text>
        </Stack>
        <HStack justify="space-between" gap="md" wrap="wrap" borderTopWidth="1px" borderColor="border.subtle" pt="md">
          <Stack gap="0">
            <Text textStyle="label/S/medium">About {minutes} min</Text>
            <Text textStyle="label/XS" color="fg.muted">
              {value.suites.length * value.platforms.length} parallel jobs, one per suite and platform
            </Text>
          </Stack>
          <Button size="sm" onClick={onStart} disabled={Boolean(problem)} loading={pending}>
            Start run
          </Button>
        </HStack>
        {problem || error ? (
          <Text textStyle="label/S/regular" color={error ? "fg.error" : "fg.muted"}>
            {error ?? problem}
          </Text>
        ) : null}
      </SimpleCardBody>
    </SimpleCard>
  );
};
