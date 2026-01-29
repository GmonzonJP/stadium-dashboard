/**
 * Utility functions for handling product sizes (tallas)
 */

/**
 * Extract size from idArticulo by comparing with BaseCol
 * Example: BaseCol = "146.241724846", idArticulo = "146.24172484639.0" -> size = "39.0"
 */
export function extractTalla(idArticulo: string, baseCol: string): string {
    if (!idArticulo || !baseCol) return '';
    if (idArticulo.startsWith(baseCol)) {
        return idArticulo.substring(baseCol.length);
    }
    return '';
}

/**
 * Sort sizes (tallas) in a logical order:
 * - Numeric sizes: 35.0, 36.0, 37.0, etc.
 * - American sizes: 1, 2, 3, 4, 5, 6, X
 * - Clothing sizes: XS, S, M, L, XL, XXL
 */
export function sortTallas(tallas: string[]): string[] {
    const numericSizes: string[] = [];
    const americanSizes: string[] = [];
    const clothingSizes: string[] = [];
    const otherSizes: string[] = [];

    // Clothing size order
    const clothingOrder: Record<string, number> = {
        'XS': 1,
        'S': 2,
        'M': 3,
        'L': 4,
        'XL': 5,
        'XXL': 6,
        'XXXL': 7
    };

    tallas.forEach(talla => {
        const trimmed = talla.trim();
        
        // Check if it's a clothing size
        if (clothingOrder[trimmed.toUpperCase()] !== undefined) {
            clothingSizes.push(trimmed);
        }
        // Check if it's numeric (can be decimal like 35.0 or integer like 35)
        else if (/^\d+\.?\d*$/.test(trimmed)) {
            numericSizes.push(trimmed);
        }
        // Check if it's American size (1-6 or X)
        else if (/^[1-6X]$/i.test(trimmed)) {
            americanSizes.push(trimmed);
        }
        else {
            otherSizes.push(trimmed);
        }
    });

    // Sort numeric sizes
    numericSizes.sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        return numA - numB;
    });

    // Sort American sizes: 1, 2, 3, 4, 5, 6, X
    americanSizes.sort((a, b) => {
        if (a.toUpperCase() === 'X') return 1;
        if (b.toUpperCase() === 'X') return -1;
        return parseInt(a) - parseInt(b);
    });

    // Sort clothing sizes
    clothingSizes.sort((a, b) => {
        const orderA = clothingOrder[a.toUpperCase()] || 999;
        const orderB = clothingOrder[b.toUpperCase()] || 999;
        return orderA - orderB;
    });

    // Combine: numeric first, then clothing, then American, then others
    return [...numericSizes, ...clothingSizes, ...americanSizes, ...otherSizes];
}

/**
 * Get size label for display
 */
export function getTallaLabel(talla: string): string {
    if (!talla) return '';
    return talla.trim() || 'N/A';
}
