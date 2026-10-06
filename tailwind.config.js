/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lunar: {
          bg: '#050508',
          surface: '#0d0f17',
          card: '#131622',
          border: 'rgba(255, 255, 255, 0.08)',
          glow: 'rgba(0, 240, 255, 0.15)',
          cyan: '#00f0ff',
          violet: '#8a2be2',
          lime: '#a3e635',
          text: '#f1f5f9',
          muted: '#94a3b8',
        }
      },
      boxShadow: {
        'lunar-glow': '0 0 20px -5px rgba(0, 240, 255, 0.25)',
        'violet-glow': '0 0 20px -5px rgba(138, 43, 226, 0.25)',
      }
    },
  },
  plugins: [],
}
