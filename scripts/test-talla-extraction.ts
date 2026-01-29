import { extractTalla, sortTallas } from '../src/lib/talla-utils';

// Test cases
const testCases = [
    { baseCol: '146.241724846', idArticulo: '146.24172484639.0', expected: '39.0' },
    { baseCol: '146.241724846', idArticulo: '146.24172484635.0', expected: '35.0' },
    { baseCol: '146.241724846', idArticulo: '146.24172484636.0', expected: '36.0' },
    { baseCol: '051.372279-0202001', idArticulo: '051.372279-020200142.0', expected: '42.0' },
];

console.log('=== Testing Talla Extraction ===');
testCases.forEach(({ baseCol, idArticulo, expected }) => {
    const result = extractTalla(idArticulo, baseCol);
    const pass = result === expected;
    console.log(`${pass ? '✓' : '✗'} BaseCol: ${baseCol}, idArticulo: ${idArticulo}`);
    console.log(`  Expected: ${expected}, Got: ${result}`);
});

console.log('\n=== Testing Talla Sorting ===');
const numericTallas = ['39.0', '35.0', '42.0', '36.0', '40.0'];
const americanTallas = ['X', '3', '1', '6', '2', '4', '5'];
const clothingTallas = ['XL', 'S', 'M', 'XS', 'L'];
const mixedTallas = ['39.0', 'M', '35.0', 'X', 'L', '36.0', '3'];

console.log('Numeric:', sortTallas(numericTallas));
console.log('American:', sortTallas(americanTallas));
console.log('Clothing:', sortTallas(clothingTallas));
console.log('Mixed:', sortTallas(mixedTallas));
