
async function checkFilters() {
    try {
        const response = await fetch('http://localhost:3000/api/filters');
        const data = await response.json();

        if (data.brands && data.brands.length > 0) {
            const firstBrand = data.brands[0];
            console.log('First Brand:', firstBrand);
            console.log('Type of brand ID:', typeof firstBrand.id);
        } else {
            console.log('No brands found');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

checkFilters();
