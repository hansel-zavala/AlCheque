"use client";

import { useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { formatHNL } from "@/utils/currency";

interface KpiCardProps {
  title: string;
  value: number;
  variant: "income" | "expense" | "balance" | "neutral";
  subtitle?: string;
  trend?: number; // porcentaje de cambio
  index?: number;
  format?: (n: number) => string;
}

const variantConfig = {
  income: {
    icon: TrendingUp,
    color: "var(--accent)",
    bgColor: "var(--accent-muted)",
  },
  expense: {
    icon: TrendingDown,
    color: "var(--red)",
    bgColor: "var(--red-muted)",
  },
  balance: {
    icon: Minus,
    color: "var(--amber)",
    bgColor: "var(--amber-muted)",
  },
  neutral: {
    icon: Minus,
    color: "var(--text-muted)",
    bgColor: "var(--bg-subtle)",
  },
};

export function KpiCard({ title, value, variant, subtitle, trend, index = 0, format }: KpiCardProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const numberFormat = format ?? ((n: number) => formatHNL(n));

  return (
    <motion.div
      className="kpi-card glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.07,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      <div className="kpi-header">
        <div className="kpi-icon" style={{ background: config.bgColor }}>
          <Icon size={18} style={{ color: config.color }} strokeWidth={2} />
        </div>
        {trend !== undefined && (
          <div className={`kpi-trend ${trend >= 0 ? "up" : "down"}`}>
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="kpi-body">
        <p className="kpi-title">{title}</p>
        <p className="kpi-value" style={{ color: config.color }}>
          <AnimatedNumber
            value={value}
            format={numberFormat}
            duration={900}
          />
        </p>
        {subtitle && <p className="kpi-subtitle">{subtitle}</p>}
      </div>

      <style jsx>{`
        .kpi-card {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          transition: box-shadow 200ms var(--ease-out),
                      border-color 200ms var(--ease-out);
        }

        .kpi-card:hover {
          box-shadow: var(--shadow-lg);
          border-color: rgba(255, 255, 255, 0.16) !important;
        }

        .kpi-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .kpi-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kpi-trend {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.125rem 0.5rem;
          border-radius: 99px;
        }

        .kpi-trend.up {
          background: var(--accent-muted);
          color: var(--accent);
        }

        .kpi-trend.down {
          background: var(--red-muted);
          color: var(--red);
        }

        .kpi-body {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .kpi-title {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: 0;
          font-weight: 500;
        }

        .kpi-value {
          font-size: 1.625rem;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
          font-family: var(--font-mono);
          line-height: 1.2;
        }

        .kpi-subtitle {
          font-size: 0.75rem;
          color: var(--text-subtle);
          margin: 0;
        }
      `}</style>
    </motion.div>
  );
}
