import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { buildDashboardQuery } from '@/lib/query-builder';
import { FilterParams } from '@/types';

export async function POST(req: NextRequest) {
    try {
        const filters: FilterParams = await req.json();

        if (!filters.startDate || !filters.endDate) {
            return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
        }

        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);

        // Calculate previous period based on comparison mode
        // '52weeks' = 364 days ago (same day of week), 'calendar' = same date -1 year
        const comparisonMode = filters.comparisonMode || '52weeks';
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        let prevStartDate: Date;
        let prevEndDate: Date;

        if (comparisonMode === '52weeks') {
            // 52 weeks = 364 days
            prevStartDate = new Date(startDate);
            prevStartDate.setDate(prevStartDate.getDate() - 364);
            prevEndDate = new Date(endDate);
            prevEndDate.setDate(prevEndDate.getDate() - 364);
        } else {
            // Calendar mode: same dates but -1 year
            prevStartDate = new Date(startDate);
            prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
            prevEndDate = new Date(endDate);
            prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        }

        const prevStartDateStr = prevStartDate.toISOString().split('T')[0];
        const prevEndDateStr = prevEndDate.toISOString().split('T')[0];

        // Query for current period - weekly breakdown
        const currentQuery = `
            SELECT 
                DATEPART(WEEK, Fecha) as weekNumber,
                DATEPART(YEAR, Fecha) as year,
                SUM(Cantidad) as unidades,
                CAST(SUM(Precio) as decimal(18,2)) as importe
            FROM Transacciones
            WHERE Fecha >= '${filters.startDate}' AND Fecha <= '${filters.endDate}'
            ${filters.brands?.length ? `AND IdMarca IN (${filters.brands.join(',')})` : ''}
            ${filters.stores?.length ? `AND IdDeposito IN (${filters.stores.join(',')})` : ''}
            ${filters.categories?.length ? `AND IdClase IN (${filters.categories.join(',')})` : ''}
            ${filters.genders?.length ? `AND idGenero IN (${filters.genders.join(',')})` : ''}
            GROUP BY DATEPART(WEEK, Fecha), DATEPART(YEAR, Fecha)
            ORDER BY year, weekNumber
        `;

        // Query for previous period (52 weeks ago) - weekly breakdown
        const previousQuery = `
            SELECT 
                DATEPART(WEEK, Fecha) as weekNumber,
                DATEPART(YEAR, Fecha) as year,
                SUM(Cantidad) as unidades,
                CAST(SUM(Precio) as decimal(18,2)) as importe
            FROM Transacciones
            WHERE Fecha >= '${prevStartDateStr}' AND Fecha <= '${prevEndDateStr}'
            ${filters.brands?.length ? `AND IdMarca IN (${filters.brands.join(',')})` : ''}
            ${filters.stores?.length ? `AND IdDeposito IN (${filters.stores.join(',')})` : ''}
            ${filters.categories?.length ? `AND IdClase IN (${filters.categories.join(',')})` : ''}
            ${filters.genders?.length ? `AND idGenero IN (${filters.genders.join(',')})` : ''}
            GROUP BY DATEPART(WEEK, Fecha), DATEPART(YEAR, Fecha)
            ORDER BY year, weekNumber
        `;

        const [currentResult, previousResult] = await Promise.all([
            executeQuery(currentQuery),
            executeQuery(previousQuery)
        ]);

        // Format data for charts
        const currentData = currentResult.recordset.map((row: any) => ({
            week: `Semana ${row.weekNumber}`,
            unidades: Number(row.unidades) || 0,
            importe: Number(row.importe) || 0
        }));

        const previousData = previousResult.recordset.map((row: any) => ({
            week: `Semana ${row.weekNumber}`,
            unidades: Number(row.unidades) || 0,
            importe: Number(row.importe) || 0
        }));

        // Calculate totals and percentages
        const currentTotalUnits = currentData.reduce((sum: number, d: any) => sum + d.unidades, 0);
        const previousTotalUnits = previousData.reduce((sum: number, d: any) => sum + d.unidades, 0);
        const currentTotalImporte = currentData.reduce((sum: number, d: any) => sum + d.importe, 0);
        const previousTotalImporte = previousData.reduce((sum: number, d: any) => sum + d.importe, 0);

        const unitsPercentage = previousTotalUnits > 0 
            ? ((currentTotalUnits - previousTotalUnits) / previousTotalUnits) * 100 
            : 0;
        const importePercentage = previousTotalImporte > 0 
            ? ((currentTotalImporte - previousTotalImporte) / previousTotalImporte) * 100 
            : 0;

        return NextResponse.json({
            current: {
                data: currentData,
                totalUnits: currentTotalUnits,
                totalImporte: currentTotalImporte
            },
            previous: {
                data: previousData,
                totalUnits: previousTotalUnits,
                totalImporte: previousTotalImporte
            },
            percentages: {
                units: unitsPercentage,
                importe: importePercentage
            }
        });

    } catch (error) {
        console.error('API Error in comparison route:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
