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

  // Calcular totales de stock y ventas por talla
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
    const centralIds = DEPOSITOS_CONFIG.central as readonly number[];
    const outletIds = DEPOSITOS_CONFIG.outlet as readonly number[];
    if (centralIds.includes(tiendaId) || outletIds.includes(tiendaId)) {
      return false;
    }
    return stock === 0 && (stockCentralPorTalla[talla] || 0) > 0;
  };

  const renderStockCell = (tiendaId: number, talla: string, stock: number) => {
    const esRoja = esCeldaRoja(tiendaId, talla, stock);

    return (
      <td
        key={`stock-${talla}`}
        className={`px-1.5 py-1 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${
          esRoja ? 'bg-red-100 dark:bg-red-900/30' : ''
        }`}
      >
        {stock === 0 ? (
          esRoja ? (
            <span className="text-red-600 dark:text-red-400 font-medium">0</span>
          ) : (
            <span className="text-gray-300 dark:text-gray-600">-</span>
          )
        ) : (
          <span className="text-gray-700 dark:text-gray-300 font-medium">{stock}</span>
        )}
      </td>
    );
  };

  const renderVentasCell = (talla: string, ventas: number) => {
    return (
      <td
        key={`ventas-${talla}`}
        className="px-1.5 py-1 text-center text-xs"
      >
        {ventas === 0 ? (
          <span className="text-gray-300 dark:text-gray-600">-</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{ventas}</span>
        )}
      </td>
    );
  };

  const renderTiendaRow = (tienda: TiendaData, isCentral: boolean = false, isOutlet: boolean = false) => {
    const bgClass = isCentral
      ? 'bg-yellow-50/50 dark:bg-yellow-900/10'
      : isOutlet
        ? 'bg-purple-50/30 dark:bg-purple-900/5'
        : 'bg-white dark:bg-gray-900';

    return (
      <tr key={tienda.id} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
        <td className={`sticky left-0 z-10 ${bgClass} px-2 py-1.5 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap`}>
          {tienda.nombre}
        </td>
        {/* Stock columns */}
        {tallas.map(talla => renderStockCell(tienda.id, talla, tienda.tallas[talla]?.stock || 0))}
        <td className="px-2 py-1 text-center text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-200 dark:border-blue-800">
          {tienda.totalStock || '-'}
        </td>
        {/* Ventas columns */}
        {tallas.map(talla => renderVentasCell(talla, tienda.tallas[talla]?.ventas || 0))}
        <td className="px-2 py-1 text-center text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
          {tienda.totalVentas || '-'}
        </td>
      </tr>
    );
  };

  return (
    <div className="border rounded-xl overflow-hidden border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-h-[450px] overflow-auto custom-scrollbar">
        <table className="w-full text-sm">
          {/* Double Header: Stock | Ventas */}
          <thead className="sticky top-0 z-20">
            {/* First row: Stock section | Ventas section */}
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th
                rowSpan={2}
                className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 px-2 py-2 text-left text-xs font-bold text-gray-700 dark:text-gray-300 min-w-[120px] border-b border-r border-gray-200 dark:border-gray-700"
              >
                Tienda
              </th>
              <th
                colSpan={tallas.length + 1}
                className="px-2 py-1.5 text-center text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-b border-r-2 border-blue-200 dark:border-blue-800"
              >
                📦 STOCK
              </th>
              <th
                colSpan={tallas.length + 1}
                className="px-2 py-1.5 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-b border-gray-200 dark:border-gray-700"
              >
                💰 VENTAS
              </th>
            </tr>
            {/* Second row: Individual tallas */}
            <tr className="bg-gray-50 dark:bg-gray-800/80">
              {/* Stock tallas */}
              {tallas.map(talla => (
                <th
                  key={`header-stock-${talla}`}
                  className="px-1.5 py-1.5 text-center text-[10px] font-semibold text-gray-600 dark:text-gray-400 min-w-[36px] border-r border-gray-200 dark:border-gray-700"
                >
                  {talla}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 min-w-[40px] border-r-2 border-blue-200 dark:border-blue-800">
                Σ
              </th>
              {/* Ventas tallas */}
              {tallas.map(talla => (
                <th
                  key={`header-ventas-${talla}`}
                  className="px-1.5 py-1.5 text-center text-[10px] font-semibold text-gray-600 dark:text-gray-400 min-w-[36px]"
                >
                  {talla}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20 min-w-[40px]">
                Σ
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Central primero */}
            {centrales.length > 0 && (
              <>
                <tr className="bg-yellow-100/50 dark:bg-yellow-900/20">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-yellow-700 dark:text-yellow-500 uppercase">
                    Central
                  </td>
                </tr>
                {centrales.map(tienda => renderTiendaRow(tienda, true, false))}
              </>
            )}

            {/* Tiendas regulares */}
            {regulares.length > 0 && (
              <>
                <tr className="bg-gray-100/50 dark:bg-gray-800/50">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">
                    Tiendas
                  </td>
                </tr>
                {regulares.map(tienda => renderTiendaRow(tienda, false, false))}
              </>
            )}

            {/* Outlets */}
            {outlets.length > 0 && (
              <>
                <tr className="bg-purple-100/50 dark:bg-purple-900/20">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                    Outlet
                  </td>
                </tr>
                {outlets.map(tienda => renderTiendaRow(tienda, false, true))}
              </>
            )}
          </tbody>

          {/* Footer sticky con totales */}
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-gray-200 dark:bg-gray-700 font-bold border-t-2 border-gray-300 dark:border-gray-600">
              <td className="sticky left-0 z-30 bg-gray-200 dark:bg-gray-700 px-2 py-2 text-xs font-bold text-gray-900 dark:text-white">
                TOTAL
              </td>
              {/* Totales Stock */}
              {tallas.map(talla => (
                <td key={`total-stock-${talla}`} className="px-1.5 py-2 text-center text-xs font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">
                  {totalesStock[talla] || '-'}
                </td>
              ))}
              <td className="px-2 py-2 text-center text-xs font-bold bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 border-r-2 border-blue-300 dark:border-blue-700">
                {totalStockGeneral}
              </td>
              {/* Totales Ventas */}
              {tallas.map(talla => (
                <td key={`total-ventas-${talla}`} className="px-1.5 py-2 text-center text-xs font-bold text-gray-900 dark:text-white">
                  {totalesVentas[talla] || '-'}
                </td>
              ))}
              <td className="px-2 py-2 text-center text-xs font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
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
