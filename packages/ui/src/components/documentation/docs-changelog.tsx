import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Image,
  Link,
  List,
  Stack,
  type StackProps,
  Text,
  Timeline,
} from "@chakra-ui/react";

export interface DocsChangelogChange {
  title: string;
  description?: string;
  link?: string;
}

export interface DocsChangelogEntry {
  version: string;
  date: string;
  tags?: string[];
  title: string;
  image?: string;
  description?: string;
  changes?: DocsChangelogChange[];
}

export interface DocsChangelogProps {
  entries: DocsChangelogEntry[];
  title: string;
  description?: string;
}

interface ChangelogDateProps extends StackProps {
  date: string;
  version: string;
}

const getEntryKey = (entry: DocsChangelogEntry, index: number) => {
  return `${entry.version}-${entry.date}-${index}`;
};

const getChangeKey = (change: DocsChangelogChange, index: number) => {
  return `${change.title}-${index}`;
};

const ChangelogDate = (props: ChangelogDateProps) => {
  const { date, version, ...rest } = props;

  return (
    <Stack {...rest}>
      <Timeline.Title textStyle="sm" color="fg.muted">
        {date}
      </Timeline.Title>
      <Flex
        px="3"
        py="2"
        rounded="l3"
        align="center"
        justify="center"
        borderWidth="1px"
        textAlign="center"
        alignSelf="flex-start"
      >
        <Timeline.Title textStyle="md" fontWeight="semibold">
          {version}
        </Timeline.Title>
      </Flex>
    </Stack>
  );
};

export const DocsChangelog = (props: DocsChangelogProps) => {
  const { entries, title, description } = props;

  return (
    <Stack gap="20">
      <Stack textAlign="center">
        <Heading size="4xl">{title}</Heading>
        {description ? (
          <Text color="fg.muted" textStyle="lg">
            {description}
          </Text>
        ) : null}
      </Stack>

      <Box position="relative">
        <Timeline.Root size="sm" variant="solid">
          {entries.map((entry, entryIndex) => (
            <Timeline.Item key={getEntryKey(entry, entryIndex)}>
              <Timeline.Content
                top="6"
                width="48"
                flexShrink="0"
                hideBelow="md"
                position={{ base: "static", md: "sticky" }}
              >
                <ChangelogDate hideBelow="md" date={entry.date} version={entry.version} />
              </Timeline.Content>

              <Timeline.Connector>
                <Timeline.Separator />
                <Timeline.Indicator />
              </Timeline.Connector>

              <Timeline.Content>
                <Stack gap="4">
                  <ChangelogDate hideFrom="md" date={entry.date} version={entry.version} />

                  <Stack gap="2">
                    <Timeline.Title fontSize="lg" fontWeight="medium">
                      {entry.title}
                    </Timeline.Title>
                    {entry.description ? (
                      <Text color="fg.muted" textStyle="sm">
                        {entry.description}
                      </Text>
                    ) : null}
                  </Stack>

                  {entry.tags && entry.tags.length > 0 ? (
                    <HStack>
                      {entry.tags.map((tag) => (
                        <Badge
                          key={tag}
                          size="md"
                          rounded="l2"
                          variant="subtle"
                          colorPalette="gray"
                          textTransform="capitalize"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </HStack>
                  ) : null}

                  {entry.image ? <Image rounded="l2" src={entry.image} alt={entry.title} /> : null}

                  {entry.changes && entry.changes.length > 0 ? (
                    <List.Root pl="4" gap="4">
                      {entry.changes.map((change, changeIndex) => (
                        <List.Item key={getChangeKey(change, changeIndex)}>
                          <Stack gap="1">
                            <Text color="fg.muted" fontWeight="normal" textStyle="sm">
                              {change.title}
                            </Text>
                            {change.description ? (
                              <Text color="fg.subtle" textStyle="xs">
                                {change.description}
                              </Text>
                            ) : null}
                            {change.link ? (
                              <Link href={change.link} textStyle="xs" width="fit-content">
                                Learn more
                              </Link>
                            ) : null}
                          </Stack>
                        </List.Item>
                      ))}
                    </List.Root>
                  ) : null}
                </Stack>
              </Timeline.Content>
            </Timeline.Item>
          ))}
        </Timeline.Root>
      </Box>
    </Stack>
  );
};
