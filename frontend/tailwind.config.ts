import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#04060d",
          900: "#0a0f1e",
          800: "#101a30",
          700: "#16233f",
        },
        glow: {
          cyan: "#22d3ee",
          violet: "#a78bfa",
          pink: "#f472b6",
          gold: "#ffdb13",
          blue: "#0053d6",
        },
        mist: "#8fa3bf",
        frost: "#e6edf7",
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["Cascadia Code", "JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      boxShadow: {
        float:
          "0 20px 40px rgba(0,0,0,0.05), 0 12px 28px rgba(2,6,23,0.45), 0 2px 6px rgba(2,6,23,0.30)",
        "float-lg":
          "0 28px 56px rgba(0,0,0,0.18), 0 12px 28px rgba(56,189,248,0.10), 0 2px 6px rgba(2,6,23,0.30)",
      },
      transitionTimingFunction: {
        float: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        drift: {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(4%, -6%, 0) scale(1.08)" },
          "100%": { transform: "translate3d(-3%, 5%, 0) scale(0.96)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        drift: "drift 26s ease-in-out infinite alternate",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
