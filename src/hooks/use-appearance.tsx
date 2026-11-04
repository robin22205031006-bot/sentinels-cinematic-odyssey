import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME, FONT_SCALES, THEMES, themeVars } from "@/lib/themes";

interface Appearance {
  theme: string;
  dark: boolean;
  scaleIndex: number;
  setTheme: (id: string) => void;
  setDark: (d: boolean) => void;
  zoom: (dir: 1 | -1) => void;
}

const Ctx = createContext<Appearance | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [dark, setDark] = useState(true);
  const [scaleIndex, setScale] = useState(2);

  useEffect(() => {
    setTheme(localStorage.getItem("scu-theme-id") ?? DEFAULT_THEME);
    setDark(localStorage.getItem("scu-theme") !== "light");
    const s = Number(localStorage.getItem("scu-scale"));
    if (!Number.isNaN(s) && s >= 0 && s < FONT_SCALES.length && localStorage.getItem("scu-scale")) setScale(s);
  }, []);

  useEffect(() => {
    const t = THEMES.find((x) => x.id === theme) ?? THEMES[0]!;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeVars(t, dark))) root.style.setProperty(k, v);
    root.classList.toggle("dark", dark);
    root.dataset["minimal"] = t.minimal ? "true" : "false";
    root.style.fontSize = `${(FONT_SCALES[scaleIndex] ?? 1) * 100}%`;
    localStorage.setItem("scu-theme-id", theme);
    localStorage.setItem("scu-theme", dark ? "dark" : "light");
    localStorage.setItem("scu-scale", String(scaleIndex));
  }, [theme, dark, scaleIndex]);

  const zoom = (dir: 1 | -1) => setScale((i) => Math.min(FONT_SCALES.length - 1, Math.max(0, i + dir)));

  return <Ctx.Provider value={{ theme, dark, scaleIndex, setTheme, setDark, zoom }}>{children}</Ctx.Provider>;
}

export function useAppearance() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppearance outside provider");
  return v;
}
