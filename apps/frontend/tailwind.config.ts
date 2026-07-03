import type { Config } from "tailwindcss";
import { tokens } from "./src/design-tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: tokens.colors.paper,
        foreground: tokens.colors.ink,
        card: tokens.colors.surface,
        'card-foreground': tokens.colors.ink,
        popover: tokens.colors.surface,
        'popover-foreground': tokens.colors.ink,
        primary: {
          DEFAULT: tokens.colors.navy,
          foreground: tokens.colors.surface,
        },
        secondary: {
          DEFAULT: "transparent",
          foreground: tokens.colors.ink,
        },
        muted: {
          DEFAULT: tokens.colors.paper,
          foreground: tokens.colors['ink-muted'],
        },
        accent: {
          DEFAULT: tokens.colors.paper,
          foreground: tokens.colors.ink,
        },
        destructive: {
          DEFAULT: tokens.colors['audit-red'],
          foreground: tokens.colors.surface,
        },
        border: tokens.colors.rule,
        input: tokens.colors.rule,
        ring: tokens.colors.navy,
        paper: tokens.colors.paper,
        surface: tokens.colors.surface,
        ink: tokens.colors.ink,
        'ink-muted': tokens.colors['ink-muted'],
        rule: tokens.colors.rule,
        navy: tokens.colors.navy,
        'audit-red': tokens.colors['audit-red'],
        verdigris: tokens.colors.verdigris,
        'risk-high': tokens.colors['risk-high'],
        'risk-medium': tokens.colors['risk-medium'],
      },
      fontFamily: {
        sans: ['var(--font-ibm-plex-sans)', 'sans-serif'],
        serif: ['var(--font-source-serif)', 'serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      borderRadius: {
        lg: "6px",
        md: "6px",
        sm: "4px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
