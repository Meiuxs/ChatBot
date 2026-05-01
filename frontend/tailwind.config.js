/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#fafafa',
        surface: '#ffffff',
        elevated: '#f5f5f5',
        hover: '#f0f0f0',
        primary: '#1a1a1a',
        secondary: '#666666',
        tertiary: '#999999',
        accent: { DEFAULT: '#2563eb', hover: '#1d4ed8', light: '#dbeafe' },
        border: { DEFAULT: '#e5e5e5', strong: '#d4d4d4' },
        danger: { DEFAULT: '#dc2626', hover: '#b91c1c', light: '#fef2f2', border: '#fecaca' },
        success: { DEFAULT: '#16a34a', light: '#dcfce7' },
        warn: { DEFAULT: '#f59e0b', light: '#fffbeb' },
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px' },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 12px rgba(0,0,0,0.08)',
        lg: '0 8px 30px rgba(0,0,0,0.12)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: { base: '15px' },
    },
  },
  plugins: [],
}
