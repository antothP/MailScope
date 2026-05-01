/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#161b22',
        border: '#30363d',
        critical: '#f85149',
        warning: '#d29922',
        success: '#3fb950',
        info: '#58a6ff',
      },
      backgroundColor: {
        base: '#0d1117',
      },
    },
  },
  plugins: [],
}
