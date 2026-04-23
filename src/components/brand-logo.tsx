import * as React from "react";

export function BrandLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? { w: 28, h: 18 } : size === "lg" ? { w: 64, h: 42 } : { w: 52, h: 34 };
  return (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      width={dims.w}
      height={dims.h}
      className={className}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="15" height="32" fill="none" stroke="#0057FF" strokeWidth="2" />
      <rect x="22" y="0" width="15" height="32" fill="#0057FF" />
    </svg>
  );
}

