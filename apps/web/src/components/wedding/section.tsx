import type { ReactNode } from "react";
import type { SectionProps } from "./props";

/**
 * Section — neutral wrapper used by every theme to give a page region an
 * accessible heading, optional subtitle and shared horizontal rhythm.
 * Pure (no interactivity) so it can be used from server or client themes.
 */
export default function Section({
  id,
  title,
  subtitle,
  className = "",
  children,
}: SectionProps): ReactNode {
  return (
    <section id={id} className={`w-full ${className}`.trim()}>
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="mb-3 text-center text-3xl font-semibold text-(--c-text) sm:text-4xl [font-family:var(--font-display)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mx-auto mb-10 max-w-xl text-center text-base leading-relaxed text-(--c-muted)">
            {subtitle}
          </p>
        ) : null}
        <div>{children}</div>
      </div>
    </section>
  );
}
