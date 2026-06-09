/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: "#8b5cf6",
          pink: "#ec4899",
        },
        dark: {
          50:  "#18181b",
          100: "#27272a",
          200: "#3f3f46",
          300: "#52525b",
        },
      },
      fontFamily: {
        sans: ["Inter", "System"],
        heading: ["PlusJakartaSans", "Inter", "System"],
      },
    },
  },
  plugins: [],
};
