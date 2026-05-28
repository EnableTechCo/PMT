import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#FF0000",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 15, 18, 0.05), 0 1px 3px rgba(15, 15, 18, 0.08)",
        "card-hover":
          "0 4px 12px rgba(15, 15, 18, 0.07), 0 2px 4px rgba(15, 15, 18, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
