"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, TrendingUp, Phone, Mail, MapPin, FileText, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { centroSchema, type CentroFormData } from "@/types/forms";
import { useCentro } from "@/context/CentroContext";

export default function NuevoCentroPage() {
  const router = useRouter();
  const { refetch } = useCentro();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CentroFormData>({
    resolver: zodResolver(centroSchema),
  });

  const onSubmit = async (data: CentroFormData) => {
    setLoading(true);
    setServerError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("centros").insert({
      user_id: user.id,
      nombre: data.nombre,
      telefono: data.telefono || null,
      email_contacto: data.email_contacto || null,
      direccion: data.direccion || null,
      descripcion: data.descripcion || null,
    });

    if (error) {
      setServerError("No se pudo crear el centro. Inténtalo de nuevo.");
      setLoading(false);
      return;
    }

    await refetch();
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-bg" aria-hidden="true">
        <div className="onboarding-blob ob-1" />
        <div className="onboarding-blob ob-2" />
      </div>

      <motion.div
        className="onboarding-container"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Header */}
        <div className="ob-header">
          <div className="ob-logo">
            <TrendingUp size={22} strokeWidth={2.5} />
          </div>
          <div className="ob-step">Paso 1 de 1</div>
        </div>

        <div className="ob-card">
          <div className="ob-card-header">
            <div className="ob-icon">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="ob-title">Configura tu centro</h1>
              <p className="ob-subtitle">
                Ingresa los datos de tu centro terapéutico. Podrás editarlos en
                cualquier momento desde Configuración.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="ob-form" noValidate>
            <div className="ob-fields-grid">
              {/* Nombre */}
              <div className="form-group span-full">
                <label className="form-label" htmlFor="nombre">
                  Nombre del centro <span className="required">*</span>
                </label>
                <input
                  id="nombre"
                  type="text"
                  className={`form-input ${errors.nombre ? "error" : ""}`}
                  placeholder="Ej: Centro Terapéutico Vida Plena"
                  {...register("nombre")}
                />
                {errors.nombre && (
                  <p className="form-error">{errors.nombre.message}</p>
                )}
              </div>

              {/* Teléfono */}
              <div className="form-group">
                <label className="form-label" htmlFor="telefono">
                  <Phone size={13} style={{ display: "inline", marginRight: "4px" }} />
                  Teléfono
                </label>
                <input
                  id="telefono"
                  type="tel"
                  className="form-input"
                  placeholder="+504 9999-0000"
                  {...register("telefono")}
                />
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="email_contacto">
                  <Mail size={13} style={{ display: "inline", marginRight: "4px" }} />
                  Correo de contacto
                </label>
                <input
                  id="email_contacto"
                  type="email"
                  className={`form-input ${errors.email_contacto ? "error" : ""}`}
                  placeholder="info@tucentro.com"
                  {...register("email_contacto")}
                />
                {errors.email_contacto && (
                  <p className="form-error">{errors.email_contacto.message}</p>
                )}
              </div>

              {/* Dirección */}
              <div className="form-group span-full">
                <label className="form-label" htmlFor="direccion">
                  <MapPin size={13} style={{ display: "inline", marginRight: "4px" }} />
                  Dirección
                </label>
                <input
                  id="direccion"
                  type="text"
                  className="form-input"
                  placeholder="Colonia, ciudad, departamento"
                  {...register("direccion")}
                />
              </div>

              {/* Descripción */}
              <div className="form-group span-full">
                <label className="form-label" htmlFor="descripcion">
                  <FileText size={13} style={{ display: "inline", marginRight: "4px" }} />
                  Descripción (opcional)
                </label>
                <textarea
                  id="descripcion"
                  className="form-input form-textarea"
                  placeholder="Breve descripción del centro..."
                  rows={3}
                  {...register("descripcion")}
                />
              </div>
            </div>

            {serverError && (
              <motion.div
                className="ob-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {serverError}
              </motion.div>
            )}

            <button
              type="submit"
              className="btn-primary btn-pressable ob-submit"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-spinner" />
              ) : (
                <>
                  Crear centro e ir al Dashboard
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      <style jsx>{`
        .required { color: var(--red); }

        .onboarding-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.5rem;
          background: var(--bg);
          position: relative;
          overflow: hidden;
        }

        .onboarding-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
        }

        .onboarding-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.12;
        }

        .ob-1 {
          width: 600px;
          height: 600px;
          background: var(--accent);
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
        }

        .ob-2 {
          width: 400px;
          height: 400px;
          background: oklch(0.60 0.18 165);
          bottom: -150px;
          right: 10%;
        }

        .onboarding-container {
          width: 100%;
          max-width: 600px;
          position: relative;
          z-index: 1;
        }

        .ob-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .ob-logo {
          width: 40px;
          height: 40px;
          background: var(--accent);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-fg);
        }

        .ob-step {
          font-size: 0.8125rem;
          color: var(--text-muted);
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 0.25rem 0.75rem;
          border-radius: 99px;
        }

        .ob-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: var(--shadow-lg);
        }

        .ob-card-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .ob-icon {
          width: 48px;
          height: 48px;
          background: var(--accent-muted);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          flex-shrink: 0;
        }

        .ob-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.375rem;
          letter-spacing: -0.02em;
        }

        .ob-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
        }

        .ob-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .ob-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .span-full {
          grid-column: 1 / -1;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .ob-error {
          background: var(--red-muted);
          border: 1px solid var(--red);
          border-radius: 8px;
          padding: 0.625rem 0.875rem;
          font-size: 0.8125rem;
          color: var(--red);
        }

        .ob-submit {
          width: 100%;
          height: 48px;
          font-size: 1rem;
        }

        .btn-primary {
          background: var(--accent);
          color: var(--accent-fg);
          border: none;
          border-radius: 8px;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-family: var(--font-sans);
          transition: background-color 160ms var(--ease-out),
                      transform 160ms var(--ease-out);
        }

        .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid oklch(1 0 0 / 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 600ms linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .ob-fields-grid {
            grid-template-columns: 1fr;
          }
          .ob-card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
