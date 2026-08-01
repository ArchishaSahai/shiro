"use client";

import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioRunTrace } from "@/lib/trace-utils";

type StudioNode = Node<{ readonly label: string }>;

interface ExecutionGraphProps {
  readonly trace: StudioRunTrace;
  readonly onSelectTool: (toolName: string) => void;
}

export function ExecutionGraph({ onSelectTool, trace }: ExecutionGraphProps) {
  const nodes = createNodes(trace);
  const edges = createEdges(trace);

  return (
    <Card className="min-h-[420px]">
      <CardHeader>
        <CardTitle>Execution Graph</CardTitle>
      </CardHeader>
      <CardContent className="h-[360px] p-0">
        <ReactFlow
          edges={edges}
          fitView
          nodes={nodes}
          onNodeClick={(_, node) => {
            const label = getNodeLabel(node);

            if (node.type === "tool" && label !== undefined) {
              onSelectTool(label);
            }
          }}
        >
          <Background color="#d4d4d8" gap={24} />
          <Controls />
        </ReactFlow>
      </CardContent>
    </Card>
  );
}

function createNodes(trace: StudioRunTrace): StudioNode[] {
  const agentNodes = [
    trace.agentName ?? "Agent",
    ...trace.handoffs.map((handoff) => handoff.destinationAgent),
  ];
  const uniqueAgents = [...new Set(agentNodes)];
  const toolNodes = trace.toolExecutions.map((tool) => tool.toolName);

  return [
    ...uniqueAgents.map((agent, index) => ({
      data: { label: agent },
      id: `agent:${agent}`,
      position: { x: index * 220, y: 40 },
      style: nodeStyle("agent"),
      type: "default",
    })),
    ...toolNodes.map((tool, index) => ({
      data: { label: tool },
      id: `tool:${tool}`,
      position: { x: 120 + index * 220, y: 190 },
      style: nodeStyle("tool"),
      type: "tool",
    })),
  ];
}

function createEdges(trace: StudioRunTrace): Edge[] {
  const edges: Edge[] = [];
  const root: string = trace.agentName ?? "Agent";

  for (const handoff of trace.handoffs) {
    edges.push({
      id: `handoff:${handoff.sourceAgent}:${handoff.destinationAgent}`,
      source: `agent:${handoff.sourceAgent}`,
      target: `agent:${handoff.destinationAgent}`,
    });
  }

  for (const tool of trace.toolExecutions) {
    edges.push({
      id: `tool:${tool.toolName}`,
      source: `agent:${root}`,
      target: `tool:${tool.toolName}`,
    });
  }

  return edges;
}

function nodeStyle(kind: "agent" | "tool") {
  return {
    background: kind === "agent" ? "#050505" : "#fff",
    border: "1px solid #050505",
    borderRadius: 8,
    color: kind === "agent" ? "#fff" : "#050505",
    fontSize: 12,
    padding: 12,
  };
}

function getNodeLabel(node: Node): string | undefined {
  const data = node.data as Readonly<Record<string, unknown>>;
  return typeof data.label === "string" ? data.label : undefined;
}
