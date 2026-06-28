"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FileUploaderProps {
  centroId: string;
  onUpload: (url: string | null) => void;
  currentUrl: string | null;
}

const convertToWebP = (file: File, maxDimension = 1600, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const baseName = file.name.replace(/\.[^/.]+$/, "") || "comprobante";
              resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
              return;
            }

            reject(new Error("Error al convertir a WebP"));
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("Error al cargar la imagen"));
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
  });
};

export function FileUploader({ centroId, onUpload, currentUrl }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validar tamaño (máx 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("El archivo no debe superar 10MB");
        return;
      }

      setUploading(true);
      setError("");

      let fileToUpload: File = file;
      let ext = file.name.split(".").pop() || "";

      if (file.type.startsWith("image/")) {
        try {
          fileToUpload = await convertToWebP(file);
          ext = "webp";
        } catch {
          setError("Error al comprimir la imagen. Inténtalo de nuevo.");
          setUploading(false);
          return;
        }
      }

      const fileName = `${centroId}/${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from("comprobantes")
        .upload(fileName, fileToUpload, { 
          upsert: false,
          contentType: fileToUpload.type,
        });

      if (uploadError) {
        console.error("Error de subida a Supabase:", uploadError);
        setError(
          uploadError.message.includes("row-level security")
            ? "Supabase bloqueó la subida por una política de Storage. Revisa que el bucket permita archivos .webp para este centro."
            : `Error al subir el archivo: ${uploadError.message}`
        );
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("comprobantes")
        .getPublicUrl(data.path);

      onUpload(urlData.publicUrl);
      setUploading(false);
    },
    [centroId, supabase, onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  if (currentUrl) {
    return (
      <div className="uploader-done">
        <div className="uploader-done-info">
          <FileCheck size={18} style={{ color: "var(--accent)" }} />
          <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="uploader-link">
            Comprobante adjunto
          </a>
        </div>
        <button
          type="button"
          className="uploader-remove"
          onClick={() => onUpload(null)}
          aria-label="Quitar comprobante"
        >
          <X size={14} />
        </button>

        <style jsx>{`
          .uploader-done {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--accent-muted);
            border: 1px solid var(--accent);
            border-radius: 8px;
            padding: 0.625rem 0.875rem;
          }
          .uploader-done-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .uploader-link {
            font-size: 0.875rem;
            color: var(--accent);
            text-decoration: none;
            font-weight: 500;
          }
          .uploader-remove {
            background: none;
            border: none;
            color: var(--accent);
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 4px;
            display: flex;
            transition: background 120ms;
          }
          .uploader-remove:hover { background: oklch(0 0 0 / 0.1); }
        `}</style>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "drag-active" : ""} ${uploading ? "uploading" : ""}`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="dz-content">
          <Loader2 size={22} className="dz-spinner" style={{ color: "var(--accent)" }} />
          <p className="dz-text">Subiendo comprobante...</p>
        </div>
      ) : (
        <div className="dz-content">
          <Upload size={20} style={{ color: isDragActive ? "var(--accent)" : "var(--text-subtle)" }} />
          <div>
            <p className="dz-text">
              {isDragActive ? "Suelta el archivo aquí" : "Arrastra un archivo o haz clic"}
            </p>
            <p className="dz-hint">JPG, PNG, PDF • máx. 10MB</p>
          </div>
        </div>
      )}
      {error && <p className="dz-error">{error}</p>}

      <style jsx>{`
        .dropzone {
          border: 1.5px dashed var(--border);
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
          transition: border-color 150ms var(--ease-out),
                      background 150ms var(--ease-out);
          background: var(--bg-subtle);
        }
        .dropzone:hover {
          border-color: var(--accent);
          background: var(--accent-muted);
        }
        .dropzone.drag-active {
          border-color: var(--accent);
          background: var(--accent-muted);
        }
        .dropzone.uploading {
          pointer-events: none;
          opacity: 0.8;
        }
        .dz-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .dz-text {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: 0;
          font-weight: 500;
        }
        .dz-hint {
          font-size: 0.75rem;
          color: var(--text-subtle);
          margin: 0.125rem 0 0;
        }
        .dz-error {
          font-size: 0.75rem;
          color: var(--red);
          margin: 0.5rem 0 0;
        }
        .dz-spinner {
          animation: spin 800ms linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
