import { Box, HStack, Link, Separator, Stack, Text } from "@chakra-ui/react";

export interface OpenSourceNotice {
  name: string;
  version?: string;
  license?: string;
  copyright?: string;
  homepageUrl?: string;
  sourceUrl?: string;
  attribution?: string;
}

export interface OpenSourceNoticesScreenProps {
  notices: OpenSourceNotice[];
  title?: string;
  description?: string;
  productName?: string;
  productVersion?: string;
  generatedAt?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const getNoticeKey = (notice: OpenSourceNotice, index: number) => {
  return `${notice.name}-${notice.version ?? "unknown"}-${index}`;
};

const getNoticeTitle = (notice: OpenSourceNotice) => {
  if (!notice.version) return notice.name;

  return `${notice.name} v${notice.version}`;
};

export const OpenSourceNoticesScreen = (props: OpenSourceNoticesScreenProps) => {
  const {
    notices,
    title = "Open Source and Third-Party Notices",
    description = "This product includes software developed by the open source community.",
    productName,
    productVersion,
    generatedAt,
    emptyTitle = "No third-party notices available",
    emptyDescription = "No third-party packages were included in this build.",
  } = props;

  return (
    <Stack width="full" minHeight="100%" background="bg" color="fg" padding={{ base: "md", md: "xl" }} gap="lg">
      <Stack gap="xs">
        <Text textStyle="heading/L">{title}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {description}
        </Text>

        <HStack gap="md" flexWrap="wrap">
          {productName ? (
            <Text textStyle="label/XS" color="fg.muted">
              Product: {productName}
            </Text>
          ) : null}

          {productVersion ? (
            <Text textStyle="label/XS" color="fg.muted">
              Version: {productVersion}
            </Text>
          ) : null}

          <Text textStyle="label/XS" color="fg.muted">
            Packages: {notices.length}
          </Text>

          {generatedAt ? (
            <Text textStyle="label/XS" color="fg.muted">
              Generated: {generatedAt}
            </Text>
          ) : null}
        </HStack>
      </Stack>

      <Separator borderColor="border.muted" />

      {notices.length === 0 ? (
        <Stack borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="lg" gap="xs">
          <Text textStyle="label/L/medium">{emptyTitle}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {emptyDescription}
          </Text>
        </Stack>
      ) : (
        <Stack gap="md">
          {notices.map((notice, index) => (
            <Box
              key={getNoticeKey(notice, index)}
              borderWidth="1px"
              borderColor="border.muted"
              borderRadius="md"
              padding="md"
            >
              <Stack gap="sm">
                <Stack gap="2xs">
                  <Text textStyle="label/L/medium">{getNoticeTitle(notice)}</Text>
                  <Text textStyle="label/S/regular" color="fg.muted">
                    License: {notice.license ?? "Unknown"}
                  </Text>
                </Stack>

                {notice.copyright ? (
                  <Text textStyle="label/S/regular" color="fg.muted">
                    {notice.copyright}
                  </Text>
                ) : null}

                {(notice.homepageUrl || notice.sourceUrl) && (
                  <Stack gap="2xs">
                    {notice.homepageUrl ? (
                      <Link
                        href={notice.homepageUrl}
                        target="_blank"
                        rel="noreferrer"
                        textStyle="label/S/medium"
                        width="fit-content"
                      >
                        Homepage
                      </Link>
                    ) : null}

                    {notice.sourceUrl ? (
                      <Link
                        href={notice.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        textStyle="label/S/medium"
                        width="fit-content"
                      >
                        Source code
                      </Link>
                    ) : null}
                  </Stack>
                )}

                {notice.attribution ? (
                  <Box background="bg.muted" borderRadius="sm" padding="sm">
                    <Text textStyle="label/S/regular" whiteSpace="pre-wrap">
                      {notice.attribution}
                    </Text>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
