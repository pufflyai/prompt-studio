import { Box, Button, Fieldset, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { Checkbox, Chip, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { X } from "lucide-react";
import { JOB_LIMIT_MINUTES, PLATFORMS, platformLabel, runsOn, SUITES, type SuiteOption } from "../benchmarks/platforms";
import { CopySha } from "../webview/copy-sha";
import { type RefOption, RefInput } from "./ref-input";

export interface RunRequest {
  commits: string[];
  suites: string[];
  platforms: string[];
}

interface RunFormProps {
  value: RunRequest;
  // Tags and known commits. Measured ones already have results and are not run again.
  refs: RefOption[];
  pending: boolean;
  error?: string;
  onChange: (value: RunRequest) => void;
  // Receives only what CI will run: new commits and the suites the chosen platforms support.
  onStart: (request: RunRequest) => void;
}

const toggle = (list: string[], item: string) =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

// A suite limited to some platforms runs only on those, so the form never promises a job CI will skip.
const available = (suite: SuiteOption, platforms: string[]) => platforms.some((platform) => runsOn(suite, platform));

// Suites run as parallel jobs, so the slowest chosen suite sets the length. Each new commit builds once first.
export const estimateMinutes = (request: RunRequest) => {
  const chosen = SUITES.filter((suite) => request.suites.includes(suite.id));
  const slowest = Math.max(0, ...chosen.map((suite) => suite.minutes));
  return request.commits.length * (10 + slowest);
};

const problemOf = (request: RunRequest, reused: number) => {
  if (!request.commits.length)
    return reused ? "Every commit already has results. Compare them instead." : "Add at least one commit.";
  if (!request.suites.length) return "Pick at least one suite.";
  if (!request.platforms.length) return "Pick at least one platform.";
  return undefined;
};

export const RunForm = (props: RunFormProps) => {
  const { value, refs, pending, error, onChange, onStart } = props;
  // A typed SHA matches its commit by prefix, so a pushed commit is recognized however it was entered.
  const find = (ref: string) =>
    refs.find((option) => option.ref === ref || (ref.length >= 7 && option.sha.startsWith(ref)));
  const measured = (ref: string) => Boolean(find(ref)?.measured);
  const fresh = value.commits.filter((ref) => !measured(ref));
  const reused = value.commits.length - fresh.length;
  const chosen = SUITES.filter((suite) => value.suites.includes(suite.id) && available(suite, value.platforms));
  const problem = problemOf({ ...value, commits: fresh, suites: chosen.map((suite) => suite.id) }, reused);
  const minutes = estimateMinutes({ ...value, commits: fresh });
  const jobs = fresh.length
    ? chosen.reduce((count, suite) => count + value.platforms.filter((platform) => runsOn(suite, platform)).length, 0)
    : 0;
  const skipped = chosen.flatMap((suite) => {
    const missing = value.platforms.filter((platform) => !runsOn(suite, platform));
    return missing.length ? [`${suite.label} skips ${missing.map(platformLabel).join(", ")}: ${suite.reason}`] : [];
  });
  const addCommit = (ref: string) => {
    if (!value.commits.includes(ref)) onChange({ ...value, commits: [...value.commits, ref] });
  };
  return (
    <SimpleCard>
      <SimpleCardBody display="flex" flexDirection="column" gap="lg">
        <Text textStyle="heading/S">New run</Text>
        <Stack gap="xs">
          <Text textStyle="label/S/regular" color="fg.muted">
            Commits, branches, or tags
          </Text>
          {value.commits.map((ref) => {
            const known = find(ref);
            return (
              <HStack key={ref} gap="sm" bg="bg.subtle" borderRadius="xs" px="sm" py="2xs">
                <Text textStyle="mono/XS" truncate>
                  {ref}
                </Text>
                {known && known.sha !== ref ? <CopySha sha={known.sha} /> : null}
                <Box flex="1" />
                {measured(ref) ? <Chip>Measured</Chip> : null}
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label={`Remove ${ref}`}
                  onClick={() => onChange({ ...value, commits: value.commits.filter((entry) => entry !== ref) })}
                >
                  <X />
                </IconButton>
              </HStack>
            );
          })}
          <RefInput
            options={refs.filter((option) => option.ref === "main" || option.ref.startsWith("pstdio@"))}
            chosen={value.commits}
            onAdd={addCommit}
          />
        </Stack>
        <Fieldset.Root>
          <Fieldset.Legend textStyle="label/S/regular" color="fg.muted">
            Suites
          </Fieldset.Legend>
          <Stack gap="xs" pt="xs">
            {SUITES.map((suite) => {
              const disabled = !available(suite, value.platforms);
              return (
                <Checkbox
                  key={suite.id}
                  disabled={disabled}
                  checked={!disabled && value.suites.includes(suite.id)}
                  onCheckedChange={() => onChange({ ...value, suites: toggle(value.suites, suite.id) })}
                >
                  <Stack gap="0">
                    <Text textStyle="label/S/regular">{suite.label}</Text>
                    {disabled ? (
                      <Text textStyle="label/XS" color="fg.muted">
                        {suite.reason}
                      </Text>
                    ) : null}
                  </Stack>
                </Checkbox>
              );
            })}
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
        {skipped.length ? (
          <Stack gap="2xs">
            {skipped.map((line) => (
              <Text key={line} textStyle="label/XS" color="fg.muted">
                {line}
              </Text>
            ))}
          </Stack>
        ) : null}
        <HStack justify="space-between" gap="md" wrap="wrap" borderTopWidth="1px" borderColor="border.subtle" pt="md">
          <Stack gap="0">
            <Text textStyle="label/S/medium" color={minutes > JOB_LIMIT_MINUTES ? "fg.warning" : undefined}>
              {minutes > JOB_LIMIT_MINUTES
                ? `About ${minutes} min, over the ${JOB_LIMIT_MINUTES}-minute job limit`
                : `About ${minutes} min`}
            </Text>
            <Text textStyle="label/XS" color="fg.muted">
              {jobs} parallel jobs · each benchmark runs once
              {reused
                ? ` · ${reused} measured ${reused > 1 ? "commits reuse their" : "commit reuses its"} results`
                : ""}
            </Text>
          </Stack>
          <Button size="sm" variant="primary" onClick={() => onStart({ ...value, commits: fresh, suites: chosen.map((suite) => suite.id) })} disabled={Boolean(problem)} loading={pending}>
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
