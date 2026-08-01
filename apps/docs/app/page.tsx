import Link from "next/link";

const features = [
  "Agent orchestration",
  "Provider plugins",
  "Tool execution loop",
  "Multi-agent handoffs",
  "Human approval",
  "Memory and sessions",
  "Structured outputs",
  "Tracing and observability",
];

export default function HomePage() {
  return (
    <main className="shiro-grid min-h-screen">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
            Production-ready TypeScript Agent SDK
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-black sm:text-7xl">Shiro</h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-zinc-700">
            Build agents with clean instructions, typed tools, provider plugins, memory, approvals,
            structured outputs, and execution traces.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
              href="/docs"
            >
              Read the docs
            </Link>
            <Link
              className="border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-black transition hover:border-black"
              href="/docs/quick-start"
            >
              Quick start
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div className="bg-white p-5 text-sm font-medium text-zinc-800" key={feature}>
              {feature}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
