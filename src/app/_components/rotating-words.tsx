"use client";

import { useEffect, useMemo, useState } from "react";

export function RotatingWords({
  words,
  intervalMs = 1400,
  className,
}: {
  words: string[];
  intervalMs?: number;
  className?: string;
}) {
  const safeWords = useMemo(() => words.filter(Boolean), [words]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (safeWords.length <= 1) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % safeWords.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, safeWords.length]);

  const word = safeWords[idx] ?? "";
  const ariaLabel = safeWords.join(", ");

  return (
    <span className={className} aria-label={ariaLabel}>
      <span
        aria-hidden="true"
        className="inline-flex items-baseline justify-start whitespace-nowrap align-baseline"
        key={word}
      >
        <span
          className="ae-rotateWord"
          style={{
            display: "inline-block",
            minWidth: "10ch",
            willChange: "transform, opacity, filter",
            filter: "drop-shadow(0 0 18px rgba(58,123,255,0.22))",
          }}
        >
          {word}
        </span>
      </span>
      <style>{`
        @keyframes ae-rotateWord {
          0%   { opacity: 0; transform: translateY(10px) skewY(2deg); }
          60%  { opacity: 1; transform: translateY(0) skewY(0deg); }
          100% { opacity: 1; transform: translateY(0) skewY(0deg); }
        }
        .ae-rotateWord { animation: ae-rotateWord 520ms cubic-bezier(.2,.9,.2,1) both; }
      `}</style>
    </span>
  );
}

