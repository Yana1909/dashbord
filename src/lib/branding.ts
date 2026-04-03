import ColorThief from 'colorthief';

/**
 * Extracts top 5 colors from an image URL.
 * Returns colors as hex strings.
 */
export async function extractBrandingColors(imageUrl: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      const colorThief = new ColorThief();
      try {
        const palette = colorThief.getPalette(img, 5);
        const hexPalette = palette.map((rgb: number[]) => 
          `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`
        );
        resolve(hexPalette);
      } catch (e) {
        console.error("ColorThief failed:", e);
        resolve(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
      }
    };
    
    img.onerror = (e) => {
      console.error("Logo image failed to load:", e);
      resolve(['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
    };
  });
}

/**
 * Determines if a color is "saturated" enough to be a primary color.
 * For simplicity, we just use the first color extracted as primary.
 */
export function getMostSaturated(colors: string[]): string {
    return colors[0] || '#3b82f6';
}
