"use client";

import type { CSSProperties } from "react";
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
      className="kpi-card"
      style={{ "--card-accent-color": config.color } as CSSProperties}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.07,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      <div className="kpi-header">
        <p className="kpi-title">{title}</p>
        <div className="kpi-icon" style={{ background: config.bgColor }} aria-hidden="true">
          <Icon size={18} style={{ color: config.color }} strokeWidth={2.3} />
        </div>
      </div>

      <div className="kpi-body">
        <p className="kpi-value" style={{ color: config.color }}>
          <AnimatedNumber
            value={value}
            format={numberFormat}
            duration={900}
          />
        </p>
      </div>

      {(subtitle || trend !== undefined) && (
        <div className="kpi-footer">
          {subtitle && <p className="kpi-subtitle">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`kpi-trend ${trend >= 0 ? "up" : "down"}`}>
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </div>
          )}
        </div>
      )}
      <span className="kpi-meter" aria-hidden="true" />

      <style jsx>{`
        :global(.kpi-card) {
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--card-accent-color) 18%, transparent), transparent 48%),
            linear-gradient(145deg, rgba(23, 31, 51, 0.92), rgba(13, 21, 39, 0.72));
          backdrop-filter: blur(20px);
          border: 1px solid color-mix(in srgb, var(--card-accent-color) 28%, rgba(255, 255, 255, 0.08));
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          border-radius: 22px;
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          min-height: 156px;
          position: relative;
          overflow: hidden;
          transition: box-shadow 200ms var(--ease-out),
                      border-color 200ms var(--ease-out);
        }

        :global([data-theme="light"] .kpi-card) {
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--card-accent-color) 12%, transparent), transparent 48%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(246, 250, 247, 0.84));
          border: 1px solid color-mix(in srgb, var(--card-accent-color) 20%, rgba(0, 0, 0, 0.07));
          box-shadow: 0 16px 36px rgba(15, 28, 19, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        :global(.kpi-card)::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent 38%);
          opacity: 0.55;
        }

        :global(.kpi-card)::after {
          content: "";
          position: absolute;
          left: 1.15rem;
          right: 1.15rem;
          bottom: 1rem;
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.08);
        }

        :global(.kpi-card:hover) {
          box-shadow: 0 22px 52px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          border-color: color-mix(in srgb, var(--card-accent-color) 42%, rgba(255, 255, 255, 0.12)) !important;
        }

        .kpi-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          position: relative;
          z-index: 1;
        }

        .kpi-icon {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 14px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--card-accent-color) 22%, transparent);
        }

        .kpi-trend {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.125rem 0.5rem;
          border-radius: 99px;
          white-space: nowrap;
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
          position: relative;
          z-index: 1;
        }

        .kpi-title {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin: 0;
          font-family: var(--font-mono);
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .kpi-value {
          font-size: clamp(1.55rem, 2.4vw, 2.15rem);
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.055em;
          font-family: var(--font-mono);
          line-height: 1;
          text-shadow: 0 0 18px color-mix(in srgb, var(--card-accent-color) 18%, transparent);
        }

        .kpi-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-top: auto;
          padding-bottom: 0.9rem;
          position: relative;
          z-index: 1;
        }

        .kpi-subtitle {
          font-size: 0.75rem;
          color: var(--text-subtle);
          margin: 0;
          font-weight: 700;
        }

        .kpi-meter {
          position: absolute;
          left: 1.15rem;
          bottom: 1rem;
          width: min(68%, calc(100% - 2.3rem));
          height: 4px;
          background: var(--card-accent-color, var(--accent));
          border-radius: 99px;
          box-shadow: 0 0 18px color-mix(in srgb, var(--card-accent-color) 45%, transparent);
          z-index: 1;
        }

        @media (max-width: 640px) {
          :global(.kpi-card) { min-height: 148px; }
          .kpi-footer { align-items: flex-start; flex-direction: column; gap: 0.25rem; }
        }
      `}</style>
    </motion.div>
  );
}
