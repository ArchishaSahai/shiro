import { getMDXComponents } from "@/mdx-components";
import { source } from "@/lib/source";
import { DocsShell } from "@/components/docs-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface PageProps {
  readonly params: Promise<{
    readonly slug?: string[];
  }>;
}

export function generateStaticParams(): { readonly slug?: string[] }[] {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (page === undefined) {
    return {};
  }

  return {
    description: page.data.description,
    title: page.data.title,
  };
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (page === undefined) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsShell description={page.data.description} title={page.data.title} toc={page.data.toc}>
      <div className="prose">
        <MDX components={getMDXComponents()} />
      </div>
    </DocsShell>
  );
}
