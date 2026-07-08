/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1C1B18',
        paper: '#FAF9F6',
        accent: '#2F5D50',
        accentSoft: '#E7EFEC',
        warn: '#B5502B',
      },
    },
  },
  plugins: [],
};
