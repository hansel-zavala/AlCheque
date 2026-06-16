"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Building2,
  X,
  HelpCircle,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useCentro } from "@/context/CentroContext";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "DASHBOARD" },
  { href: "/pacientes", icon: Users, label: "PACIENTES" },
  { href: "/transacciones", icon: ArrowLeftRight, label: "TRANSACCIONES" },
  { href: "/reportes", icon: BarChart3, label: "REPORTES" },
  { href: "/configuracion", icon: Settings, label: "CONFIGURACIÓN" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { centros, centroActivo, setCentroActivo } = useCentro();
  const [showCentroMenu, setShowCentroMenu] = useState(false);
  const supabase = createClient();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCentroMenu(false);
      }
    }
    if (showCentroMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCentroMenu]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay móvil */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-[250] backdrop-blur-[2px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`app-sidebar ${isOpen ? "open" : ""}`}>
        <div className="h-full flex flex-col bg-[var(--surface)] border-r border-[var(--border)] ">
          {/* Logo + cerrar móvil */}
          <div className="sidebar-logo-container flex items-center justify-between ">
            <Link href="/dashboard" className="flex items-center gap-3 no-underline" onClick={onClose}>
              <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center text-[var(--accent-fg)] shadow">
                <Image src="/image/Logo_AlCheque_sinFondo.png" alt="Logo" width={32} height={32} className="object-contain" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-extrabold text-[var(--text)] tracking-tight leading-none">AlCheque</span>
                <span className="font-mono text-[9px] font-bold text-[var(--accent)] tracking-widest leading-none">PORTAL ADMIN</span>
              </div>
            </Link>
            <button className="flex md:hidden text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] p-1.5 rounded-lg transition-colors items-center justify-center" onClick={onClose} aria-label="Cerrar menú">
              <X size={18} />
            </button>
          </div>

          {/* Selector de centro */}
          <div ref={menuRef} className="centro-selector-container relative">
            <button
              className="w-full flex items-center gap-3.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-2xl py-3 px-4 cursor-pointer text-left transition-all hover:bg-[var(--surface-hover)] focus:outline-none"
              onClick={() => setShowCentroMenu(!showCentroMenu)}
              aria-expanded={showCentroMenu}
              aria-label="Cambiar centro"
            >
              <div className="w-12 h-12 bg-[var(--accent-muted)] rounded-xl flex items-center justify-center text-[var(--accent)] flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Building2 size={25} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-mono font-bold uppercase text-[var(--text-subtle)] tracking-wider leading-none mb-1.5">Centro activo</span>
                <span className="block text-sm font-extrabold text-[var(--text)] truncate leading-none">
                  {centroActivo?.nombre ?? "Selecciona un centro"}
                </span>
              </div>
              <ChevronDown
                size={18}
                className={`text-[var(--text-muted)] transition-transform duration-200 flex-shrink-0 ${showCentroMenu ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {showCentroMenu && (
                <motion.div
                  className="absolute top-[calc(100%+0px)] left-3.5 right-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] z-[100] p-2 origin-top backdrop-blur-md"
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                >
                  {centros.map((centro) => (
                    <button
                      key={centro.id}
                      className={`w-full flex items-center gap-2 py-3 px-4 h-10 text-sm text-[var(--text)] rounded-lg text-left transition-colors hover:bg-[var(--surface-hover)] ${
                        centroActivo?.id === centro.id ? "bg-[var(--accent-muted)] text-[var(--accent)] font-semibold" : ""
                      }`}
                      onClick={() => {
                        setCentroActivo(centro);
                        setShowCentroMenu(false);
                        router.refresh();
                      }}
                    >
                      <Building2 size={20} />
                      <span className="truncate flex-1">{centro.nombre}</span>
                      {centroActivo?.id === centro.id && (
                        <span className="text-[var(--accent)] font-bold">✓</span>
                      )}
                    </button>
                  ))}
                  <div className="h-[1px] bg-[var(--border)] my-1" />
                  <Link
                    href="/centros/nuevo"
                    className="flex items-center gap-2 py-2 px-3 h-10 text-sm text-[var(--accent)] font-semibold rounded-lg hover:bg-[var(--surface-hover)] no-underline"
                    onClick={() => setShowCentroMenu(false)}
                  >
                    <Plus size={20} />
                    <span>Nuevo centro</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Botón Nueva Entrada */}
          {/*<div className="new-entry-container">
            <Link
              href="/transacciones?new=true"
              onClick={onClose}
              className="btn-pressable flex items-center justify-center gap-2 py-4 h-8 w-full rounded-xl font-bold text-xs tracking-wider uppercase bg-gradient-to-br from-[var(--accent)] to-[#10b981] text-[var(--accent-fg)] shadow-[0_4px_14px_rgba(16,185,129,0.2)] hover:opacity-95 hover:shadow-[0_6px_16px_rgba(16,185,129,0.3)] no-underline"
            >
              <Plus size={16} strokeWidth={3} />
              <span>Nueva Entrada</span>
            </Link>
          </div> */}

          {/* Navegación */}
          <nav className="nav-container flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`nav-item no-underline ${
                  isActive(item.href)
                    ? "bg-[var(--accent)] text-[var(--accent-fg)] active-nav-item shadow-sm"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                }`}
              >
                <item.icon
                  size={18}
                  strokeWidth={isActive(item.href) ? 2.5 : 2}
                />
                <span>
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 pt-3 pb-5 border-t border-[var(--border)] flex items-center gap-2">
            <Link href="/soporte" className="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 h-12 rounded-lg border border-[var(--border)] text-[var(--text-subtle)] text-[12px] font-mono font-bold tracking-wider hover:bg-[var(--surface-hover)] hover:text-[var(--text)] hover:border-[var(--border-strong)] no-underline transition-colors" onClick={onClose}>
              <HelpCircle size={15} />
              <span>SOPORTE</span>
            </Link>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 h-12 rounded-lg border border-[var(--border)] text-[var(--text-subtle)] text-[12px] font-mono font-bold tracking-wider hover:bg-[var(--surface-hover)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
            >
              <LogOut size={15} />
              <span>SALIR</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// TopBar component
export function TopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const { centroActivo } = useCentro();

  const currentPage = navItems.find((item) => {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(item.href);
  });

  return (
    <header className="app-header">
      <button
        className="flex md:hidden text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] p-1.5 rounded-lg transition-colors items-center justify-center"
        onClick={onMenuOpen}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h2 className="text-base font-bold text-[var(--text)] tracking-tight leading-none uppercase">{currentPage?.label ?? "AlCheque"}</h2>
        {centroActivo && (
          <span className="text-xs text-[var(--text-muted)] truncate block mt-1">{centroActivo.nombre}</span>
        )}
      </div>
    </header>
  );
}
