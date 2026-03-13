'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getProductImageUrl, cn } from '@/lib/utils';
import { useFilters } from '@/context/FilterContext';
import { MobileProductMetrics } from './MobileProductMetrics';
import { MobileStockByStore } from './MobileStockByStore';
import { MobileSizeGrid } from './MobileSizeGrid';

interface MobileProductDetailProps {
    productId: string;
}

function formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
}

function getRitmoLabel(ritmoDiario: number | null): { label: string; color: string } {
    if (ritmoDiario === null || ritmoDiario === 0) return { label: 'SIN VENTAS', color: 'red' };
    if (ritmoDiario >= 2) return { label: 'MUY ALTO', color: 'green' };
    if (ritmoDiario >= 1) return { label: 'ALTO', color: 'green' };
    if (ritmoDiario >= 0.5) return { label: 'MEDIO', color: 'blue' };
    if (ritmoDiario >= 0.1) return { label: 'BAJO', color: 'orange' };
    return { label: 'MUY BAJO', color: 'red' };
}

export function MobileProductDetail({ productId }: MobileProductDetailProps) {
    const router = useRouter();
    const { selectedFilters } = useFilters();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        async function fetchProduct() {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedFilters.startDate) params.set('startDate', selectedFilters.startDate);
                if (selectedFilters.endDate) params.set('endDate', selectedFilters.endDate);

                const response = await fetch(`/api/product/${encodeURIComponent(productId)}?${params.toString()}`);
                if (!response.ok) throw new Error('Error');
                const result = await response.json();
                setData(result);
            } catch (err) {
                console.error('Error fetching product:', err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchProduct();
    }, [productId, selectedFilters.startDate, selectedFilters.endDate]);

    // Build metrics array
    const buildMetrics = () => {
        if (!data) return [];

        const ritmo = getRitmoLabel(data.ritmoDiario);
        const margen = data.margen != null ? data.margen : null;
        const sellThrough = data.unidadesCompradas > 0
            ? ((data.unidadesVendidasDesdeUltCompra / data.unidadesCompradas) * 100)
            : null;

        return [
            {
                label: 'Ritmo',
                value: ritmo.label,
                color: ritmo.color,
            },
            {
                label: 'Días Stock',
                value: data.diasStock != null ? String(Math.round(data.diasStock)) : '-',
                color: data.diasStock != null
                    ? data.diasStock > 180 ? 'red' : data.diasStock > 90 ? 'orange' : 'green'
                    : undefined,
            },
            {
                label: 'Par/Día',
                value: data.ritmoDiario != null ? data.ritmoDiario.toFixed(2) : '-',
            },
            {
                label: 'Margen',
                value: margen != null ? `${margen.toFixed(1)}%` : 'N/A',
                color: margen != null
                    ? margen < 15 ? 'red' : margen >= 30 ? 'green' : 'blue'
                    : undefined,
            },
            {
                label: 'PVP',
                value: data.pvp ? formatCurrency(data.pvp) : '-',
            },
            {
                label: 'Costo',
                value: data.ultimoCosto ? formatCurrency(data.ultimoCosto) : '-',
            },
            {
                label: 'Stock',
                value: String(data.stock || 0),
                color: data.stock > 0 ? 'green' : 'red',
            },
            {
                label: '% Vendido',
                value: sellThrough != null ? `${sellThrough.toFixed(0)}%` : '-',
                color: sellThrough != null
                    ? sellThrough < 50 ? 'orange' : sellThrough >= 80 ? 'green' : 'blue'
                    : undefined,
            },
        ];
    };

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="pb-8">
                {/* Header skeleton */}
                <div className="sticky top-0 z-40 bg-[#020617]/95 backdrop-blur-sm border-b border-slate-800 flex items-center gap-3 px-2 py-3">
                    <button onClick={() => router.back()} className="p-2 text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <ChevronLeft size={22} />
                    </button>
                    <div className="h-5 w-40 bg-slate-800 animate-pulse rounded" />
                </div>
                {/* Image skeleton */}
                <div className="mx-4 mt-4 h-48 bg-slate-800 animate-pulse rounded-2xl" />
                {/* Metrics skeleton */}
                <div className="mt-4">
                    <MobileProductMetrics metrics={[]} loading />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="pb-8">
                <div className="sticky top-0 z-40 bg-[#020617]/95 backdrop-blur-sm border-b border-slate-800 flex items-center gap-3 px-2 py-3">
                    <button onClick={() => router.back()} className="p-2 text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <ChevronLeft size={22} />
                    </button>
                    <span className="text-white font-medium">Producto no encontrado</span>
                </div>
            </div>
        );
    }

    const ventasUnidades = data.ventasPeriodo?.unidades || data.unidadesVendidasDesdeUltCompra || 0;
    const ventasImporte = data.ventasPeriodo?.importe || data.importeVentaDesdeUltCompra || 0;
    const utilidad = data.ventasPeriodo?.utilidad || 0;

    return (
        <div className="pb-8">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-[#020617]/95 backdrop-blur-sm border-b border-slate-800">
                <div className="flex items-center gap-2 px-2 py-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-1 text-slate-400 active:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                            {data.BaseCol}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                            {data.DescripcionMarca}
                        </p>
                    </div>
                </div>
            </div>

            {/* Product Image */}
            <div className="px-4 mt-4">
                <div className="relative bg-slate-800/30 rounded-2xl overflow-hidden flex items-center justify-center" style={{ minHeight: '200px' }}>
                    {!imgError ? (
                        <img
                            src={getProductImageUrl(data.BaseCol)}
                            alt={data.descripcionCorta}
                            className="max-h-[240px] object-contain"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="text-slate-600 text-sm">Sin imagen</div>
                    )}
                </div>

                {/* Related Colors */}
                {data.coloresRelacionados?.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                        {data.coloresRelacionados.map((color: any) => (
                            <button
                                key={color.BaseCol}
                                onClick={() => router.push(`/m/product/${encodeURIComponent(color.BaseCol)}`)}
                                className={cn(
                                    "shrink-0 w-12 h-12 rounded-lg bg-slate-800 overflow-hidden border-2",
                                    color.BaseCol === data.BaseCol ? "border-blue-500" : "border-transparent"
                                )}
                            >
                                <img
                                    src={getProductImageUrl(color.BaseCol)}
                                    alt={color.DescripcionColor}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="px-4 mt-4">
                <h2 className="text-lg font-bold text-white">{data.descripcionCorta}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                    {data.DescripcionClase && (
                        <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
                            {data.DescripcionClase}
                        </span>
                    )}
                    {data.DescripcionGenero && (
                        <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
                            {data.DescripcionGenero}
                        </span>
                    )}
                    {data.DescripcionColor && (
                        <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
                            {data.DescripcionColor}
                        </span>
                    )}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="mt-4">
                <MobileProductMetrics metrics={buildMetrics()} />
            </div>

            {/* Sales Summary */}
            <div className="px-4 mt-4">
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-blue-400 font-semibold uppercase">Unidades</p>
                        <p className="text-lg font-bold text-white tabular-nums">{ventasUnidades.toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-emerald-400 font-semibold uppercase">Ventas</p>
                        <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(ventasImporte)}</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-purple-400 font-semibold uppercase">Utilidad</p>
                        <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(utilidad)}</p>
                    </div>
                </div>
            </div>

            {/* Stock by Store */}
            <div className="mt-5">
                <MobileStockByStore stores={data.sucursales || []} />
            </div>

            {/* Size Grid */}
            <div className="mt-5">
                <MobileSizeGrid tallas={data.tallasData || []} />
            </div>

            {/* Date Info */}
            <div className="px-4 mt-5">
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Últ. Compra</p>
                        <p className="text-xs text-white font-medium mt-1">{data.fechaUltCompraFormatted || '-'}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">1ra Venta</p>
                        <p className="text-xs text-white font-medium mt-1">{data.primeraVentaFormatted || '-'}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">Últ. Venta</p>
                        <p className="text-xs text-white font-medium mt-1">{data.ultimaVentaFormatted || '-'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
