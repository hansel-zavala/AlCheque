"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatHNL } from "@/utils/currency";

interface ChartDonutProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  title: string;
  subtitle?: string;
  total?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="chart-tooltip">
      <p className="ct-label">{d.name}</p>
      <p className="ct-value">{formatHNL(d.value)}</p>
      <style jsx>{`
        .chart-tooltip {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.625rem 0.875rem;
          box-shadow: var(--shadow-md);
        }
        .ct-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0 0 0.25rem;
        }
        .ct-value {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
};

export function ChartDonut({ data, title, subtitle, total }: ChartDonutProps) {
  return (
    <div className="chart-container glass-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        {subtitle && <p className="chart-subtitle">{subtitle}</p>}
        {total !== undefined && (
          <p className="chart-total">{formatHNL(total)}</p>
        )}
      </div>

      <div className="chart-body">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Leyenda */}
        <div className="chart-legend">
          {data.map((entry) => (
            <div key={entry.name} className="legend-item">
              <span
                className="legend-dot"
                style={{ background: entry.color }}
              />
              <span className="legend-name">{entry.name}</span>
              <span className="legend-value">{formatHNL(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .chart-container {
          padding: 1.25rem;
        }

        .chart-header {
          margin-bottom: 1rem;
        }

        .chart-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.25rem;
          letter-spacing: -0.01em;
        }

        .chart-subtitle {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: 0;
        }

        .chart-total {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--accent);
          margin: 0.25rem 0 0;
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
        }

        .chart-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .chart-legend {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .legend-name {
          flex: 1;
          color: var(--text-muted);
        }

        .legend-value {
          color: var(--text);
          font-weight: 600;
          font-family: var(--font-mono);
          font-size: 0.8125rem;
        }
      `}</style>
    </div>
  );
}
