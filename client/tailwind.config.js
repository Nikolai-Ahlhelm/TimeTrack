/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#bcdcff",
          300: "#8ec4ff",
          400: "#59a2ff",
          500: "#317dfa",
          600: "#1c5fef",
          700: "#174adc",
          800: "#193db2",
          900: "#1a378c",
        },
      },
    },
  },
  plugins: [],
};
