/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Matches stcmarketingco.com's own token names/values exactly, so
        // the CRM reads as the same product as the public site.
        ink: '#0B0B0C',
        charcoal: '#16161A',
        graphite: '#232328',
        mist: '#808089',
        fog: '#A3A3AA',
        paper: '#F5F4F1',
        tan: '#C9A06A',
        tanDeep: '#A87F4A',
        pine: '#3F5B48',
        pineLight: '#6B8A72',
        // The brand site has no error/destructive state to borrow (it's a
        // marketing site, not an app) -- this is the one color invented for
        // the CRM, picked to sit alongside tan/pine rather than clash.
        warn: '#E0785A',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
