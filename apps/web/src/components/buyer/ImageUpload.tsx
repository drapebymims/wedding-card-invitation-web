"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/types";

/**
 * ImageUpload — a picker/drop widget for the studio (gallery + story steps).
 *
 * Owns the file-selection UI, client-side validation (image type + ≤10MB),
 * preview thumbnail with remove-on-hover, and the upload-in-progress state.
 * The actual network/mock upload is delegated to `onUpload(file)`, which the
 * Studio wires to `orders-adapter.uploadImage` and then stores the returned
 * CDN URL back into the live CoupleConfig.
 *
 * - `value` = the current image src in config (single mode shows it as a
 *   thumbnail with replace/remove).
 * - `multiple` = gallery mode (append several); otherwise single replace.
 * - `disabled` = no order yet → clicking shows `disabledMessage` as a toast.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

interface ImageUploadProps {
  value?: string;
  onChange: (src: string) => void;
  onUpload: (file: File) => Promise<string>;
  label?: string;
  disabled?: boolean;
  disabledMessage?: string;
  multiple?: boolean;
  lang?: Language;
}

export function ImageUpload({
  value,
  onChange,
  onUpload,
  label,
  disabled,
  disabledMessage,
  multiple = false,
  lang = "ms",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, kind: "error" | "info") => {
    if (kind === "error") {
      setError(msg);
      setNotice(null);
    } else {
      setNotice(msg);
      setError(null);
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setError(null);
      setNotice(null);
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const validate = (file: File): string | null => {
    if (!file.type.startsWith("image/")) return t("upload_error_type", lang);
    if (file.size > MAX_BYTES) return t("upload_error_size", lang);
    return null;
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled) {
      showToast(disabledMessage ?? t("upload_requires_order", lang), "info");
      return;
    }
    const list = Array.from(files);
    if (list.length === 0) return;

    // Validate all first.
    for (const f of list) {
      const err = validate(f);
      if (err) {
        showToast(err, "error");
        return;
      }
    }

    setUploading(true);
    try {
      // Upload sequentially so the preview updates predictably.
      for (const f of list) {
        const src = await onUpload(f);
        onChange(src);
      }
    } catch {
      showToast(t("upload_error_generic", lang), "error");
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => {
    if (disabled) {
      showToast(disabledMessage ?? t("upload_requires_order", lang), "info");
      return;
    }
    inputRef.current?.click();
  };

  const dropzone = (
    <button
      type="button"
      onClick={openPicker}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragover(true);
      }}
      onDragLeave={() => setDragover(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragover(false);
        void handleFiles(e.dataTransfer.files);
      }}
      className={`buyer-dropzone ${dragover ? "buyer-dropzone--dragover" : ""} ${disabled ? "buyer-dropzone--disabled" : ""}`}
      aria-label={label ?? t("upload_add_photo", lang)}
    >
      {uploading ? (
        <>
          <span className="buyer-spinner buyer-spinner--primary" aria-hidden="true" />
          <span className="text-sm font-medium">{t("upload_uploading", lang)}</span>
        </>
      ) : (
        <>
          <span className="text-lg" aria-hidden="true">＋</span>
          <span className="text-sm font-medium">{label ?? t("upload_add_photo", lang)}</span>
          <span className="text-xs opacity-70">{t("upload_drop_formats", lang)}</span>
        </>
      )}
    </button>
  );

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        if (e.target.files) void handleFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="space-y-3">
      {input}

      {/* Existing image (single mode) with remove-on-hover */}
      {!multiple && value ? (
        <div className="flex items-start gap-3">
          <div className="buyer-upload-thumb h-24 w-24 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" />
            <div className="buyer-upload-thumb__overlay">
              <button
                type="button"
                className="buyer-upload-thumb__btn"
                onClick={openPicker}
                disabled={uploading}
              >
                {t("upload_replace", lang)}
              </button>
              <button
                type="button"
                className="buyer-upload-thumb__btn buyer-upload-thumb__btn--danger"
                onClick={() => onChange("")}
                disabled={uploading}
              >
                {t("upload_remove", lang)}
              </button>
            </div>
          </div>
          <div className="flex-1">{dropzone}</div>
        </div>
      ) : (
        dropzone
      )}

      {/* Toast */}
      {error || notice ? (
        <div className={`buyer-toast ${error ? "buyer-toast--error" : "buyer-toast--info"}`} role="status">
          {error ?? notice}
        </div>
      ) : null}
    </div>
  );
}
