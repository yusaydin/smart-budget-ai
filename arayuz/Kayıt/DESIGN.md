---
name: Calm Wealth
colors:
  surface: '#fbf9fa'
  surface-dim: '#dbd9db'
  surface-bright: '#fbf9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f4'
  surface-container: '#efedef'
  surface-container-high: '#e9e8e9'
  surface-container-highest: '#e4e2e3'
  on-surface: '#1b1c1d'
  on-surface-variant: '#43474c'
  inverse-surface: '#303032'
  inverse-on-surface: '#f2f0f2'
  outline: '#74777d'
  outline-variant: '#c4c6cd'
  surface-tint: '#4e6073'
  primary: '#162839'
  on-primary: '#ffffff'
  primary-container: '#2c3e50'
  on-primary-container: '#96a9be'
  inverse-primary: '#b5c8df'
  secondary: '#006b5b'
  on-secondary: '#ffffff'
  secondary-container: '#7cf8dd'
  on-secondary-container: '#007261'
  tertiary: '#362308'
  on-tertiary: '#ffffff'
  tertiary-container: '#4e381c'
  on-tertiary-container: '#c1a17d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4fb'
  primary-fixed-dim: '#b5c8df'
  on-primary-fixed: '#091d2e'
  on-primary-fixed-variant: '#36485b'
  secondary-fixed: '#7cf8dd'
  secondary-fixed-dim: '#5ddbc1'
  on-secondary-fixed: '#00201a'
  on-secondary-fixed-variant: '#005144'
  tertiary-fixed: '#ffddb7'
  tertiary-fixed-dim: '#e3c19b'
  on-tertiary-fixed: '#291802'
  on-tertiary-fixed-variant: '#5a4225'
  background: '#fbf9fa'
  on-background: '#1b1c1d'
  surface-variant: '#e4e2e3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  stack-gap-sm: 8px
  stack-gap-md: 16px
  stack-gap-lg: 24px
  grid-gutter: 12px
  grid-columns: '4'
---

## Brand & Style

The design system is anchored in the concept of "Financial Serenity." It targets a sophisticated demographic of young professionals and high-net-worth individuals who require a tool that feels more like a private wealth advisor than a ledger.

The visual style is **Corporate / Modern** with a curated infusion of **Minimalism** and **Glassmorphism**. By prioritizing high-quality whitespace and a restricted color palette, the UI reduces the cognitive load often associated with financial management. The experience should feel premium, quiet, and exceptionally organized, evoking a sense of trust and control over one’s financial future.

## Colors

The color palette is designed to be communicative without being loud. 
- **Primary (Deep Slate Blue):** Used for primary navigation, headings, and core brand moments to instill a sense of stability.
- **Secondary (Soft Teal):** Reserved for progressive actions, growth indicators, and secondary highlights.
- **Accents:** Semantic colors for positive flow (green) and expenses (red) are slightly desaturated to maintain the premium, "muted" aesthetic of the system.
- **Surfaces:** Utilize a hierarchy of Crisp White for active cards and Ultra-light Gray/Blue for background canvas depth.

## Typography

This design system utilizes **Inter** exclusively to leverage its geometric clarity and exceptional legibility at small sizes. 

For financial data, tabular figures should be enabled if available to ensure currency columns align perfectly. Headlines use a tighter letter-spacing to appear more authoritative and modern. Labels for categories and meta-data should use a slightly heavier weight (Medium or SemiBold) to remain legible against the light gray backgrounds. On mobile, avoid font sizes smaller than 11px to maintain accessibility.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile-first consumption. 
- **The Grid:** A 4-column system with 24px side margins ensures content doesn't feel cramped on modern smartphone displays.
- **Rhythm:** An 8px linear scale governs all spacing. Use 16px (md) for internal component padding and 24px (lg) for vertical spacing between distinct content sections.
- **Whitespace:** Emphasize generous top padding (48px+) for dashboard headers to create the "premium" airy feel requested. Content cards should be separated by 12px gutters when placed side-by-side.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Ambient Shadows**. 

1. **Base Layer:** The canvas uses the background-secondary color (#F4F7F9).
2. **Surface Layer:** White cards (#FFFFFF) sit on the base with an extremely soft, diffused shadow: `0px 4px 20px rgba(44, 62, 80, 0.04)`.
3. **Overlay Layer:** Notifications, navigation bars, and modals utilize **Glassmorphism**. These surfaces should have a `12px` backdrop-blur and a subtle white border at 10% opacity to define the edge against the background.

Avoid heavy black shadows; instead, tint shadows with the Primary color (Slate Blue) to maintain a cohesive, sophisticated atmosphere.

## Shapes

The design system employs a **Rounded** shape language to soften the serious nature of financial data. 

- **Primary Components:** Standard buttons and input fields use a `0.5rem` (8px) radius.
- **Container Elements:** Cards and informational modules use `rounded-lg` (1rem / 16px) to create a soft, friendly container for data.
- **Interaction Highlights:** Small chips or tags use `rounded-xl` (1.5rem / 24px) to distinguish them from larger layout blocks.

## Components

### Buttons
Primary buttons are solid Deep Slate Blue with white text. Secondary buttons use a Soft Teal outline with a 1px border. For destructive actions (e.g., "Delete Transaction"), use a ghost button style with Soft Red text.

### Cards (Wealth Cards)
The core component of the app. These should be white, 16px rounded containers. Use "Headline-MD" for the balance amount and "Label-SM" for the account name. Data visualizations within cards (like sparklines) should use the Secondary Soft Teal.

### Inputs
Text fields are minimalist: a simple 1px border in light gray that shifts to Soft Teal on focus. Use a persistent label in "Label-MD" above the input field.

### Glass Notifications
Floating toast messages or top-bar alerts must use the glassmorphic style (20% white background, blur, thin border). This ensures they appear "on top" of the financial data without feeling heavy.

### List Items
Transaction items should have a consistent height of 64px. Icons for categories (e.g., Food, Rent) should be contained in a 40px circular background with 10% opacity of the primary color. Use "Body-MD" for the transaction name and "Headline-MD" for the currency value.