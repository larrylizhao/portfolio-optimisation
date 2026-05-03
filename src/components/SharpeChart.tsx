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
    // User Feedback: Increase truncation limit for better legibility (15 -> 25)
    name: s.name.length > 25 ? s.name.slice(0, 23) + "…" : s.name,
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
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 font-sans h-full flex flex-col">
      {/* Header Section */}
      <div className="bg-[#002D54] p-6 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-3">
          {/* User Feedback: Icon centering fix (flex + items-center + justify-center) */}
          <div className="bg-white/20 w-9 h-9 flex items-center justify-center rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Asset Ranking by Risk-Adjusted Return</h2>
        </div>
      </div>

      <div className="p-6 flex-grow">
        <div className="relative w-full h-[400px]">
          {/* Screen Reader Only Table */}
          <table className="sr-only">
            <caption>Risk-Adjusted Return Scores for Assets</caption>
            <thead>
              <tr>
                <th scope="col">Asset Name</th>
                <th scope="col">Adjusted Score</th>
                <th scope="col">Selected</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i}>
                  <td>{d.fullName}</td>
                  <td>{d.adjustedScore}</td>
                  <td>{d.selected ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Visual Chart */}
          <ResponsiveContainer width="100%" height="100%" aria-hidden="true">
            {/* User Feedback: Widened left margin (120 -> 160) to fit asset names */}
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" label={{ value: "Adjusted Sharpe Score", position: "bottom", offset: 10 }} />
              {/* User Feedback: Widened YAxis width (110 -> 150) */}
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
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
        </div>
      </div>
    </div>
  );
}
