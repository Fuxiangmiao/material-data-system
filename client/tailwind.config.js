/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(217, 91%, 60%)',
          50: 'hsl(217, 91%, 95%)',
          100: 'hsl(217, 91%, 90%)',
          200: 'hsl(217, 91%, 80%)',
          300: 'hsl(217, 91%, 70%)',
          400: 'hsl(217, 91%, 65%)',
          500: 'hsl(217, 91%, 60%)',
          600: 'hsl(217, 91%, 50%)',
          700: 'hsl(217, 91%, 40%)',
          800: 'hsl(217, 91%, 30%)',
          900: 'hsl(217, 91%, 20%)',
        },
      },
      fontFamily: {
        sans: ['Arial', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
