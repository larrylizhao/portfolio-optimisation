"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import type { AssetScore } from "@/lib/optimization/types";

interface SharpeChartProps {
  scores: AssetScore[];
  selectedIsins: string[];
}

export function SharpeChart({ scores, selectedIsins }: SharpeChartProps) {
  const selectedSet = new Set(selectedIsins);
  const sorted = [...scores].sort((a, b) => b.adjustedScore - a.adjustedScore);

  const data = sorted.map((s) => ({
    name: s.name.length > 15 ? s.name.slice(0, 13) + "…" : s.name,
    fullName: s.name,
    adjustedScore: parseFloat(s.adjustedScore.toFixed(3)),
    sharpe: parseFloat(s.sharpe.toFixed(3)),
    confidence: parseFloat((s.confidence * 100).toFixed(0)),
    selected: selectedSet.has(s.isin),
  }));

  const lastSelectedIdx = data.findLastIndex((d) => d.selected);
  const cutoffScore =
    lastSelectedIdx >= 0 && lastSelectedIdx < data.length - 1
      ? (data[lastSelectedIdx].adjustedScore + data[lastSelectedIdx + 1].adjustedScore) / 2
      : 0;

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" label={{ value: "Adjusted Sharpe Score", position: "bottom", offset: -5 }} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value, _name, props) => {
            const p = props.payload as { fullName: string; confidence: number; sharpe: number };
            return [`Score: ${value} (Sharpe: ${p.sharpe}, Confidence: ${p.confidence}%)`, p.fullName];
          }}
        />
        {cutoffScore > 0 && (
          <ReferenceLine x={cutoffScore} stroke="#DC2626" strokeDasharray="5 5" label={{ value: "Selection cutoff", position: "top", fill: "#DC2626", fontSize: 11 }} />
        )}
        <Bar dataKey="adjustedScore" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.selected ? "var(--color-antarctica-navy)" : "#CBD5E1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
