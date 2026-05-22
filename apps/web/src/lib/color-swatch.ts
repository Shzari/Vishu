const COLOR_SWATCHES: Record<string, string> = {
  beige: "#d6b98c",
  black: "#111111",
  "black-white": "linear-gradient(135deg, #111111 0 49%, #ffffff 50% 100%)",
  blue: "#2563eb",
  "dark-blue": "#1e3a8a",
  "light-blue": "#93c5fd",
  brown: "#7c4a24",
  burgundy: "#7f1d1d",
  cream: "#fff4cf",
  gold: "#d4af37",
  gray: "#8b8b8b",
  green: "#15803d",
  ivory: "#fffff0",
  multicolor: "linear-gradient(135deg, #ef4444 0%, #f59e0b 28%, #10b981 58%, #2563eb 100%)",
  navy: "#172554",
  olive: "#6b7d2a",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#7e22ce",
  red: "#dc2626",
  silver: "#c0c0c0",
  "sky-blue": "#38bdf8",
  white: "#ffffff",
  yellow: "#facc15",
};

const COLOR_ALIASES: Record<string, string> = {
  "e-bardhe": "white",
  "e-zeze": "black",
  "black-and-white": "black-white",
  "black/white": "black-white",
  "mixed-colors": "multicolor",
  "bardhe-e-zi": "black-white",
};

export function getResolvedColorKey(name: string) {
  const key = name.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return COLOR_ALIASES[key] ?? key;
}

export function getColorSwatchStyle(name: string) {
  const key = getResolvedColorKey(name);
  return { background: COLOR_SWATCHES[key] ?? "#f3f4f6" };
}
