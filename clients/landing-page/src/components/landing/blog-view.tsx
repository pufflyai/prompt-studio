import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, TreeList } from "@pstdio/ui";
import { BLOG_POSTS, VISIBLE_BLOG_POSTS } from "./content/blog";
import { DocView } from "./doc-view";

interface BlogViewProps {
  activePostId?: string;
  postListOpen: boolean;
  onPostListOpenChange: (open: boolean) => void;
  onSelectPost: (postId: string) => void;
}

interface PostListProps {
  activePostId: string;
  onSelectPost: (postId: string) => void;
}

const PostList = (props: PostListProps) => {
  const { activePostId, onSelectPost } = props;

  return (
    <Stack
      width="full"
      height="full"
      gap="0"
      py="8px"
      bg="bg.subtle"
      borderRightWidth="1px"
      borderColor="border.subtle"
      overflowY="auto"
    >
      <HStack height="28px" px="10px">
        <Text textStyle="label/XS" textTransform="uppercase" color="fg.muted" letterSpacing="0.08em">
          Posts
        </Text>
      </HStack>
      <TreeList
        sections={[
          {
            id: "posts",
            nodes: VISIBLE_BLOG_POSTS.map((post) => ({
              id: post.id,
              label: post.title,
              isNavigable: true,
            })),
          },
        ]}
        rowVariant="compact"
        activeNodeId={activePostId}
        onNavigate={(event) => onSelectPost(event.nodeId)}
      />
    </Stack>
  );
};

const PostContent = (props: { page: (typeof BLOG_POSTS)[number]["page"] }) => {
  const { page } = props;

  return (
    <Box width="full" height="full" minWidth="0" overflowY="auto">
      <Flex justify="center">
        <DocView page={page} />
      </Flex>
    </Box>
  );
};

export const BlogView = (props: BlogViewProps) => {
  const { activePostId = VISIBLE_BLOG_POSTS[0].id, postListOpen, onPostListOpenChange, onSelectPost } = props;
  const activePost = BLOG_POSTS.find((post) => post.id === activePostId) ?? VISIBLE_BLOG_POSTS[0];

  return (
    <Box height="full">
      <Box height="full" display={{ base: "none", md: "block" }}>
        <ResizableSplitLayout
          collapsed={!postListOpen}
          defaultSizePx={264}
          minSizePx={220}
          maxSizePx={420}
          contentMinSizePx={320}
          resizeLabel="Resize post list"
          showResizeSeparator
          onCollapsedChange={(collapsed) => onPostListOpenChange(!collapsed)}
          resizablePanel={<PostList activePostId={activePostId} onSelectPost={onSelectPost} />}
          contentPanel={<PostContent page={activePost.page} />}
        />
      </Box>
      <Box height="full" display={{ base: "block", md: "none" }}>
        <PostContent page={activePost.page} />
      </Box>
    </Box>
  );
};
