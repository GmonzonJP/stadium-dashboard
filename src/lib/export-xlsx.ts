import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
    header: string;
    accessor: (row: T) => string | number | null | undefined;
}

export interface SheetDefinition<T = any> {
    name: string;
    data: T[];
    columns: ExportColumn<T>[];
}

function getDateSuffix(): string {
    return new Date().toISOString().split('T')[0];
}

function autoFitColumns(ws: XLSX.WorkSheet, data: (string | number | null | undefined)[][]): void {
    if (!data.length) return;
    const colWidths = data[0].map((_, colIdx) => {
        let maxLen = 0;
        for (const row of data) {
            const val = row[colIdx];
            const len = val != null ? String(val).length : 0;
            if (len > maxLen) maxLen = len;
        }
        return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
    });
    ws['!cols'] = colWidths;
}

export function exportToXlsx<T>(
    data: T[],
    columns: ExportColumn<T>[],
    filename: string,
    sheetName: string = 'Datos'
): void {
    const headers = columns.map(c => c.header);
    const rows = data.map(row =>
        columns.map(col => {
            const val = col.accessor(row);
            return val ?? '';
        })
    );

    const allData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(allData);
    autoFitColumns(ws, allData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, `${filename}-${getDateSuffix()}.xlsx`);
}

export function exportMultiSheet(
    sheets: SheetDefinition[],
    filename: string
): void {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
        const headers = sheet.columns.map(c => c.header);
        const rows = sheet.data.map(row =>
            sheet.columns.map(col => {
                const val = col.accessor(row);
                return val ?? '';
            })
        );

        const allData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(allData);
        autoFitColumns(ws, allData);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    XLSX.writeFile(wb, `${filename}-${getDateSuffix()}.xlsx`);
}

/**
 * Export raw rows (pre-formatted arrays) to XLSX.
 * Useful for complex tables like UnifiedTallaTable where data is already structured.
 */
export function exportRawToXlsx(
    sheets: Array<{ name: string; rows: (string | number | null | undefined)[][] }>,
    filename: string
): void {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
        autoFitColumns(ws, sheet.rows);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    XLSX.writeFile(wb, `${filename}-${getDateSuffix()}.xlsx`);
}
