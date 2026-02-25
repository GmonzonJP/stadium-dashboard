import { FilterParams } from '@/types';

interface QueryOptions {
    tableAlias?: string;
    searchColumns?: string[];
}

export function buildDashboardQuery(baseQuery: string, filters: FilterParams, options: QueryOptions = {}) {
    let whereClauses = [];
    const prefix = options.tableAlias ? `${options.tableAlias}.` : '';

    if (filters.startDate) {
        whereClauses.push(`${prefix}Fecha >= '${filters.startDate}'`);
    }

    if (filters.endDate) {
        whereClauses.push(`${prefix}Fecha <= '${filters.endDate}'`);
    }

    if (filters.stores?.length) {
        whereClauses.push(`${prefix}IdDeposito IN (${filters.stores.join(',')})`);
    }

    if (filters.brands?.length) {
        const brandClause = `${prefix}IdMarca IN (${filters.brands.join(',')})`;
        whereClauses.push(brandClause);
    }

    if (filters.categories?.length) {
        whereClauses.push(`${prefix}IdClase IN (${filters.categories.join(',')})`);
    }

    if (filters.sections?.length) {
        whereClauses.push(`${prefix}IdSeccion IN (${filters.sections.join(',')})`);
    }

    if (filters.genders?.length) {
        whereClauses.push(`${prefix}idGenero IN (${filters.genders.join(',')})`);
    }

    if (filters.suppliers?.length) {
        const formattedSuppliers = filters.suppliers.map(s => typeof s === 'string' ? `'${s}'` : s);
        whereClauses.push(`${prefix}idProveedor IN (${formattedSuppliers.join(',')})`);
    }

    if (filters.search && options.searchColumns?.length) {
        const searchTerms = filters.search.trim().split(/\s+/);
        const searchClauses = searchTerms.map(term =>
            '(' + options.searchColumns!.map(col => `${col} LIKE '%${term}%'`).join(' OR ') + ')'
        );
        whereClauses.push('(' + searchClauses.join(' AND ') + ')');
    }

    const whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    // Replace placeholder or append to query
    if (baseQuery.includes('{WHERE}')) {
        return baseQuery.replace('{WHERE}', whereString);
    }

    return baseQuery + whereString;
}
