import type { HeadFC } from "gatsby";
import { MarkdownPage } from "@/components/markdown-page";
import { SEO } from "@/components/seo";
import content from "@/content/terms.md";

const TermsPage = () => <MarkdownPage content={content} />;

export default TermsPage;

export const Head: HeadFC = () => <SEO title="Terms" />;
