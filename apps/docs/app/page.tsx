"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  Braces,
  GitBranch,
  Layers3,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CopyCommand } from "@/components/copy-command";
import { GitHubIcon } from "@/components/github-icon";
import { InteractiveDemo } from "@/components/interactive-demo";
import { TerminalReplay, type TerminalLine } from "@/components/terminal-replay";
import { GITHUB_REPO_URL } from "@/lib/site";

const navItems = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/quick-start", label: "Guides" },
  { href: "/docs/api-reference", label: "API Reference" },
  { href: "/docs/examples", label: "Examples" },
] as const;

const runLines: readonly TerminalLine[] = [
  { kind: "command", text: "$ await engine.execute(agent, 'Refund request for invoice_4192')" },
  { kind: "pink", text: "run.started" },
  { kind: "event", text: "provider.call agent='support' model='gpt-5'" },
  { kind: "purple", text: "handoff.started support -> billing" },
  { kind: "event", text: "tool.execute refund.lookup" },
  { kind: "warning", text: "approval.required refund.issue" },
  { kind: "event", text: "memory.store session_1842" },
  { kind: "success", text: "response.completed trace synced to Studio" },
];

const architectureSteps = [
  {
    code: "input.withSession()",
    description: "Prompt plus durable session context enters the runtime.",
    icon: SquareTerminal,
    title: "User Input",
  },
  {
    code: "agent.plan()",
    description: "Instructions, model, tools, memory, and policy are resolved for this run.",
    icon: Bot,
    title: "Triage Agent",
  },
  {
    code: "handoff.to()",
    description: "Specialist agents receive control without a second orchestration layer.",
    icon: GitBranch,
    title: "Agent Handoff",
  },
  {
    code: "approval.request()",
    description: "Risky actions pause with explicit human review events.",
    icon: ShieldCheck,
    title: "Policy Guardrail",
  },
  {
    code: "trace.stream()",
    description: "Studio receives the same events your application consumes.",
    icon: Activity,
    title: "Streamed Trace",
  },
] as const;

const productionFeatures = [
  {
    code: "provider.use(openai(), anthropic(), custom())",
    description: "Keep provider code behind one small interface.",
    icon: Layers3,
    title: "Provider Adapters",
  },
  {
    code: "requiresApproval: true",
    description: "Pause specific tools until a reviewer approves the action.",
    icon: LockKeyhole,
    title: "Approval Gates",
  },
  {
    code: "session.getMessages()",
    description: "Attach durable context without mutating agent definitions.",
    icon: Brain,
    title: "Memory Sessions",
  },
  {
    code: "output: z.object({ ... })",
    description: "Validate final answers before they leave the run.",
    icon: Braces,
    title: "Structured Outputs",
  },
  {
    code: "result.trace.steps",
    description: "Persist model calls, tools, handoffs, approvals, and timing.",
    icon: Activity,
    title: "Full Tracing",
  },
  {
    code: "studio.open(run.id)",
    description: "Use Studio to inspect runs while you build and debug.",
    icon: Sparkles,
    title: "Studio UI",
  },
] as const;

const metrics = [
  { label: "runtime dependency", suffix: "", value: 1 },
  { label: "typed SDK surface", suffix: "%", value: 100 },
  { label: "core execution layers", suffix: "", value: 7 },
  { label: "Studio workspaces", suffix: "", value: 1 },
] as const;

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050506] text-white">
      <BackgroundField />
      <SiteNav />
      <Hero />
      <InteractiveDemo />
      <LiveRun />
      <ArchitecturePanel />
      <ProductionGrid />
      <MetricStrip />
      <ProviderSection />
      <StudioSection />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#07070A]/92 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-5">
        <Link
          className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white"
          href="/"
        >
          Shiro
        </Link>
        <div className="hidden items-center gap-9 md:flex">
          {navItems.map((item) => (
            <Link
              className="text-sm font-medium text-white/52 transition hover:text-white"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
          <a
            className="text-sm font-medium text-white/52 transition hover:text-white"
            href={GITHUB_REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a
            aria-label="Shiro on GitHub"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[.10] bg-white/[.035] text-white/48 transition hover:border-[#ff4fd8]/35 hover:bg-white/[.05] hover:text-white hover:shadow-[0_0_24px_rgba(255,79,216,.08)]"
            href={GITHUB_REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon className="h-4 w-4" />
          </a>
          <div className="hidden h-10 min-w-72 items-center justify-between rounded-full border border-white/[.10] bg-white/[.035] px-4 text-white/42 lg:flex">
            <span className="flex items-center gap-2">
              <Search aria-hidden="true" className="h-4 w-4" />
              Search
            </span>
            <span className="font-mono text-xs">Ctrl K</span>
          </div>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[760px] max-w-[1320px] flex-col items-center justify-center px-5 py-16 text-center">
      <motion.div
        animate="show"
        initial="hidden"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
      >
        <HeroItem>
          <h1 className="mx-auto max-w-5xl text-4xl font-semibold leading-[1] tracking-tight text-white sm:text-6xl lg:text-[76px]">
            A runtime for agents you can inspect.
          </h1>
        </HeroItem>
        <HeroItem>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/54 sm:text-xl">
            Shiro gives TypeScript agents a real execution model: provider calls, tools, handoffs,
            approvals, memory, and traces all move through the same run.
          </p>
        </HeroItem>
        <HeroItem>
          <div className="mx-auto mt-8 max-w-md">
            <CopyCommand command="pnpm add @shiro-sdk/core @shiro-sdk/openai zod" />
          </div>
        </HeroItem>
        <HeroItem>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              className="shiro-button shiro-button-primary h-14 px-8 text-base"
              href="/docs/quick-start"
            >
              Start building
            </Link>
            <Link className="shiro-button h-14 px-8 text-base" href="/docs/api-reference">
              API Reference
            </Link>
            <a
              className="shiro-button h-14 px-8 text-base"
              href={GITHUB_REPO_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <GitHubIcon className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </HeroItem>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 w-full max-w-5xl"
        initial={{ opacity: 0, y: 30 }}
        transition={{ delay: 0.7, duration: 0.65, ease: "easeOut" }}
      >
        <TerminalReplay showReplay title="live shiro run" />
      </motion.div>
    </section>
  );
}

function HeroItem({ children }: { readonly children: ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
      }}
    >
      {children}
    </motion.div>
  );
}

function LiveRun() {
  return (
    <RevealSection className="mx-auto max-w-7xl px-5 py-18 text-center">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#ff4fd8]">
        Execution stream
      </p>
      <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        The log is part of the product.
      </h2>
      <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-white/52">
        Shiro exposes the run as structured events, so application code and Studio see the same
        provider calls, tool spans, handoffs, and approval waits.
      </p>
      <div className="mx-auto mt-10 max-w-6xl text-left">
        <TerminalReplay lines={runLines} showReplay title="agent.stream()" />
      </div>
    </RevealSection>
  );
}

function ArchitecturePanel() {
  const [active, setActive] = useState(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((value) => (value + 1) % architectureSteps.length);
    }, 1400);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const step = architectureSteps[active] ?? architectureSteps[0];

  return (
    <RevealSection className="mx-auto max-w-[1320px] px-5 py-18">
      <div className="rounded-[1.75rem] border border-white/[.10] bg-[#08080B] p-6 shadow-[0_0_0_1px_rgba(255,255,255,.025),0_26px_92px_rgba(255,79,216,.11),0_18px_60px_rgba(0,0,0,.32)]">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-white/[.08] pb-6">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
              Run pipeline
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              One run, visible from input to output.
            </h2>
          </div>
          <p className="flex items-center gap-2 font-mono text-xs text-white/46">
            <span className="h-2 w-2 rounded-full bg-[#ff4fd8]" />
            event stream active
          </p>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-5">
          {architectureSteps.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                className={`rounded-xl border p-4 text-left transition ${
                  active === index
                    ? "border-[#ff4fd8]/38 bg-white/[.065] shadow-[0_0_26px_rgba(255,79,216,.10)]"
                    : "border-white/[.08] bg-black/30 hover:border-white/[.16]"
                }`}
                key={item.title}
                onClick={() => {
                  setActive(index);
                }}
                type="button"
              >
                <Icon
                  aria-hidden="true"
                  className={active === index ? "h-4 w-4 text-[#ff4fd8]" : "h-4 w-4 text-white/42"}
                />
                <h3 className="mt-4 font-mono text-xs font-semibold text-white/80">
                  {index + 1}. {item.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-white/42">{item.description}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[.72fr_1.28fr]">
          <div className="rounded-xl border border-white/[.09] bg-black/30 p-5">
            <p className="inline-flex items-center gap-2 rounded-md border border-white/[.10] bg-white/[.035] px-2.5 py-1 font-mono text-xs text-white/55">
              <CheckDot />
              active: {step.title}
            </p>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-3 text-base leading-7 text-white/52">{step.description}</p>
            <div className="mt-6 border-t border-white/[.08] pt-4">
              <p className="font-mono text-xs text-white/42">
                Step {active + 1} of {architectureSteps.length}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/[.09] bg-black/30 p-5 font-mono text-sm leading-7">
            <div className="flex justify-between border-b border-white/[.08] pb-4 text-white/42">
              <span>agent-flow-trace.ts</span>
              <span>TypeScript</span>
            </div>
            <pre className="mt-6 whitespace-pre-wrap text-white/76">
              {`// ${step.title}
const result = await engine.execute(agent, input);
traces.on("${step.code}", event => studio.record(event));
await traces.export(new JsonTraceExporter());`}
            </pre>
          </div>
        </div>
      </div>
    </RevealSection>
  );
}

function ProductionGrid() {
  return (
    <RevealSection className="mx-auto max-w-[1320px] px-5 py-18">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
          Runtime features
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          The parts you need when agents leave the demo.
        </h2>
        <p className="mt-4 text-lg leading-8 text-white/52">
          Shiro keeps operational concerns in the runtime instead of scattering them across app
          code.
        </p>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-6">
        {productionFeatures.map((feature, index) => {
          const Icon = feature.icon;
          const wide = index < 2;
          return (
            <motion.article
              className={`shiro-card p-5 ${wide ? "lg:col-span-3" : "lg:col-span-2"}`}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              key={feature.title}
              transition={{ delay: index * 0.07, duration: 0.38 }}
              viewport={{ once: true, amount: 0.25 }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[.10] bg-white/[.035] text-white/76">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">{feature.description}</p>
              <code className="mt-5 block rounded-lg border border-white/[.08] bg-black/35 px-3 py-3 font-mono text-xs text-white/62">
                {feature.code}
              </code>
            </motion.article>
          );
        })}
      </div>
    </RevealSection>
  );
}

function MetricStrip() {
  return (
    <RevealSection className="mx-auto max-w-[1240px] px-5 py-14">
      <div className="grid rounded-[1.5rem] border border-white/[.10] bg-[#08080B] p-5 shadow-[0_24px_88px_rgba(255,79,216,.10),0_18px_55px_rgba(0,0,0,.30)] md:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            className="border-white/[.09] py-4 text-center md:border-r md:last:border-r-0"
            key={metric.label}
          >
            <CountUp suffix={metric.suffix} value={metric.value} />
            <p className="mt-3 font-mono text-xs font-semibold text-white/70">{metric.label}</p>
            <p className="mt-2 text-sm text-white/38">
              {index === 0
                ? "Zod core only"
                : index === 1
                  ? "Strict TypeScript inference"
                  : index === 2
                    ? "Visible pipeline"
                    : "Local product UI"}
            </p>
          </div>
        ))}
      </div>
    </RevealSection>
  );
}

function ProviderSection() {
  return (
    <RevealSection className="mx-auto max-w-5xl px-5 py-18 text-center">
      <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Providers are adapters, not architecture.
      </h2>
      <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-white/52">
        The engine depends on Shiro’s provider contract. Use `@shiro-sdk/openai` today, or implement
        the same interface for another model without changing agent code.
      </p>
      <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-white/[.09] bg-black/30 p-4 text-left font-mono text-sm leading-7 text-white/64">
        <span className="text-white">provider.call</span> uses the same trace shape no matter which
        model adapter fulfills the request.
      </div>
    </RevealSection>
  );
}

function StudioSection() {
  return (
    <RevealSection className="mx-auto grid max-w-[1240px] gap-6 px-5 py-18 lg:grid-cols-[.9fr_1.1fr]">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#ff4fd8]">
          Shiro Studio
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Studio is where runs become debuggable.
        </h2>
        <p className="mt-4 text-lg leading-8 text-white/52">
          Inspect a timeline, open an approval, follow a handoff, and compare memory state without
          adding one-off debug screens to your app.
        </p>
        <Link className="shiro-button mt-6 h-11 px-5" href="/docs/tracing">
          Explore tracing
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      <div className="rounded-[1.5rem] border border-white/[.10] bg-[#08080B] p-4 shadow-[0_24px_88px_rgba(255,79,216,.11),0_18px_55px_rgba(0,0,0,.30)]">
        <div className="grid gap-3 sm:grid-cols-2">
          {["Trace Viewer", "Approval Center", "Memory Sessions", "Execution Graph"].map(
            (item, index) => (
              <motion.div
                className="rounded-xl border border-white/[.08] bg-black/35 p-4"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                key={item}
                transition={{ delay: index * 0.08, duration: 0.3 }}
                viewport={{ once: true }}
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="font-mono text-sm text-white/50">{item}</span>
                  <span className="h-2 w-2 rounded-full bg-[#ff4fd8]" />
                </div>
                <div className="space-y-2">
                  <span className="block h-2 rounded-full bg-white/[.13]" />
                  <span className="block h-2 w-2/3 rounded-full bg-white/[.22]" />
                  <span className="block h-2 w-4/5 rounded-full bg-white/[.09]" />
                </div>
              </motion.div>
            )
          )}
        </div>
      </div>
    </RevealSection>
  );
}

function FinalCta() {
  return (
    <RevealSection className="mx-auto max-w-3xl px-5 py-20 text-center">
      <div className="rounded-[1.5rem] border border-white/[.10] bg-[#0A0A0D] px-6 py-10 shadow-[0_24px_90px_rgba(255,79,216,.11),0_18px_55px_rgba(0,0,0,.30)]">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Start with a single run.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/50">
          Add a provider, define one tool, and stream the trace before you build the surrounding
          app.
        </p>
        <div className="mx-auto mt-6 max-w-md">
          <CopyCommand command="pnpm add @shiro-sdk/core @shiro-sdk/openai zod" />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="shiro-button h-12 px-6" href="/docs/quick-start">
            Quick start
          </Link>
          <Link className="shiro-button h-12 px-6" href="/docs/api-reference">
            API Reference
          </Link>
          <a
            className="shiro-button h-12 px-6"
            href={GITHUB_REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </div>
    </RevealSection>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/[.08] px-5 py-14">
      <div className="mx-auto grid max-w-[1240px] gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3 text-lg font-semibold">Shiro</div>
          <p className="mt-4 max-w-xs text-white/45">
            A TypeScript runtime for inspectable agent execution.
          </p>
          <a
            className="mt-4 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
            href={GITHUB_REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </a>
        </div>
        {(
          [
            [
              "Docs",
              [
                { href: "/docs", label: "Introduction" },
                { href: "/docs/installation", label: "Installation" },
                { href: "/docs/quick-start", label: "Quick start" },
              ],
            ],
            [
              "Guides",
              [
                { href: "/docs/agents", label: "Agents" },
                { href: "/docs/multi-agent", label: "Handoffs" },
                { href: "/docs/tracing", label: "Tracing" },
              ],
            ],
            [
              "Reference",
              [
                { href: "/docs/api-reference", label: "API Reference" },
                { href: "/docs/examples", label: "Examples" },
                { href: "/docs/studio", label: "Studio" },
              ],
            ],
          ] as const
        ).map(([title, items]) => (
          <div key={title}>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.15em] text-white/48">
              {title}
            </h3>
            <div className="mt-5 grid gap-3">
              {items.map((item) => (
                <Link
                  className="text-white/45 transition hover:text-white"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}

function CountUp({ suffix, value }: { readonly suffix: string; readonly value: number }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 28, stiffness: 80 });
  const rounded = useTransform(spring, (latest) => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      motionValue.set(value);
    }, 160);

    return () => {
      window.clearTimeout(id);
    };
  }, [motionValue, value]);

  useEffect(() => {
    return rounded.on("change", setDisplay);
  }, [rounded]);

  return (
    <span className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
      {display}
      {suffix}
    </span>
  );
}

function RevealSection({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className: string;
}) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 28 }}
      transition={{ duration: 0.58, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.16 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.section>
  );
}

function CheckDot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-[#ff4fd8]" />;
}

function BackgroundField() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-[.12]" />
      <div className="absolute left-1/2 top-0 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-white/[.035] blur-[130px]" />
      <div className="absolute left-[18%] top-[26rem] h-[360px] w-[360px] rounded-full bg-[#ff4fd8]/[.055] blur-[120px]" />
      <div className="absolute right-[12%] top-[58rem] h-[420px] w-[420px] rounded-full bg-[#ff4fd8]/[.045] blur-[140px]" />
    </div>
  );
}
