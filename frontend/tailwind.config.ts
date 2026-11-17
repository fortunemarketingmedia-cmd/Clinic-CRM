import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        surface: 'hsl(var(--surface))',
        // Legacy status palettes are remapped to the clinic's calm semantic colors.
        red: { 50: '#FCF0F1', 100: '#F9DFE2', 200: '#F2C2C8', 300: '#E9A0A9', 400: '#E0808B', 500: '#D96370', 600: '#C84F5D', 700: '#A93A47', 800: '#862F39', 900: '#652530', 950: '#44181f' },
        emerald: { 50: '#EDF7F3', 100: '#D6EEE4', 200: '#B0DECD', 300: '#82C9AF', 500: '#2FA77F', 600: '#24966F', 700: '#1B7A59', 800: '#166247', 900: '#124F3A', 950: '#0a3326' },
        amber: { 50: '#FCF6EA', 100: '#F8EBD2', 200: '#F1D8A8', 300: '#E9C27A', 400: '#E0AC52', 500: '#D99B38', 600: '#C0852A', 700: '#98671D', 800: '#7A5319', 900: '#634416', 950: '#3c2a0c' },
        blue: { 50: '#EEF6FA', 100: '#DCEBF4', 200: '#BCD8EA', 600: '#3B88B5', 700: '#2D7099', 800: '#265C7D' },
        'primary-hover': 'hsl(var(--primary-hover))',
        'primary-soft': 'hsl(var(--primary-soft))',
        deep: 'hsl(var(--deep))',
        success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        warning: { DEFAULT: 'hsl(var(--warning))', soft: 'hsl(var(--warning-soft))' },
        danger: { DEFAULT: 'hsl(var(--danger))', soft: 'hsl(var(--danger-soft))' },
        info: { DEFAULT: 'hsl(var(--info))', soft: 'hsl(var(--info-soft))' },
      },
      boxShadow: { card: 'var(--shadow-card)' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'drawer-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'drawer-in': 'drawer-in 220ms cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;

