"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PerformanceChartProps {
  data: { date: string; current: number; recommended: number; benchmark: number | null }[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const hasBenchmark = data.some((d) => d.benchmark !== null);

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 font-sans h-full flex flex-col">
      {/* Header Section */}
      <div className="bg-[#002D54] p-6 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 w-9 h-9 flex items-center justify-center rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" /><path d="M18 9l-6 6-3-3-4 4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Historical Performance Comparison</h2>
        </div>
      </div>

      <div className="p-6 flex-grow">
        {/* User Feedback: Charts were invisible. Using fixed height container for Recharts reliability. */}
        <div className="relative w-full h-[400px]">
          {/* Screen Reader Only Table */}
          <table className="sr-only">
            <caption>Cumulative Return Comparison (Current vs Recommended vs Benchmark)</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Current Portfolio (%)</th>
                <th scope="col">Recommended Portfolio (%)</th>
                {hasBenchmark && <th scope="col">Benchmark (%)</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i}>
                  <td>{d.date}</td>
                  <td>{d.current}</td>
                  <td>{d.recommended}</td>
                  {hasBenchmark && <td>{d.benchmark ?? "N/A"}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Visual Chart */}
          <ResponsiveContainer width="100%" height="100%" aria-hidden="true">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                tickFormatter={(v: string) => {
                  const [y, m] = v.split("-");
                  return `${m}/${y.slice(2)}`;
                }}
                interval={2}
                axisLine={{ stroke: "#E2E8F0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                tickFormatter={(v: string | number) => `${Number(v).toFixed(0)}%`}
                label={{ value: "Cumulative Return", angle: -90, position: "insideLeft", offset: -5, style: { fill: "#94A3B8", fontSize: 10, fontWeight: 600 } }}
                axisLine={{ stroke: "#E2E8F0" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                formatter={(v) => [`${Number(v).toFixed(2)}%`]}
                labelFormatter={(l) => `Month: ${l}`}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Line type="monotone" dataKey="current" name="Current Portfolio" stroke="#94A3B8" strokeWidth={3} dot={false} strokeOpacity={0.5} />
              <Line type="monotone" dataKey="recommended" name="Recommended" stroke="#2563EB" strokeWidth={4} dot={false} />
              {hasBenchmark && (
                <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#10B981" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
