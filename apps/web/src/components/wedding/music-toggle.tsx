"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { MusicToggleProps } from "./props";

function MusicNoteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/** Equalizer bars shown while audio is playing. */
function Equalizer() {
  return (
    <span
      className="absolute -right-0.5 -bottom-0.5 flex h-4 items-end gap-[2px] rounded-[4px] bg-(--c-surface) px-[3px] pb-[2px] shadow-(--shadow)"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] origin-bottom rounded-full bg-(--c-primary)"
          style={{
            height: 9,
            animation: `wciw-eq 0.8s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** MusicToggle — floating circular play/pause button for the invitation audio. */
export default function MusicToggle({ src, lang }: MusicToggleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);

  // Pause if the component unmounts while audio is running.
  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || starting) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    // Starting playback on a click is a user gesture, so autoplay policy is satisfied.
    setStarting(true);
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="none" className="hidden" />
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={t("music_toggle", lang)}
        aria-pressed={playing}
        className="fixed right-6 bottom-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full border border-(--border) bg-(--c-surface) text-(--c-primary) shadow-(--shadow) transition hover:opacity-90"
      >
        <span className="relative flex h-full w-full items-center justify-center">
          <MusicNoteIcon />
          {playing ? <Equalizer /> : null}
        </span>
      </button>

      <style>{`@keyframes wciw-eq { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }`}</style>
    </>
  );
}
