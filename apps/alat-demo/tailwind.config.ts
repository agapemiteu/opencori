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
        wema: {
          purple: "#7c3aed", // You can adjust this to exact Wema brand hex
          light: "#ede9fe",
        },
      },
    },
  },
  plugins: [],
};
export default config;
