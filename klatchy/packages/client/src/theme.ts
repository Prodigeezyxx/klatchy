import chalk from "chalk";

export const THEME = {
  bg: "#0d0d12",
  bgAlt: "#15151c",
  bgCard: "#1a1a23",
  border: "#2a2a36",
  borderHi: "#3d3d52",
  text: "#e6e1f0",
  textDim: "#8b87a0",
  textFaint: "#5a566e",
  accent: "#ff6fae",
  accent2: "#a78bfa",
  accent3: "#7fe8d4",
  accent4: "#ffd56b",
  ok: "#7fe8d4",
  warn: "#ffd56b",
  err: "#ff7a8a",
  deep: "#a78bfa",
} as const;

export const HEX = THEME;

export function style(): typeof chalk {
  return chalk;
}
