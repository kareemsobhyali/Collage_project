/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
