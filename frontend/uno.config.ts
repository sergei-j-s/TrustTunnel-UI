import { defineConfig, presetUno, presetIcons, presetWebFonts } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetWebFonts({
      fonts: {
        sans: 'Inter:300,400,500,600,700',
        mono: 'JetBrains Mono:400,500',
      },
    }),
  ],
  theme: {
    colors: {
      primary: {
        DEFAULT: '#6366f1',
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#6366f1',
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
      },
      surface: {
        DEFAULT: '#1e1e2e',
        100: '#181825',
        200: '#1e1e2e',
        300: '#313244',
        400: '#45475a',
        500: '#585b70',
      },
      base: '#cdd6f4',
      subtext: '#a6adc8',
      overlay: '#6c7086',
    },
  },
  shortcuts: {
    'btn': 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer border-0',
    'btn-primary': 'btn bg-primary text-white hover:bg-primary-600 active:bg-primary-700',
    'btn-secondary': 'btn bg-surface-300 text-base hover:bg-surface-400',
    'btn-danger': 'btn bg-red-600 text-white hover:bg-red-700',
    'btn-success': 'btn bg-green-600 text-white hover:bg-green-700',
    'btn-sm': 'px-3 py-1.5 text-xs',
    'btn-ghost': 'btn bg-transparent text-subtext hover:bg-surface-300 hover:text-base',
    'card': 'bg-surface-200 rounded-xl border border-surface-300 p-5',
    'card-sm': 'bg-surface-200 rounded-xl border border-surface-300 p-4',
    'input': 'w-full bg-surface-100 border border-surface-400 rounded-lg px-3 py-2 text-base text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors',
    'label': 'block text-xs font-medium text-subtext mb-1',
    'badge': 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
    'badge-green': 'badge bg-green-500/15 text-green-400',
    'badge-red': 'badge bg-red-500/15 text-red-400',
    'badge-yellow': 'badge bg-yellow-500/15 text-yellow-400',
    'badge-blue': 'badge bg-blue-500/15 text-blue-400',
    'sidebar-link': 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
    'divider': 'border-t border-surface-300',
    'stat-card': 'card flex flex-col gap-1',
  },
})
