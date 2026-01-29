

import { buildDashboardQuery } from '../src/lib/query-builder';

const filters = {
    startDate: '2023-01-01',
    endDate: '2023-01-31',
    brands: [9],
    search: 'NIKE'
};

const baseSQL = "SELECT * FROM Transacciones T {WHERE}";

const query = buildDashboardQuery(baseSQL, filters, {
    tableAlias: 'T',
    searchColumns: ['T.DescripcionMarca', 'AR.descripcionCorta']
});

console.log('Query with Search NIKE + Brand Adidas:', query);

const filters2 = { ...filters, search: 'ADIDAS' };
const query2 = buildDashboardQuery(baseSQL, filters2, {
    tableAlias: 'T',
    searchColumns: ['T.DescripcionMarca', 'AR.descripcionCorta']
});

console.log('Query with Search ADIDAS + Brand Adidas:', query2);
