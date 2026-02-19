import { createContext, useContext } from "react";
import type { DeckTheme } from "@/types/deck";

const ThemeContext = createContext<DeckTheme>({});

export function ThemeProvider({
  theme,
  children,
}: {
  theme: DeckTheme;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): DeckTheme {
  return useContext(ThemeContext);
}

/**
 * Merge theme defaults with element-level style overrides.
 * Resolution: element style > theme style (shallow spread).
 */
export function resolveStyle<T>(
  themeStyle: Partial<T> | undefined,
  elementStyle: Partial<T> | undefined,
): Partial<T> {
  if (!themeStyle) return elementStyle ?? {};
  if (!elementStyle) return themeStyle;
  return { ...themeStyle, ...elementStyle };
}
