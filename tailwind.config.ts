import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        page: "#f7f7f8",
        border: "#e5e5e8",
        muted: "#6b6b70",
        accent: {
          DEFAULT: "#e90d41",
          hover: "#c90a37",
          light: "#fde7ec",
        },
        success: {
          DEFAULT: "#15803d",
          light: "#e3f5e9",
        },
        warning: {
          DEFAULT: "#b45309",
          light: "#fef3c7",
        },
        danger: {
          DEFAULT: "#e11d48",
          light: "#ffe4e8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(10 10 10 / 0.04), 0 2px 8px 0 rgb(10 10 10 / 0.05)",
        softer: "0 1px 2px 0 rgb(10 10 10 / 0.03)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
      keyframes: {
        flow: {
          "0%": { transform: "translateY(-10%)", opacity: "0" },
          "15%": { opacity: "1" },
          "85%": { opacity: "1" },
          "100%": { transform: "translateY(110%)", opacity: "0" },
        },
      },
      animation: {
        flow: "flow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
