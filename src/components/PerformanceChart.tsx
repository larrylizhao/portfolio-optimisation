"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PerformanceChartProps {
  data: { date: string; current: number; recommended: number; benchmark: number | null }[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const hasBenchmark = data.some((d) => d.benchmark !== null);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => {
            const [y, m] = v.split("-");
            return `${m}/${y.slice(2)}`;
          }}
          interval={2}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string | number) => `${Number(v).toFixed(0)}%`}
          label={{ value: "Cumulative Return", angle: -90, position: "insideLeft", offset: -5 }}
        />
        <Tooltip
          formatter={(v) => `${Number(v).toFixed(2)}%`}
          labelFormatter={(l) => `Month: ${l}`}
        />
        <Legend />
        <Line type="monotone" dataKey="current" name="Current Portfolio" stroke="#94A3B8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="recommended" name="Recommended" stroke="var(--color-antarctica-navy)" strokeWidth={2} dot={false} />
        {hasBenchmark && (
          <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
