'use client';

import React, { useMemo } from 'react';
import { DEPOSITOS_CONFIG } from '@/types/sell-out';

interface TallaData {
  stock: number;
  ventas: number;
}

interface TiendaData {
  id: number;
  nombre: string;
  tallas: Record<string, TallaData>;
  totalStock: number;
  totalVentas: number;
}

interface UnifiedTallaTableProps {
  tallas: string[];
  tiendas: TiendaData[];
  stockCentralPorTalla: Record<string, number>;
}

export function UnifiedTallaTable({
  tallas,
  tiendas,
  stockCentralPorTalla,
}: UnifiedTallaTableProps) {
  // Separar tiendas por tipo
  const { centrales, regulares, outlets } = useMemo(() => {
    const centralIds = DEPOSITOS_CONFIG.central as readonly number[];
    const outletIds = DEPOSITOS_CONFIG.outlet as readonly number[];
    const centrales = tiendas.filter(t => centralIds.includes(t.id));
    const outlets = tiendas.filter(t => outletIds.includes(t.id));
    const regulares = tiendas.filter(
      t => !centralIds.includes(t.id) && !outletIds.includes(t.id)
    );
    return { centrales, regulares, outlets };
  }, [tiendas]);

  // Calcular totales
  const totalesStock = useMemo(() => {
    const totales: Record<string, number> = {};
    for (const talla of tallas) {
      totales[talla] = tiendas.reduce((sum, t) => sum + (t.tallas[talla]?.stock || 0), 0);
    }
    return totales;
  }, [tiendas, tallas]);

  const totalesVentas = useMemo(() => {
    const totales: Record<string, number> = {};
    for (const talla of tallas) {
      totales[talla] = tiendas.reduce((sum, t) => sum + (t.tallas[talla]?.ventas || 0), 0);
    }
    return totales;
  }, [tiendas, tallas]);

  const totalStockGeneral = Object.values(totalesStock).reduce((a, b) => a + b, 0);
  const totalVentasGeneral = Object.values(totalesVentas).reduce((a, b) => a + b, 0);

  // Verificar si una celda debe mostrarse en rojo
  const esCeldaRoja = (tiendaId: number, talla: string, stock: number): boolean => {
    // Solo para tiendas regulares (no central, no outlet)
    const centralIds = DEPOSITOS_CONFIG.central as readonly number[];
    const outletIds = DEPOSITOS_CONFIG.outlet as readonly number[];
    if (centralIds.includes(tiendaId) || outletIds.includes(tiendaId)) {
      return false;
    }
    // Stock 0 en tienda y hay stock en central
    return stock === 0 && (stockCentralPorTalla[talla] || 0) > 0;
  };

  const renderCeldaStock = (tiendaId: number, talla: string, stock: number) => {
    const esRoja = esCeldaRoja(tiendaId, talla, stock);

    if (stock === 0) {
      return (
        <td
          key={talla}
          className={`px-2 py-1.5 text-center text-sm ${
            esRoja ? 'bg-red-100 dark:bg-red-900/30' : ''
          }`}
        >
          {esRoja && (
            <span className="text-red-600 dark:text-red-400 font-medium" title="Sin stock pero hay en Central">
              0
            </span>
          )}
        </td>
      );
    }

    return (
      <td key={talla} className="px-2 py-1.5 text-center text-sm text-gray-700 dark:text-gray-300">
        {stock}
      </td>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden dark:border-gray-700">
      <div className="max-h-[400px] overflow-auto relative">
        <table className="w-full text-sm">
          {/* Header sticky */}
          <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[150px]">
                Tienda
              </th>
              {tallas.map(talla => (
                <th
                  key={talla}
                  className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 min-w-[50px]"
                >
                  {talla}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 min-w-[60px]">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Sección STOCK */}
            <tr className="bg-blue-50 dark:bg-blue-900/20">
              <td
                colSpan={tallas.length + 2}
                className="px-3 py-2 font-semibold text-blue-700 dark:text-blue-400 text-sm"
              >
                STOCK POR TALLA
              </td>
            </tr>

            {/* Central primero */}
            {centrales.map(tienda => (
              <tr key={`stock-${tienda.id}`} className="bg-yellow-50/50 dark:bg-yellow-900/10 border-b dark:border-gray-700">
                <td className="sticky left-0 z-10 bg-yellow-50/50 dark:bg-yellow-900/10 px-3 py-1.5 font-medium text-gray-900 dark:text-white">
                  {tienda.nombre}
                </td>
                {tallas.map(talla => (
                  <td key={talla} className="px-2 py-1.5 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    {tienda.tallas[talla]?.stock || ''}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center font-semibold bg-gray-100 dark:bg-gray-800">
                  {tienda.totalStock}
                </td>
              </tr>
            ))}

            {/* Tiendas regulares */}
            {regulares.map(tienda => (
              <tr key={`stock-${tienda.id}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-1.5 text-gray-700 dark:text-gray-300">
                  {tienda.nombre}
                </td>
                {tallas.map(talla =>
                  renderCeldaStock(tienda.id, talla, tienda.tallas[talla]?.stock || 0)
                )}
                <td className="px-3 py-1.5 text-center font-medium bg-gray-50 dark:bg-gray-800">
                  {tienda.totalStock || ''}
                </td>
              </tr>
            ))}

            {/* Outlets */}
            {outlets.length > 0 && (
              <>
                <tr className="bg-purple-50/50 dark:bg-purple-900/10">
                  <td colSpan={tallas.length + 2} className="px-3 py-1 text-xs text-purple-600 dark:text-purple-400">
                    OUTLET
                  </td>
                </tr>
                {outlets.map(tienda => (
                  <tr key={`stock-${tienda.id}`} className="border-b dark:border-gray-700 bg-purple-50/30 dark:bg-purple-900/5">
                    <td className="sticky left-0 z-10 bg-purple-50/30 dark:bg-purple-900/5 px-3 py-1.5 text-gray-600 dark:text-gray-400">
                      {tienda.nombre}
                    </td>
                    {tallas.map(talla => (
                      <td key={talla} className="px-2 py-1.5 text-center text-sm text-gray-500">
                        {tienda.tallas[talla]?.stock || ''}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-center font-medium bg-gray-50 dark:bg-gray-800">
                      {tienda.totalStock || ''}
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Separador */}
            <tr className="h-2 bg-gray-200 dark:bg-gray-700">
              <td colSpan={tallas.length + 2}></td>
            </tr>

            {/* Sección VENTAS */}
            <tr className="bg-emerald-50 dark:bg-emerald-900/20">
              <td
                colSpan={tallas.length + 2}
                className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400 text-sm"
              >
                VENTAS POR TALLA
              </td>
            </tr>

            {/* Tiendas regulares ventas */}
            {regulares.map(tienda => (
              <tr key={`ventas-${tienda.id}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-1.5 text-gray-700 dark:text-gray-300">
                  {tienda.nombre}
                </td>
                {tallas.map(talla => (
                  <td key={talla} className="px-2 py-1.5 text-center text-sm text-gray-700 dark:text-gray-300">
                    {tienda.tallas[talla]?.ventas || ''}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center font-medium bg-gray-50 dark:bg-gray-800">
                  {tienda.totalVentas || ''}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Footer sticky con totales */}
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-gray-200 dark:bg-gray-700 font-semibold">
              <td className="sticky left-0 z-30 bg-gray-200 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white">
                TOTAL STOCK
              </td>
              {tallas.map(talla => (
                <td key={talla} className="px-2 py-2 text-center text-gray-900 dark:text-white">
                  {totalesStock[talla] || ''}
                </td>
              ))}
              <td className="px-3 py-2 text-center bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200">
                {totalStockGeneral}
              </td>
            </tr>
            <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
              <td className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white">
                TOTAL VENTAS
              </td>
              {tallas.map(talla => (
                <td key={talla} className="px-2 py-2 text-center text-gray-900 dark:text-white">
                  {totalesVentas[talla] || ''}
                </td>
              ))}
              <td className="px-3 py-2 text-center bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200">
                {totalVentasGeneral}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default UnifiedTallaTable;
