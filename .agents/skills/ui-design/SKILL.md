# UI Design Skill

This skill provides guidance on implementing UI designs following an 8-bit grid system and responsive design principles.

## 8-Bit Grid System

The 8-bit grid (or 8px grid) is a design system where all spacing, sizing, and layout elements are multiples of 8 pixels. This creates visual harmony and consistency.

Key principles:
- Base unit: 8px
- All margins, padding, width, height, font sizes, etc. should be multiples of 8px
- Common scales: 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, etc.
- Helps with vertical rhythm and consistent spacing
- Makes it easier to align elements and create balanced layouts

## Responsive Design Principles

Responsive design ensures that the UI adapts to different screen sizes and devices.

Key concepts:
- Mobile-first approach: Design for smallest screens first, then enhance for larger screens
- Fluid grids: Use relative units (percentages, fr units) instead of fixed pixels where appropriate
- Flexible images: Images should scale with their containers
- Media queries: Apply different styles at different breakpoints
- Breakpoints: Common breakpoints might be:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px
- Touch considerations: Ensure touch targets are at least 48x48px (or 6x6 in 8px grid units)

## Implementation in CSS/Next.js

Using the 8px grid:
```css
/* Example spacing utilities */
.m-1 { margin: 0.5rem; } /* 8px */
.m-2 { margin: 1rem; }    /* 16px */
.m-3 { margin: 1.5rem; }  /* 24px */
.p-1 { padding: 0.5rem; }
.p-2 { padding: 1rem; }
.p-3 { padding: 1.5rem; }

/Example font sizes*/
.text-xs { font-size: 0.75rem; }   /* 12px */
.text-sm { font-size: 0.875rem; }  /* 14px */
.text-base { font-size: 1rem; }    /* 16px */
.text-lg { font-size: 1.125rem; }  /* 18px */
.text-xl { font-size: 1.25rem; }   /* 20px */
```

For responsive design in Next.js:
- Use Tailwind CSS or similar utility-first CSS framework that supports responsive prefixes
- Example with Tailwind: `class="p-4 md:p-6 lg:p-8"` (padding changes at breakpoints)
- Or use CSS modules with media queries

## Component Integration Patterns

### Integrating Third-Party Components (like Clerk UserButton)
When integrating third-party authentication components:
1. Remove fixed positioning from global layout/auth gate components
2. Integrate the component within existing UI structures (sidebar, header, footer)
3. Use CSS modules to scope styles and prevent conflicts
4. Adjust component dimensions to align with 8px grid (e.g., 32px, 40px, 48px)
5. Consider different states (collapsed/expanded) for responsive layouts

### Authentication Screen Layout
For login/signup screens:
1. Use flexbox or grid for perfect centering (both vertical and horizontal)
2. Apply 8px multiples to all spacing, padding, and dimensions
3. Create responsive breakpoints that maintain grid consistency
4. Ensure touch targets meet minimum 48x48px (6x6 in 8px grid units)
5. Use CSS custom properties or theme variables for consistent values

## Best Practices

1. Start with mobile layout, then add breakpoints for larger screens
2. Keep consistent spacing throughout the application
3. Use the 8px grid for both horizontal and vertical measurements
4. Test on various screen sizes
5. Consider performance - avoid hiding large elements on mobile with CSS alone
6. Ensure accessibility - sufficient touch target size, readable font sizes
7. When integrating third-party components, wrap them in containers that follow your design system
8. Use CSS modules or scoped styling to prevent style conflicts
9. Document spacing values as multiples of your base unit (8px) for team consistency
10. Create reusable utility classes for common spacing patterns (m-1, p-2, etc.)