/**
 * Color adjustment utilities for dark mode support
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Calculate relative luminance (for contrast calculations)
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 * Reserved for future contrast ratio calculations
 */
function _getLuminance(rgb: RGB): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Check if current theme is dark mode
 */
export function isDarkMode(): boolean {
  const root = document.documentElement;
  const theme = root.getAttribute('data-theme');

  if (theme === 'dark') return true;
  if (theme === 'light') return false;

  // Auto mode - check system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Adjust highlight color for dark mode
 * - For light/bright colors: darken them for better visibility on dark background
 * - For dark colors: lighten them slightly
 * - Maintain color hue while adjusting lightness and saturation
 */
export function adjustColorForDarkMode(color: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const hsl = rgbToHsl(rgb);
  // const luminance = getLuminance(rgb); // Reserved for future use

  // Adjustment strategy for dark mode:
  // - Very bright colors (L > 70): reduce lightness significantly, reduce saturation slightly
  // - Medium bright colors (L 50-70): reduce lightness moderately
  // - Medium colors (L 30-50): slight adjustment
  // - Dark colors (L < 30): lighten a bit for visibility

  let adjustedHsl = { ...hsl };

  if (hsl.l > 70) {
    // Very bright colors - darken significantly
    adjustedHsl.l = Math.max(30, hsl.l - 35);
    adjustedHsl.s = Math.min(100, hsl.s * 0.9); // Slightly reduce saturation
  } else if (hsl.l > 50) {
    // Medium bright - moderate darkening
    adjustedHsl.l = Math.max(25, hsl.l - 25);
    adjustedHsl.s = Math.min(100, hsl.s * 0.95);
  } else if (hsl.l > 30) {
    // Medium colors - slight darkening
    adjustedHsl.l = Math.max(20, hsl.l - 10);
  } else {
    // Dark colors - lighten for visibility
    adjustedHsl.l = Math.min(40, hsl.l + 15);
    adjustedHsl.s = Math.min(100, hsl.s * 1.1);
  }

  const adjustedRgb = hslToRgb(adjustedHsl);
  return rgbToHex(adjustedRgb);
}

/**
 * Get appropriate highlight color based on current theme
 */
export function getHighlightColor(color: string): string {
  if (!isDarkMode()) {
    return color;
  }
  return adjustColorForDarkMode(color);
}

/**
 * Get appropriate underline color based on current theme
 * (Similar to highlight but may need different adjustment)
 */
export function getUnderlineColor(color: string): string {
  if (!isDarkMode()) {
    return color;
  }

  // For underlines, we want them to be more visible
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const hsl = rgbToHsl(rgb);
  let adjustedHsl = { ...hsl };

  // Make underlines brighter than highlights in dark mode
  if (hsl.l > 60) {
    adjustedHsl.l = Math.max(40, hsl.l - 20);
  } else if (hsl.l > 40) {
    adjustedHsl.l = Math.max(35, hsl.l - 10);
  } else {
    adjustedHsl.l = Math.min(50, hsl.l + 20);
  }

  // Boost saturation for underlines
  adjustedHsl.s = Math.min(100, hsl.s * 1.15);

  const adjustedRgb = hslToRgb(adjustedHsl);
  return rgbToHex(adjustedRgb);
}
