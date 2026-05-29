import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "SF Pro Text",
          "Segoe UI",
          "sans-serif",
        ],
        display: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0a0a0a",
          soft: "#1c1c1e",
          muted: "#6b7280",
        },
        canvas: {
          DEFAULT: "#fafaf7",
          warm: "#f3efe7",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "fade-in": "fadeIn 220ms ease-out both",
        "fade-up": "fadeUp 260ms cubic-bezier(.2,.7,.2,1) both",
        "pop": "pop 260ms cubic-bezier(.2,.9,.3,1.2) both",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(.98)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
