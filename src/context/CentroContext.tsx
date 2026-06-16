"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Centro } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

interface CentroContextValue {
  centros: Centro[];
  centroActivo: Centro | null;
  setCentroActivo: (centro: Centro) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const CentroContext = createContext<CentroContextValue | null>(null);

export function CentroProvider({ children }: { children: React.ReactNode }) {
  const [centros, setCentros] = useState<Centro[]>([]);
  const [centroActivo, setCentroActivoState] = useState<Centro | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchCentros = async () => {
    const { data } = await supabase
      .from("centros")
      .select("*")
      .order("created_at");
    if (data && data.length > 0) {
      setCentros(data);
      // Restaurar el centro activo del localStorage
      const savedId = localStorage.getItem("alcheque_centro_activo");
      const saved = data.find((c) => c.id === savedId);
      setCentroActivoState(saved ?? data[0]);
    }
    setLoading(false);
  };

  const setCentroActivo = (centro: Centro) => {
    setCentroActivoState(centro);
    localStorage.setItem("alcheque_centro_activo", centro.id);
  };

  useEffect(() => {
    fetchCentros();
    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") fetchCentros();
      if (event === "SIGNED_OUT") {
        setCentros([]);
        setCentroActivoState(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <CentroContext.Provider
      value={{
        centros,
        centroActivo,
        setCentroActivo,
        loading,
        refetch: fetchCentros,
      }}
    >
      {children}
    </CentroContext.Provider>
  );
}

export function useCentro() {
  const ctx = useContext(CentroContext);
  if (!ctx) throw new Error("useCentro debe usarse dentro de CentroProvider");
  return ctx;
}
