"use client";

import Image from "next/image";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function SpeleumBrand({ size = "normal" }: { size?: "compact" | "normal" | "large" }) {
  const { theme } = useTheme();
  const logo = theme === "light" ? "/Grafico/Logo Speleum.svg" : "/Grafico/Logo blanco.svg";
  const wordmark = theme === "light" ? "/Grafico/Nombre.svg" : "/Grafico/Nombre-white.svg";
  const dimensions = size === "large" ? "h-14 sm:h-20" : size === "compact" ? "h-6" : "h-8 sm:h-10";

  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Speleum">
      <Image src={logo} alt="" width={42} height={56} className={`${dimensions} w-auto`} style={{ width: "auto" }} />
      <Image src={wordmark} alt="Speleum" width={196} height={32} className={`${dimensions} w-auto`} style={{ width: "auto" }} />
    </span>
  );
}
