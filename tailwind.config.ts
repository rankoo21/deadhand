import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        chamber: {
          black: "#0A0807",
          bronze: "#221A12",
          oxblood: "#4A1414",
        },
        wax: {
          red: "#C0392B",
          gold: "#F2C14E",
          bronze: "#9C6B3C",
          stone: "#6E6A63",
          bone: "#E8E0CF",
          ember: "#E07A3C",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "0.85", transform: "scale(1)" },
          "25%": { opacity: "1", transform: "scale(1.02)" },
          "50%": { opacity: "0.78", transform: "scale(0.99)" },
          "75%": { opacity: "0.95", transform: "scale(1.01)" },
        },
        sway: {
          "0%, 100%": { transform: "rotate(-7deg)" },
          "50%": { transform: "rotate(7deg)" },
        },
        smoke: {
          "0%": { opacity: "0.5", transform: "translateY(0) scaleX(1)" },
          "100%": { opacity: "0", transform: "translateY(-60px) scaleX(1.8)" },
        },
        drip: {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translateY(22px)", opacity: "0" },
        },
        "turn-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        dust: {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0.12" },
          "50%": { transform: "translateY(-30px) translateX(14px)", opacity: "0.3" },
          "100%": { transform: "translateY(0) translateX(0)", opacity: "0.12" },
        },
      },
      animation: {
        flicker: "flicker 4.5s ease-in-out infinite",
        sway: "sway 6s ease-in-out infinite",
        smoke: "smoke 5s ease-out infinite",
        drip: "drip 5s ease-in infinite",
        "turn-slow": "turn-slow 60s linear infinite",
        dust: "dust 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
