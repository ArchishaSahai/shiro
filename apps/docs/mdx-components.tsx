import defaultMdxComponents from "fumadocs-ui/mdx";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { DocsHeading } from "@/components/docs-heading";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...(defaultMdxComponents as MDXComponents),
    ArchitectureDiagram,
    h2: (props) => <DocsHeading as="h2" {...props} />,
    h3: (props) => <DocsHeading as="h3" {...props} />,
    h4: (props) => <DocsHeading as="h4" {...props} />,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
