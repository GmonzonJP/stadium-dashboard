
import { executeQuery } from '../src/lib/db';

async function checkSchema() {
    try {
        const query = `
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Transacciones' AND COLUMN_NAME IN ('IdMarca', 'DescripcionMarca')
        `;
        const result = await executeQuery(query);
        console.log('Schema:', result.recordset);
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
