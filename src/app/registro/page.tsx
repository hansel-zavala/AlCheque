"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { registroSchema, type RegistroFormData } from "@/types/forms";

export default function RegistroPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistroFormData>({
    resolver: zodResolver(registroSchema),
  });

  const onSubmit = async (data: RegistroFormData) => {
    setLoading(true);
    setServerError("");

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      if (error.message.includes("already registered")) {
        setServerError("Este correo ya está registrado");
      } else {
        setServerError("Ocurrió un error. Inténtalo de nuevo.");
      }
      setLoading(false);
      return;
    }

    // Redirigir a crear el primer centro
    router.push("/centros/nuevo");
    router.refresh();
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-grid" />
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <TrendingUp size={22} strokeWidth={2.5} />
          </div>
          <span className="auth-logo-text">AlCheque</span>
        </div>

        <div className="auth-header">
          <h1 className="auth-title">Crear cuenta</h1>
          <p className="auth-subtitle">
            Regístrate y comienza a gestionar tu centro
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Correo electrónico <span className="required">*</span>
            </label>
            <input
              id="email"
              type="email"
              className={`form-input ${errors.email ? "error" : ""}`}
              placeholder="tu@correo.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="form-error">{errors.email.message}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Contraseña <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.password ? "error" : ""}`}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                {...register("password")}
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="form-error">{errors.password.message}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirmar contraseña <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? "Ocultar" : "Mostrar"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="form-error">{errors.confirmPassword.message}</p>
            )}
          </div>

          {serverError && (
            <motion.div
              className="auth-error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {serverError}
            </motion.div>
          )}

          <button
            type="submit"
            className="btn-primary btn-pressable auth-submit"
            disabled={loading}
          >
            {loading ? <span className="btn-spinner" /> : "Crear cuenta"}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="auth-link">
            Iniciar sesión
          </Link>
        </p>
      </motion.div>

      <style jsx>{`
        .required { color: var(--red); }

        .auth-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          background: var(--bg);
        }
        .auth-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .auth-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
        }
        .auth-blob-1 {
          width: 500px;
          height: 500px;
          background: var(--accent);
          top: -200px;
          right: -100px;
        }
        .auth-blob-2 {
          width: 400px;
          height: 400px;
          background: oklch(0.60 0.18 170);
          bottom: -150px;
          left: -100px;
        }
        .auth-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.3;
        }
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2.5rem;
          box-shadow: var(--shadow-lg);
        }
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 2rem;
        }
        .auth-logo-icon {
          width: 40px;
          height: 40px;
          background: var(--accent);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-fg);
        }
        .auth-logo-text {
          font-size: 1.375rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .auth-header { margin-bottom: 1.75rem; }
        .auth-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.375rem;
          letter-spacing: -0.02em;
        }
        .auth-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .input-with-icon { position: relative; }
        .input-with-icon .form-input { padding-right: 2.75rem; }
        .input-icon-btn {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition: color 150ms var(--ease-out);
        }
        .input-icon-btn:hover { color: var(--text); }
        .auth-error {
          background: var(--red-muted);
          border: 1px solid var(--red);
          border-radius: 8px;
          padding: 0.625rem 0.875rem;
          font-size: 0.8125rem;
          color: var(--red);
        }
        .auth-submit {
          margin-top: 0.25rem;
          width: 100%;
          height: 44px;
        }
        .auth-footer {
          margin: 1.5rem 0 0;
          text-align: center;
          font-size: 0.875rem;
          color: var(--text-muted);
        }
        .auth-link {
          color: var(--accent);
          text-decoration: none;
          font-weight: 500;
          transition: color 150ms var(--ease-out);
        }
        .auth-link:hover { color: var(--accent-hover); }
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
      `}</style>
    </div>
  );
}
