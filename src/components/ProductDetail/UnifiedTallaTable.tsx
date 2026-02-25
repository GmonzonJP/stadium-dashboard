'use client';

import React, { useMemo, useCallback } from 'react';
import { exportRawToXlsx } from '@/lib/export-xlsx';
import { ExportButton } from '@/components/ExportButton';

// Función para obtener color del progress bar según sell-through
function getSellThroughColor(sellThrough: number): { bg: string; text: string; bar: string } {
  if (sellThrough >= 70) {
    return {
      bg: 'bg-emerald-100/50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      bar: 'rgba(16, 185, 129, 0.4)' // emerald-500 with opacity
    };
  } else if (sellThrough >= 40) {
    return {
      bg: 'bg-amber-100/50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      bar: 'rgba(245, 158, 11, 0.4)' // amber-500 with opacity
    };
  } else {
    return {
      bg: 'bg-red-100/50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      bar: 'rgba(239, 68, 68, 0.4)' // red-500 with opacity
    };
  }
}

interface TallaData {
  stock: number;
  pendiente: number;
  ventas: number;
}

interface TiendaData {
  id: number;
  nombre: string;
  tallas: Record<string, TallaData>;
  totalStock: number;
  totalPendiente: number;
  totalVentas: number;
}

interface UnifiedTallaTableProps {
  tallas: string[];
  tiendas: TiendaData[];
  stockCentralPorTalla: Record<string, number>;
  productName?: string;
}

// Clasificación de tiendas por nombre
type TipoTienda = 'central' | 'stadium' | 'misscarol' | 'web' | 'saldos' | 'ocultar';

function clasificarTienda(nombre: string, id?: number): TipoTienda {
  const nombreUpper = nombre.toUpperCase().trim();

  // Depósitos centrales: 999 (central) y 998 (recepción) - siempre mostrar en tope
  // Identificar por ID o por nombre que contenga "CENTRAL" o "999" o "998"
  if (id === 999 || id === 998 ||
      nombreUpper.includes('CENTRAL') ||
      nombreUpper.includes('_999') ||
      nombreUpper.includes('_998') ||
      nombreUpper.endsWith('999') ||
      nombreUpper.endsWith('998')) {
    return 'central';
  }

  // Web: empieza con "WEB"
  if (nombreUpper.startsWith('WEB')) {
    return 'web';
  }

  // Saldos (outlet auxiliares): termina con "-SALDOS"
  if (nombreUpper.endsWith('-SALDOS') || nombreUpper.endsWith(' SALDOS')) {
    return 'saldos';
  }

  // Stadium: empieza con "STADIUM"
  if (nombreUpper.startsWith('STADIUM')) {
    return 'stadium';
  }

  // Miss Carol: empieza con "MISSCAROL" o "MISS CAROL"
  if (nombreUpper.startsWith('MISSCAROL') || nombreUpper.startsWith('MISS CAROL')) {
    return 'misscarol';
  }

  // Todo lo demás: ocultar
  return 'ocultar';
}

export function UnifiedTallaTable({
  tallas,
  tiendas,
  stockCentralPorTalla,
  productName,
}: UnifiedTallaTableProps) {
  // Separar tiendas por tipo basado en nombre
  const { central, stadium, misscarol, web, saldos, tiendasVisibles } = useMemo(() => {
    const central: TiendaData[] = [];
    const stadium: TiendaData[] = [];
    const misscarol: TiendaData[] = [];
    const web: TiendaData[] = [];
    const saldos: TiendaData[] = [];

    for (const tienda of tiendas) {
      const tipo = clasificarTienda(tienda.nombre, tienda.id);
      switch (tipo) {
        case 'central':
          central.push(tienda);
          break;
        case 'stadium':
          stadium.push(tienda);
          break;
        case 'misscarol':
          misscarol.push(tienda);
          break;
        case 'web':
          web.push(tienda);
          break;
        case 'saldos':
          saldos.push(tienda);
          break;
        // 'ocultar' no se agrega a ningún grupo
      }
    }

    // Ordenar: central por ID descendente (999 primero), resto alfabéticamente
    central.sort((a, b) => b.id - a.id);
    stadium.sort((a, b) => a.nombre.localeCompare(b.nombre));
    misscarol.sort((a, b) => a.nombre.localeCompare(b.nombre));
    web.sort((a, b) => a.nombre.localeCompare(b.nombre));
    saldos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Tiendas visibles = central primero, luego el resto
    const tiendasVisibles = [...central, ...stadium, ...misscarol, ...web, ...saldos];

    return { central, stadium, misscarol, web, saldos, tiendasVisibles };
  }, [tiendas]);

  // Calcular totales de stock y ventas por talla (excluyendo web para stock)
  const totalesStock = useMemo(() => {
    const totales: Record<string, { stock: number; pendiente: number }> = {};
    // Stock: central, stadium, misscarol, saldos (NO web)
    const tiendasParaStock = [...central, ...stadium, ...misscarol, ...saldos];
    for (const talla of tallas) {
      totales[talla] = {
        stock: tiendasParaStock.reduce((sum, t) => sum + (t.tallas[talla]?.stock || 0), 0),
        pendiente: tiendasParaStock.reduce((sum, t) => sum + (t.tallas[talla]?.pendiente || 0), 0),
      };
    }
    return totales;
  }, [central, stadium, misscarol, saldos, tallas]);

  const totalesVentas = useMemo(() => {
    const totales: Record<string, number> = {};
    // Ventas: todas las tiendas visibles
    for (const talla of tallas) {
      totales[talla] = tiendasVisibles.reduce((sum, t) => sum + (t.tallas[talla]?.ventas || 0), 0);
    }
    return totales;
  }, [tiendasVisibles, tallas]);

  const totalStockGeneral = Object.values(totalesStock).reduce((a, b) => a + b.stock, 0);
  const totalPendienteGeneral = Object.values(totalesStock).reduce((a, b) => a + b.pendiente, 0);
  const totalVentasGeneral = Object.values(totalesVentas).reduce((a, b) => a + b, 0);

  // Calcular sell-through por talla para la fila de totales
  const sellThroughPorTalla = useMemo(() => {
    const result: Record<string, { comprado: number; stock: number; ventas: number; sellThrough: number }> = {};
    for (const talla of tallas) {
      const stock = totalesStock[talla]?.stock || 0;
      const ventas = totalesVentas[talla] || 0;
      const comprado = stock + ventas; // Lo que teníamos originalmente
      const sellThrough = comprado > 0 ? (ventas / comprado) * 100 : 0;
      result[talla] = { comprado, stock, ventas, sellThrough };
    }
    return result;
  }, [tallas, totalesStock, totalesVentas]);

  // Sell-through general
  const sellThroughGeneral = useMemo(() => {
    const comprado = totalStockGeneral + totalVentasGeneral;
    return comprado > 0 ? (totalVentasGeneral / comprado) * 100 : 0;
  }, [totalStockGeneral, totalVentasGeneral]);

  const handleExport = useCallback(() => {
    const stockHeaders: (string | number)[] = ['Tienda', ...tallas.map(t => `Stock ${t}`), 'Total Stock', ...tallas.map(t => `Ventas ${t}`), 'Total Ventas'];
    const stockRows: (string | number | null)[][] = tiendasVisibles.map(t => {
      const tipo = clasificarTienda(t.nombre, t.id);
      const isWeb = tipo === 'web';
      return [
        t.nombre,
        ...tallas.map(talla => isWeb ? '' as any : (t.tallas[talla]?.stock || 0)),
        isWeb ? '' as any : t.totalStock,
        ...tallas.map(talla => t.tallas[talla]?.ventas || 0),
        t.totalVentas,
      ];
    });
    // Add totals row
    stockRows.push([
      'TOTAL',
      ...tallas.map(t => totalesStock[t]?.stock || 0),
      totalStockGeneral,
      ...tallas.map(t => totalesVentas[t] || 0),
      totalVentasGeneral,
    ]);

    exportRawToXlsx(
      [{ name: 'Stock y Ventas', rows: [stockHeaders, ...stockRows] }],
      `stock-tallas${productName ? `-${productName}` : ''}`
    );
  }, [tallas, tiendasVisibles, totalesStock, totalesVentas, totalStockGeneral, totalVentasGeneral, productName]);

  // Verificar si una celda debe mostrarse en rojo (stock 0 pero hay en central/deposito principal)
  const esCeldaRoja = (tienda: TiendaData, talla: string, stock: number): boolean => {
    const tipo = clasificarTienda(tienda.nombre);
    // No marcar en rojo: web, saldos
    if (tipo === 'web' || tipo === 'saldos') {
      return false;
    }
    return stock === 0 && (stockCentralPorTalla[talla] || 0) > 0;
  };

  const renderStockCell = (tienda: TiendaData, talla: string, stock: number, pendiente: number = 0) => {
    const esRoja = esCeldaRoja(tienda, talla, stock);

    return (
      <td
        key={`stock-${talla}`}
        className={`px-1.5 py-1 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${
          esRoja ? 'bg-red-100 dark:bg-red-900/30' : ''
        }`}
      >
        <div className="flex items-center justify-center gap-0.5">
          {stock === 0 ? (
            esRoja ? (
              <span className="text-red-600 dark:text-red-400 font-medium">0</span>
            ) : (
              <span className="text-gray-300 dark:text-gray-600">-</span>
            )
          ) : (
            <span className="text-gray-700 dark:text-gray-300 font-medium">{stock}</span>
          )}
          {pendiente > 0 && (
            <span className="text-blue-500 dark:text-blue-400 text-[10px] font-semibold">+{pendiente}</span>
          )}
        </div>
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

  const renderTiendaRow = (tienda: TiendaData, tipo: TipoTienda) => {
    const isWeb = tipo === 'web';
    const isSaldos = tipo === 'saldos';
    const isMissCarol = tipo === 'misscarol';
    const isCentral = tipo === 'central';

    const bgClass = isCentral
      ? 'bg-amber-50/30 dark:bg-amber-900/5'
      : isSaldos
        ? 'bg-purple-50/30 dark:bg-purple-900/5'
        : isWeb
          ? 'bg-cyan-50/30 dark:bg-cyan-900/5'
          : isMissCarol
            ? 'bg-pink-50/30 dark:bg-pink-900/5'
            : 'bg-white dark:bg-gray-900';

    return (
      <tr key={tienda.id} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
        <td className={`sticky left-0 z-10 ${bgClass} px-2 py-1.5 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap`}>
          {tienda.nombre}
        </td>
        {/* Stock columns - ocultar para tiendas web */}
        {tallas.map(talla => isWeb ? (
          <td key={`stock-${talla}`} className="px-1.5 py-1 text-center text-xs text-gray-300 dark:text-gray-600">-</td>
        ) : renderStockCell(tienda, talla, tienda.tallas[talla]?.stock || 0, tienda.tallas[talla]?.pendiente || 0))}
        <td className="px-2 py-1 text-center text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-200 dark:border-blue-800">
          {isWeb ? '-' : (
            <div className="flex items-center justify-center gap-0.5">
              <span>{tienda.totalStock || '-'}</span>
              {tienda.totalPendiente > 0 && (
                <span className="text-blue-500 dark:text-blue-400 text-[10px]">+{tienda.totalPendiente}</span>
              )}
            </div>
          )}
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
      <div className="flex items-center justify-end px-3 pt-2">
        <ExportButton onClick={handleExport} disabled={tiendasVisibles.length === 0} />
      </div>
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
            {/* Depósitos Centrales (999, 998) - siempre en tope */}
            {central.length > 0 && (
              <>
                <tr className="bg-amber-100/50 dark:bg-amber-900/20">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                    Depósitos Centrales
                  </td>
                </tr>
                {central.map(tienda => renderTiendaRow(tienda, 'central'))}
              </>
            )}

            {/* Stadium */}
            {stadium.length > 0 && (
              <>
                <tr className="bg-blue-100/50 dark:bg-blue-900/20">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">
                    Stadium
                  </td>
                </tr>
                {stadium.map(tienda => renderTiendaRow(tienda, 'stadium'))}
              </>
            )}

            {/* Miss Carol */}
            {misscarol.length > 0 && (
              <>
                <tr className="bg-pink-100/50 dark:bg-pink-900/20">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-pink-700 dark:text-pink-400 uppercase">
                    Miss Carol
                  </td>
                </tr>
                {misscarol.map(tienda => renderTiendaRow(tienda, 'misscarol'))}
              </>
            )}

            {/* Saldos (Outlet auxiliares) */}
            {saldos.length > 0 && (
              <>
                <tr className="bg-purple-100/50 dark:bg-purple-900/20">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                    Depósitos Saldos
                  </td>
                </tr>
                {saldos.map(tienda => renderTiendaRow(tienda, 'saldos'))}
              </>
            )}

            {/* Web (solo ventas, sin stock) */}
            {web.length > 0 && (
              <>
                <tr className="bg-cyan-100/50 dark:bg-cyan-900/20">
                  <td colSpan={tallas.length * 2 + 3} className="px-2 py-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase">
                    Web (solo ventas)
                  </td>
                </tr>
                {web.map(tienda => renderTiendaRow(tienda, 'web'))}
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
                  <div className="flex items-center justify-center gap-0.5">
                    <span>{totalesStock[talla]?.stock || '-'}</span>
                    {totalesStock[talla]?.pendiente > 0 && (
                      <span className="text-blue-500 dark:text-blue-400 text-[10px]">+{totalesStock[talla].pendiente}</span>
                    )}
                  </div>
                </td>
              ))}
              <td className="px-2 py-2 text-center text-xs font-bold bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 border-r-2 border-blue-300 dark:border-blue-700">
                <div className="flex items-center justify-center gap-0.5">
                  <span>{totalStockGeneral}</span>
                  {totalPendienteGeneral > 0 && (
                    <span className="text-blue-600 dark:text-blue-300 text-[10px]">+{totalPendienteGeneral}</span>
                  )}
                </div>
              </td>
              {/* Totales Ventas con Progress Bar */}
              {tallas.map(talla => {
                const data = sellThroughPorTalla[talla];
                const colors = getSellThroughColor(data.sellThrough);
                const hasData = data.comprado > 0;

                return (
                  <td
                    key={`total-ventas-${talla}`}
                    className="px-1.5 py-2 text-center text-xs font-bold relative group cursor-help"
                    style={hasData ? {
                      background: `linear-gradient(to right, ${colors.bar} ${data.sellThrough}%, transparent ${data.sellThrough}%)`
                    } : undefined}
                  >
                    <span className={hasData ? colors.text : 'text-gray-900 dark:text-white'}>
                      {data.ventas || '-'}
                    </span>
                    {/* Tooltip */}
                    {hasData && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-400 dark:text-gray-600">📦 Comprado:</span>
                            <span className="font-bold">{data.comprado}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-400 dark:text-gray-600">📊 Stock:</span>
                            <span className="font-bold">{data.stock}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-400 dark:text-gray-600">💰 Ventas:</span>
                            <span className="font-bold">{data.ventas}</span>
                          </div>
                          <div className="border-t border-gray-700 dark:border-gray-300 mt-1 pt-1 flex justify-between gap-3">
                            <span className="text-gray-400 dark:text-gray-600">📈 Sell-through:</span>
                            <span className={`font-bold ${data.sellThrough >= 70 ? 'text-emerald-400' : data.sellThrough >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                              {data.sellThrough.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                      </div>
                    )}
                  </td>
                );
              })}
              {/* Total General Ventas con Progress Bar */}
              {(() => {
                const colors = getSellThroughColor(sellThroughGeneral);
                const compradoGeneral = totalStockGeneral + totalVentasGeneral;
                return (
                  <td
                    className="px-2 py-2 text-center text-xs font-bold relative group cursor-help"
                    style={{
                      background: `linear-gradient(to right, ${colors.bar} ${sellThroughGeneral}%, rgba(16, 185, 129, 0.15) ${sellThroughGeneral}%)`
                    }}
                  >
                    <span className={colors.text}>{totalVentasGeneral}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-bold text-center mb-1 text-[11px]">TOTAL GENERAL</div>
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-400 dark:text-gray-600">📦 Comprado:</span>
                          <span className="font-bold">{compradoGeneral}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-400 dark:text-gray-600">📊 Stock:</span>
                          <span className="font-bold">{totalStockGeneral}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-400 dark:text-gray-600">💰 Ventas:</span>
                          <span className="font-bold">{totalVentasGeneral}</span>
                        </div>
                        <div className="border-t border-gray-700 dark:border-gray-300 mt-1 pt-1 flex justify-between gap-3">
                          <span className="text-gray-400 dark:text-gray-600">📈 Sell-through:</span>
                          <span className={`font-bold ${sellThroughGeneral >= 70 ? 'text-emerald-400' : sellThroughGeneral >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                            {sellThroughGeneral.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                    </div>
                  </td>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default UnifiedTallaTable;
