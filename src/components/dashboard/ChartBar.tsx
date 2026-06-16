"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatHNL } from "@/utils/currency";

interface ChartBarProps {
  data: Array<{
    mes: string;
    ingresos: number;
    egresos: number;
  }>;
  title: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="ct-month">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="ct-row">
          <span className="ct-dot" style={{ background: p.fill }} />
          <span className="ct-key">{p.name}:</span>
          <span className="ct-val">{formatHNL(p.value)}</span>
        </p>
      ))}
      <style jsx>{`
        .chart-tooltip {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.75rem;
          box-shadow: var(--shadow-md);
          min-width: 180px;
        }
        .ct-month {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          margin: 0 0 0.5rem;
          text-transform: capitalize;
        }
        .ct-row {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          margin: 0.25rem 0;
        }
        .ct-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .ct-key { color: var(--text-muted); flex: 1; }
        .ct-val { color: var(--text); font-weight: 600; font-family: var(--font-mono); }
      `}</style>
    </div>
  );
};

export function ChartBar({ data, title }: ChartBarProps) {
  return (
    <div className="chart-container glass-card">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barGap={4} barCategoryGap="25%">
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
            />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-sans)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-sans)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `L${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
            <Bar
              dataKey="ingresos"
              name="Ingresos"
              fill="var(--accent)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="egresos"
              name="Egresos"
              fill="var(--red)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <style jsx>{`
        .chart-container {
          padding: 1.25rem;
        }

        .chart-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 1rem;
          letter-spacing: -0.01em;
        }

        .chart-wrap {
          margin: 0 -0.25rem;
        }
      `}</style>
    </div>
  );
}
