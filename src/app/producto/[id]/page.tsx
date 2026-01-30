'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Store, Calendar, Package, TrendingUp, DollarSign, Percent, Home, Loader2 } from 'lucide-react';
import { cn, getProductImageUrl } from '@/lib/utils';
import { TallaGaussianOverlayChart } from '@/components/TallaGaussianOverlayChart';
import { ProductInsights } from '@/components/ProductInsights';
import Link from 'next/link';

export default function ProductoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;
    
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Sorting state for tables
    const [sortColumn, setSortColumn] = useState<string>('ttlimporteVenta');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        if (productId) {
            setIsLoading(true);
            setError(null);
            fetch(`/api/product/${productId}?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error('Producto no encontrado');
                    return res.json();
                })
                .then(data => {
                    setData(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error('Error fetching product detail:', err);
                    setError(err.message);
                    setIsLoading(false);
                });
        }
    }, [productId]);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const sortedSucursales = data?.sucursales ? [...data.sucursales].sort((a: any, b: any) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortColumn) {
            case 'descripcion':
                aValue = (a.descripcion || '').toLowerCase();
                bValue = (b.descripcion || '').toLowerCase();
                break;
            case 'ttlstock':
                aValue = Number(a.ttlstock) || 0;
                bValue = Number(b.ttlstock) || 0;
                break;
            case 'ttlunidadesVenta':
                aValue = Number(a.ttlunidadesVenta) || 0;
                bValue = Number(b.ttlunidadesVenta) || 0;
                break;
            case 'ttlimporteVenta':
                aValue = Number(a.ttlimporteVenta) || 0;
                bValue = Number(b.ttlimporteVenta) || 0;
                break;
            default:
                return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        } else {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
    }) : [];

    const stockInicial = data?.stockInicial || 0;
    const unidadesVendidas = data?.unidadesVendidasDesdeUltCompra || 0;
    const stockActual = data?.stock || 0;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-slate-400">Cargando detalle del producto...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-red-400 text-xl">{error}</p>
                    <Link href="/" className="inline-flex items-center space-x-2 text-blue-400 hover:text-blue-300">
                        <Home size={20} />
                        <span>Volver al Dashboard</span>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#020617]/95 backdrop-blur-xl border-b border-slate-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={() => router.back()} 
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                {data?.DescripcionMarca || 'N/A'} {data?.BaseCol || productId}
                            </h1>
                            <p className="text-sm text-slate-400 mt-1">
                                {data?.descripcionCorta || productId} | {data?.DescripcionClase || 'N/A'} | {data?.DescripcionGenero || 'N/A'}
                            </p>
                        </div>
                    </div>
                    <Link 
                        href="/" 
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"
                    >
                        <Home size={18} />
                        <span>Dashboard</span>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="space-y-8">
                    {/* Top Section: Image + Basic Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Product Image */}
                        <div className="lg:col-span-1">
                            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 flex items-center justify-center h-full min-h-[300px]">
                                <img
                                    src={getProductImageUrl(data?.BaseCol || productId)}
                                    alt={data?.descripcionCorta || productId}
                                    className="max-w-full max-h-[400px] object-contain"
                                    onError={(e) => {
                                        e.currentTarget.src = 'https://placehold.co/400x400/1e293b/64748b?text=Sin+Imagen';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Pricing - Row 1: Costo, PVP, ASP */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4">
                                    <div className="text-xs text-blue-400 font-semibold uppercase mb-1">Costo (con IVA)</div>
                                    <div className="text-xl font-bold text-blue-300">
                                        ${Number((data?.ultimoCosto || 0) * 1.22).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4">
                                    <div className="text-xs text-emerald-400 font-semibold uppercase mb-1">PVP Lista</div>
                                    <div className="text-xl font-bold text-emerald-300">
                                        ${Number(data?.pvp || data?.precioVenta || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                                <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-4">
                                    <div className="text-xs text-amber-400 font-semibold uppercase mb-1">ASP (Precio Prom. Venta)</div>
                                    <div className="text-xl font-bold text-amber-300">
                                        {data?.asp 
                                            ? `$${Number(data.asp).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                            : '--'}
                                    </div>
                                    <div className="text-xs text-amber-500/70 mt-1">Ventas / Unidades</div>
                                </div>
                            </div>

                            {/* Pricing - Row 2: Margen, Markup, Días de Stock */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className={`border rounded-xl p-4 ${data?.margen && data.margen > 30 ? 'bg-green-950/30 border-green-900/50' : data?.margen && data.margen > 0 ? 'bg-yellow-950/30 border-yellow-900/50' : 'bg-red-950/30 border-red-900/50'}`}>
                                    <div className={`text-xs font-semibold uppercase mb-1 ${data?.margen && data.margen > 30 ? 'text-green-400' : data?.margen && data.margen > 0 ? 'text-yellow-400' : 'text-red-400'}`}>Margen</div>
                                    <div className={`text-xl font-bold ${data?.margen && data.margen > 30 ? 'text-green-300' : data?.margen && data.margen > 0 ? 'text-yellow-300' : 'text-red-300'}`}>
                                        {data?.margen !== null && data?.margen !== undefined
                                            ? `${Number(data.margen).toFixed(1)}%`
                                            : '--'}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">(Precio-Costo)/Precio</div>
                                </div>
                                <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-4">
                                    <div className="text-xs text-indigo-400 font-semibold uppercase mb-1">Markup</div>
                                    <div className="text-xl font-bold text-indigo-300">
                                        {data?.markup !== null && data?.markup !== undefined
                                            ? `${Number(data.markup).toFixed(1)}%`
                                            : '--'}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">(Precio-Costo)/Costo</div>
                                </div>
                                <div className={`border rounded-xl p-4 ${data?.diasStock && data.diasStock < 30 ? 'bg-red-950/30 border-red-900/50' : data?.diasStock && data.diasStock < 90 ? 'bg-yellow-950/30 border-yellow-900/50' : 'bg-cyan-950/30 border-cyan-900/50'}`}>
                                    <div className={`text-xs font-semibold uppercase mb-1 ${data?.diasStock && data.diasStock < 30 ? 'text-red-400' : data?.diasStock && data.diasStock < 90 ? 'text-yellow-400' : 'text-cyan-400'}`}>Días de Stock</div>
                                    <div className={`text-xl font-bold ${data?.diasStock && data.diasStock < 30 ? 'text-red-300' : data?.diasStock && data.diasStock < 90 ? 'text-yellow-300' : 'text-cyan-300'}`}>
                                        {data?.diasStock !== null && data?.diasStock !== undefined
                                            ? `${data.diasStock} días`
                                            : '--'}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {data?.ritmoDiario ? `${Number(data.ritmoDiario).toFixed(2)} pares/día` : 'Sin ritmo'}
                                    </div>
                                </div>
                            </div>

                            {/* Última Compra y Venta */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-purple-950/30 border border-purple-900/50 rounded-xl p-4">
                                    <div className="text-xs text-purple-400 font-semibold uppercase mb-1">Costo Última Compra</div>
                                    <div className="text-xl font-bold text-purple-300">
                                        ${Number(data?.costoUltimaCompra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-purple-500/70 mt-1">
                                        {data?.stockInicial || 0} unidades × ${Number(data?.ultimoCosto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-4">
                                    <div className="text-xs text-orange-400 font-semibold uppercase mb-1">Venta Desde Última Compra</div>
                                    <div className="text-xl font-bold text-orange-300">
                                        ${Number(data?.importeVentaDesdeUltCompra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-orange-500/70 mt-1">
                                        {data?.unidadesVendidasDesdeUltCompra || 0} unidades vendidas
                                    </div>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-3 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                    <Calendar className="text-slate-500" size={20} />
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium">Primera Venta</div>
                                        <div className="text-sm font-bold text-slate-200">{data?.primeraVentaFormatted || '--'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                    <Package className="text-slate-500" size={20} />
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium">Última Compra</div>
                                        <div className="text-sm font-bold text-slate-200">{data?.fechaUltCompraFormatted || '--'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Venta Vs Stock - Barra de Progreso */}
                            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                                    <TrendingUp className="text-blue-500" size={20} />
                                    <span>Venta Vs Stock</span>
                                </h3>
                                
                                <div className="space-y-4">
                                    {(() => {
                                        const stockComprado = stockInicial;
                                        const stockVendido = unidadesVendidas;
                                        const stockActualVal = data?.stock || 0;
                                        const stockEsperado = stockComprado - stockVendido;
                                        const esReposicion = stockActualVal > stockComprado;
                                        
                                        const stockAdicional = esReposicion ? (stockActualVal - stockComprado) : 0;
                                        const totalBase = stockComprado + stockAdicional;
                                        
                                        const porcentajeVendido = totalBase > 0 ? (stockVendido / totalBase) * 100 : 0;
                                        const porcentajeStockEsperado = totalBase > 0 ? (Math.max(0, stockEsperado) / totalBase) * 100 : 0;
                                        const porcentajeStockAdicional = totalBase > 0 ? (stockAdicional / totalBase) * 100 : 0;
                                        
                                        return (
                                            <>
                                                <div className="relative">
                                                    <div className="h-12 bg-slate-800 rounded-lg overflow-hidden relative border border-slate-700">
                                                        {stockVendido > 0 && (
                                                            <div 
                                                                className="absolute left-0 top-0 h-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm transition-all duration-500 z-10"
                                                                style={{ width: `${Math.min(porcentajeVendido, 100)}%` }}
                                                            >
                                                                {porcentajeVendido > 8 && (
                                                                    <span className="px-2">{stockVendido.toLocaleString()}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {stockEsperado > 0 && (
                                                            <div 
                                                                className="absolute h-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm transition-all duration-500 z-10"
                                                                style={{ 
                                                                    left: `${porcentajeVendido}%`,
                                                                    width: `${Math.min(porcentajeStockEsperado, 100 - porcentajeVendido)}%`
                                                                }}
                                                            >
                                                                {porcentajeStockEsperado > 8 && (
                                                                    <span className="px-2">{stockEsperado.toLocaleString()}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {stockAdicional > 0 && (
                                                            <div 
                                                                className="absolute h-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm transition-all duration-500 z-10 border-l-2 border-orange-400"
                                                                style={{ 
                                                                    left: `${porcentajeVendido + porcentajeStockEsperado}%`,
                                                                    width: `${Math.min(porcentajeStockAdicional, 100 - porcentajeVendido - porcentajeStockEsperado)}%`
                                                                }}
                                                            >
                                                                {porcentajeStockAdicional > 8 && (
                                                                    <span className="px-2">+{stockAdicional.toLocaleString()}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                                                        <span>0</span>
                                                        <span className="font-bold">{totalBase.toLocaleString()} unidades (100%)</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-3">
                                                        <div className="text-xs text-emerald-400 font-semibold mb-1">Vendido</div>
                                                        <div className="text-lg font-bold text-emerald-300">{stockVendido.toLocaleString()}</div>
                                                        <div className="text-xs text-emerald-500/70">{porcentajeVendido.toFixed(1)}%</div>
                                                    </div>
                                                    <div className={`border rounded-lg p-3 ${esReposicion ? 'bg-orange-950/30 border-orange-900/50' : 'bg-blue-950/30 border-blue-900/50'}`}>
                                                        <div className={`text-xs font-semibold mb-1 ${esReposicion ? 'text-orange-400' : 'text-blue-400'}`}>
                                                            {esReposicion ? 'Stock Actual (Reposición)' : 'Stock Actual'}
                                                        </div>
                                                        <div className={`text-lg font-bold ${esReposicion ? 'text-orange-300' : 'text-blue-300'}`}>
                                                            {stockActualVal.toLocaleString()}
                                                        </div>
                                                        <div className={`text-xs ${esReposicion ? 'text-orange-500/70' : 'text-blue-500/70'}`}>
                                                            {totalBase > 0 ? ((stockActualVal / totalBase) * 100).toFixed(1) : 0}%
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                                                        <div className="text-xs text-slate-400 font-semibold mb-1">Comprado</div>
                                                        <div className="text-lg font-bold text-slate-200">{stockComprado.toLocaleString()}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {totalBase > 0 ? ((stockComprado / totalBase) * 100).toFixed(1) : 0}%
                                                        </div>
                                                    </div>
                                                </div>

                                                {esReposicion && (
                                                    <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-3 flex items-center space-x-2">
                                                        <Package className="text-orange-400" size={16} />
                                                        <div className="text-xs text-orange-300">
                                                            <strong>Reposición detectada:</strong> El stock actual ({stockActualVal.toLocaleString()}) es mayor al stock comprado ({stockComprado.toLocaleString()}), 
                                                            indicando que se realizó una reposición de {stockAdicional.toLocaleString()} unidades adicionales.
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comportamiento por Tiendas */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                                <Store className="text-blue-500" size={20} />
                                <span>Comportamiento por Tiendas</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-800/50 border-b border-slate-700">
                                    <tr>
                                        <th className="py-3 px-4 text-left font-bold text-slate-400">Tienda</th>
                                        <th className="py-3 px-4 text-center font-bold text-slate-400">Stock</th>
                                        <th className="py-3 px-4 text-center font-bold text-slate-400">Unidades Venta</th>
                                        <th className="py-3 px-4 text-right font-bold text-slate-400">Importe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedSucursales.map((s: any) => (
                                        <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-4 font-semibold text-slate-200">{s.descripcion}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-full text-xs font-bold",
                                                    s.ttlstock > 0 ? "bg-emerald-900/50 text-emerald-400" : "bg-slate-800 text-slate-500"
                                                )}>
                                                    {s.ttlstock || 0}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-semibold text-slate-200">{s.ttlunidadesVenta || 0}</td>
                                            <td className="py-3 px-4 text-right font-mono text-slate-300">
                                                ${Number(s.ttlimporteVenta || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-800/50 font-bold">
                                        <td className="py-3 px-4 text-slate-200">TOTAL</td>
                                        <td className="py-3 px-4 text-center text-slate-200">
                                            {sortedSucursales.reduce((sum: number, s: any) => sum + (s.ttlstock || 0), 0)}
                                        </td>
                                        <td className="py-3 px-4 text-center text-slate-200">
                                            {sortedSucursales.reduce((sum: number, s: any) => sum + (s.ttlunidadesVenta || 0), 0)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-slate-200">
                                            ${sortedSucursales.reduce((sum: number, s: any) => sum + (s.ttlimporteVenta || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Insights */}
                    {data?.insights && data.insights.length > 0 && (
                        <ProductInsights insights={data.insights} />
                    )}

                    {/* Distribución por Talla */}
                    {data?.tallasData && data.tallasData.length > 0 && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                            <div className="p-6 border-b border-slate-800">
                                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                                    <Package className="text-blue-500" size={20} />
                                    <span>Distribución por Talla</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Campana de Gauss: compara la distribución de cantidades COMPRADAS vs ventas.
                                </p>
                            </div>
                            <div className="p-6">
                                <TallaGaussianOverlayChart tallasData={data.tallasData} height={400} />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
