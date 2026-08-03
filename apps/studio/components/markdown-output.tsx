"use client";

import { motion } from "framer-motion";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MarkdownOutputProps {
  readonly content: string;
  readonly className?: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-1 text-[1.35rem] font-semibold tracking-tight text-white">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-base font-semibold tracking-tight text-white">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-sm font-semibold text-white/92">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 text-[13.5px] leading-7 text-white/72">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-white/80">{children}</em>,
  a: ({ href, children }) => (
    <a
      className="text-[#ff4fd8] underline decoration-[#ff4fd8]/35 underline-offset-2 transition hover:decoration-[#ff4fd8]"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[13.5px] leading-6 text-white/72">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-6 text-white/72">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="marker:text-white/35">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-[#ff4fd8]/50 bg-white/[.02] py-1 pl-4 text-[13.5px] text-white/65">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-white/[.08]" />,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-xl border border-white/[.08]">
      <table className="w-full min-w-[420px] border-collapse text-left text-[12.5px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[.03] text-white/55">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-white/[.08] px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/[.06] px-3 py-2 text-white/70">{children}</td>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (!isBlock) {
      return (
        <code
          className="rounded-md border border-white/[.08] bg-white/[.05] px-1.5 py-0.5 font-mono text-[12px] text-[#ff7adf]"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code className={`${className} font-mono text-[12.5px] leading-6`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-xl border border-white/[.08] bg-[#08080a] p-4 text-white/82">
      {children}
    </pre>
  ),
  input: ({ checked, ...props }) => (
    <input
      checked={checked}
      className="mr-2 translate-y-[1px] accent-[#ff4fd8]"
      disabled
      type="checkbox"
      {...props}
    />
  ),
};

export function MarkdownOutput({ content, className = "" }: MarkdownOutputProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`markdown-body max-w-none ${className}`}
      initial={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeHighlight]}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </motion.div>
  );
}
