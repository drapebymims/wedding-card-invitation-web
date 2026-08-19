"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Form field primitives for the studio wizard. Styled on the platform's base
 * tokens (warm premium palette) with a consistent focus + error state.
 */

const baseField =
  "w-full rounded-xl border bg-[var(--c-surface)] px-3.5 py-2.5 text-[15px] text-[var(--c-text)] placeholder:text-[var(--c-muted)]/60 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)]/25";

function fieldBorder(hasError: boolean) {
  return hasError ? "border-red-400 focus:border-red-400" : "border-[var(--border)] focus:border-[var(--c-primary)]";
}

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-[var(--c-text)]">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-[var(--c-muted)]">(pilihan)</span>
        ) : null}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-[var(--c-muted)]">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export function TextInput({
  label,
  hint,
  error,
  optional,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      <input {...props} className={`${baseField} ${fieldBorder(Boolean(error))}`} />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  error,
  optional,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      <textarea rows={3} {...props} className={`${baseField} ${fieldBorder(Boolean(error))} resize-y`} />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      <select {...props} className={`${baseField} ${fieldBorder(Boolean(error))} cursor-pointer`}>
        {children}
      </select>
    </Field>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--c-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--c-primary)]/40"
    >
      <span>
        <span className="block text-sm font-medium text-[var(--c-text)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-[var(--c-muted)]">{hint}</span> : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--c-primary)]" : "bg-[var(--c-muted)]/30"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--c-primary)]/50 px-3.5 py-1.5 text-sm font-medium text-[var(--c-primary)] transition-colors hover:bg-[var(--c-primary)]/5"
    >
      {children}
    </button>
  );
}
