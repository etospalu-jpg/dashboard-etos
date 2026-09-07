/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './shell.html',
    './app-*.js',
    './supabase-adapter.js'
  ],
  theme: {
    extend: {
      colors: {
        etos: {
          50: '#e8f1ed',
          600: '#0f6248',
          950: '#0b1b15'
        }
      }
    }
  },
  plugins: []
};
