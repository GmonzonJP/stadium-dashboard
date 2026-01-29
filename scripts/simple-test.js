// Simple Node.js script to test query generation without imports
const filters = {
    startDate: '2026-01-01',
    endDate: '2026-01-17',
    brands: [9]
};

// Manually replicate the query builder logic
let whereClauses = [];
const prefix = 'T.';

if (filters.startDate) {
    whereClauses.push(`${prefix}Fecha >= '${filters.startDate}'`);
}

if (filters.endDate) {
    whereClauses.push(`${prefix}Fecha <= '${filters.endDate}'`);
}

if (filters.brands?.length) {
    whereClauses.push(`${prefix}IdMarca IN (${filters.brands.join(',')})`);
}

const whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

console.log('Expected WHERE clause:');
console.log(whereString);
console.log('\nFull WHERE clause breakdown:');
whereClauses.forEach((clause, i) => {
    console.log(`  ${i + 1}. ${clause}`);
});
