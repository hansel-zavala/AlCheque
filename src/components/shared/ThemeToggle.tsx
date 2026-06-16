"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        className="theme-toggle-compact btn-pressable"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}

        <style jsx>{`
          .theme-toggle-compact {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--bg-subtle);
            color: var(--text-muted);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: background 150ms var(--ease-out),
                        color 150ms var(--ease-out),
                        border-color 150ms var(--ease-out),
                        transform 160ms var(--ease-out);
          }
          .theme-toggle-compact:hover {
            color: var(--text);
            background: var(--surface-hover);
          }
        `}</style>
      </button>
    );
  }

  return (
    <button
      className="theme-toggle btn-pressable"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>

      <style jsx>{`
        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-subtle);
          color: var(--text-muted);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          font-family: var(--font-sans);
          transition: background 150ms var(--ease-out),
                      color 150ms var(--ease-out),
                      transform 160ms var(--ease-out);
        }
        .theme-toggle:hover {
          color: var(--text);
          background: var(--surface-hover);
        }
      `}</style>
    </button>
  );
}
