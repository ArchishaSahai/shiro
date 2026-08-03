"use client";

import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { motion } from "framer-motion";
import { Boxes, BrainCircuit, Database, KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { StudioRunTrace } from "@/lib/trace-utils";

type GraphNodeKind = "agent" | "provider" | "tool" | "approval" | "memory";
interface StudioNodeData extends Record<string, unknown> {
  readonly kind: GraphNodeKind;
  readonly label: string;
  readonly meta?: string | undefined;
}
type StudioNode = Node<StudioNodeData, "studio">;

const nodeTypes = {
  studio: StudioGraphNode,
};

interface ExecutionGraphProps {
  readonly trace: StudioRunTrace;
  readonly onSelectTool: (toolName: string) => void;
}

export function ExecutionGraph({ onSelectTool, trace }: ExecutionGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodes = useMemo(() => createNodes(trace, selectedNodeId), [selectedNodeId, trace]);
  const edges = useMemo(() => createEdges(trace), [trace]);

  return (
    <Card className="min-h-[460px] overflow-hidden">
      <CardHeader>
        <SectionHeading
          actions={
            <div className="flex gap-2">
              <Badge>{String(nodes.length)} nodes</Badge>
              <Badge>{String(edges.length)} edges</Badge>
            </div>
          }
          description="Visualizes agent flow, provider calls, tools, approvals, memory, and handoffs. Use it to see how the run reached its answer."
          icon={BrainCircuit}
        >
          Execution Graph
        </SectionHeading>
      </CardHeader>
      <CardContent className="bg-black/25 p-0">
        <motion.div
          animate={{ opacity: 1 }}
          className="h-[420px] w-full md:h-[480px]"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <ReactFlow
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.14 }}
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);

              if (node.id.startsWith("tool:")) {
                onSelectTool(node.data.label);
              }
            }}
          >
            <Background color="rgba(255,255,255,.10)" gap={24} />
            <MiniMap
              maskColor="rgb(7 7 7 / 0.72)"
              nodeBorderRadius={12}
              nodeColor={(node) => nodeColor(readNodeKind(node))}
              pannable
              zoomable
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </motion.div>
      </CardContent>
    </Card>
  );
}

function readNodeKind(node: Node): GraphNodeKind {
  const data = node.data as Partial<StudioNodeData>;
  return data.kind ?? "agent";
}

function StudioGraphNode({ data, selected }: NodeProps<StudioNode>) {
  const Icon = iconForKind(data.kind);

  // Status indicators for nodes
  const statusColor = () => {
    if (
      data.meta?.includes("completed") ||
      data.meta?.includes("active") ||
      data.meta?.includes("granted")
    ) {
      return "bg-emerald-400";
    }
    if (data.meta?.includes("failed") || data.meta?.includes("rejected")) {
      return "bg-red-400";
    }
    if (data.meta?.includes("running") || data.meta?.includes("pending")) {
      return "bg-[#ff4fd8] animate-pulse";
    }
    return "bg-white/30";
  };

  return (
    <motion.div
      className={`min-w-44 rounded-xl border bg-[#0b0b0d] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,.5)] transition-all duration-200 ${
        selected
          ? "border-[#ff4fd8] shadow-[0_0_20px_rgba(255,79,216,.15)]"
          : "border-white/[.08] hover:border-white/[.16] hover:shadow-[0_0_18px_rgba(255,79,216,.04)]"
      }`}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${nodeAccent(data.kind)}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <p className="truncate text-xs font-semibold text-white">{data.label}</p>
            <span className={`h-2 w-2 rounded-full shrink-0 ${statusColor()}`} />
          </div>
          <p className="mt-0.5 truncate text-[10px] font-mono capitalize text-white/40">
            {data.meta ?? data.kind}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function createNodes(trace: StudioRunTrace, selectedNodeId: string | null): StudioNode[] {
  const agents = [
    trace.agentName ?? "Manager",
    ...trace.handoffs.flatMap((handoff) => [handoff.sourceAgent, handoff.destinationAgent]),
  ];
  const uniqueAgents = [...new Set(agents)];
  const rowGap = 118;

  return [
    ...uniqueAgents.map((agent, index) =>
      createNode({
        id: `agent:${agent}`,
        kind: "agent",
        label: agent,
        meta: index === 0 ? "active agent" : "handoff agent",
        selected: selectedNodeId === `agent:${agent}`,
        x: index * 220,
        y: 40,
      })
    ),
    ...trace.modelCalls.map((call, index) =>
      createNode({
        id: `provider:${String(index)}`,
        kind: "provider",
        label: call.providerName,
        meta: call.model ?? trace.model ?? "model call",
        selected: selectedNodeId === `provider:${String(index)}`,
        x: index * 220,
        y: 40 + rowGap,
      })
    ),
    ...trace.toolExecutions.map((tool, index) =>
      createNode({
        id: `tool:${tool.toolName}`,
        kind: "tool",
        label: tool.toolName,
        meta: tool.status,
        selected: selectedNodeId === `tool:${tool.toolName}`,
        x: 100 + index * 220,
        y: 40 + rowGap * 2,
      })
    ),
    ...trace.approvals.map((approval, index) =>
      createNode({
        id: `approval:${approval.toolName}:${String(index)}`,
        kind: "approval",
        label: approval.toolName,
        meta: approval.decision ?? "pending approval",
        selected: selectedNodeId === `approval:${approval.toolName}:${String(index)}`,
        x: 200 + index * 220,
        y: 40 + rowGap * 3,
      })
    ),
    ...trace.memory.map((entry, index) =>
      createNode({
        id: `memory:${entry.kind}:${String(index)}`,
        kind: "memory",
        label: entry.kind,
        meta: entry.sessionId ?? trace.sessionId ?? "session",
        selected: selectedNodeId === `memory:${entry.kind}:${String(index)}`,
        x: 300 + index * 190,
        y: 40 + rowGap * 4,
      })
    ),
  ];
}

function createNode({
  id,
  kind,
  label,
  meta,
  selected,
  x,
  y,
}: {
  readonly id: string;
  readonly kind: GraphNodeKind;
  readonly label: string;
  readonly meta?: string;
  readonly selected: boolean;
  readonly x: number;
  readonly y: number;
}): StudioNode {
  return {
    data: { kind, label, meta },
    id,
    position: { x, y },
    selected,
    type: "studio",
  };
}

function createEdges(trace: StudioRunTrace): Edge[] {
  const edges: Edge[] = [];
  const root = `agent:${trace.agentName ?? "Manager"}`;

  for (const [index, call] of trace.modelCalls.entries()) {
    edges.push(createEdge(root, `provider:${String(index)}`, call.model ?? "provider"));
  }

  for (const tool of trace.toolExecutions) {
    edges.push(createEdge(root, `tool:${tool.toolName}`, "tool"));
  }

  for (const handoff of trace.handoffs) {
    edges.push(
      createEdge(`agent:${handoff.sourceAgent}`, `agent:${handoff.destinationAgent}`, "handoff")
    );
  }

  for (const [index, approval] of trace.approvals.entries()) {
    edges.push(
      createEdge(
        `tool:${approval.toolName}`,
        `approval:${approval.toolName}:${String(index)}`,
        "approval"
      )
    );
  }

  for (const [index, memory] of trace.memory.entries()) {
    edges.push(createEdge(root, `memory:${memory.kind}:${String(index)}`, "memory"));
  }

  return edges;
}

function createEdge(source: string, target: string, label: string): Edge {
  return {
    id: `${source}->${target}`,
    animated: true,
    label,
    markerEnd: { type: MarkerType.ArrowClosed },
    source,
    style: {
      filter: "drop-shadow(0 0 6px rgba(255,79,216,.20))",
      stroke: "#ff4fd8",
      strokeWidth: 1.4,
    },
    target,
    type: "smoothstep",
  };
}

function iconForKind(kind: GraphNodeKind) {
  const icons = {
    agent: BrainCircuit,
    approval: ShieldCheck,
    memory: Database,
    provider: KeyRound,
    tool: Boxes,
  };

  return icons[kind];
}

function nodeAccent(kind: GraphNodeKind): string {
  const classes = {
    agent: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
    approval: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
    memory: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
    provider: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
    tool: "bg-white/[.04] text-white/90 ring-1 ring-white/[.08]",
  };

  return classes[kind];
}

function nodeColor(kind: GraphNodeKind): string {
  const colors = {
    agent: "#ff4fd8",
    approval: "#ffffff",
    memory: "#888888",
    provider: "#444444",
    tool: "#ffffff",
  };

  return colors[kind];
}
