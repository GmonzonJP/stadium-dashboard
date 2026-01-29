'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface TallaData {
    talla: string;
    comprado?: number;
    stock: number;
    ventas: number;
}

interface TallaGaussianOverlayChartProps {
    tallasData: TallaData[];
    width?: number;
    height?: number;
}

export function TallaGaussianOverlayChart({ tallasData, width = 800, height = 400 }: TallaGaussianOverlayChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!chartRef.current || !tallasData || tallasData.length === 0) return;

        if (!chartInstance.current) {
            chartInstance.current = echarts.init(chartRef.current);
        }

        // Sort tallas for proper x-axis ordering
        const sortedTallas = [...tallasData].sort((a, b) => {
            // Try to parse as numbers first
            const numA = parseFloat(a.talla);
            const numB = parseFloat(b.talla);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            // Otherwise string comparison
            return a.talla.localeCompare(b.talla);
        });

        // Prepare data for purchased quantities curve (Gaussian) - use comprado instead of stock
        const compradoData = sortedTallas.map(t => ({
            talla: t.talla,
            value: t.comprado || 0
        }));

        // Prepare data for sales curve (Gaussian)
        const salesData = sortedTallas.map(t => ({
            talla: t.talla,
            value: t.ventas
        }));

        // Find max values for normalization
        const maxComprado = Math.max(...compradoData.map(d => d.value), 1);
        const maxSales = Math.max(...salesData.map(d => d.value), 1);
        const maxValue = Math.max(maxComprado, maxSales);

        // Generate smooth Gaussian curves
        const generateSmoothCurve = (data: { talla: string; value: number }[], useGaussian = true) => {
            const points: number[][] = [];
            const tallas = data.map(d => d.talla);
            
            // For each talla, create a point
            data.forEach((d, idx) => {
                points.push([idx, d.value]);
            });

            // Interpolate between points for smoother curve
            const smoothPoints: number[][] = [];
            for (let i = 0; i < points.length; i++) {
                smoothPoints.push(points[i]);
                if (i < points.length - 1) {
                    // Add intermediate points for smoothness
                    const midX = (points[i][0] + points[i + 1][0]) / 2;
                    const midY = (points[i][1] + points[i + 1][1]) / 2;
                    smoothPoints.push([midX, midY]);
                }
            }

            return smoothPoints;
        };

        const compradoCurve = generateSmoothCurve(compradoData);
        const salesCurve = generateSmoothCurve(salesData);

        // Find peak tallas (tallas with max purchased and max sales)
        const peakCompradoTalla = compradoData.reduce((max, d) => d.value > max.value ? d : max, compradoData[0] || { talla: '', value: 0 });
        const peakSalesTalla = salesData.reduce((max, d) => d.value > max.value ? d : max, salesData[0] || { talla: '', value: 0 });
        const isAligned = peakCompradoTalla.talla === peakSalesTalla.talla;

        const option: echarts.EChartsOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                },
                formatter: (params: any) => {
                    if (Array.isArray(params)) {
                        const compradoParam = params.find((p: any) => p.seriesName === 'Comprado');
                        const salesParam = params.find((p: any) => p.seriesName === 'Ventas');
                        const idx = compradoParam?.dataIndex ?? salesParam?.dataIndex ?? 0;
                        const talla = sortedTallas[idx]?.talla || '';
                        return `
                            <div style="padding: 8px;">
                                <strong>Talla: ${talla}</strong><br/>
                                ${compradoParam ? `Comprado: ${compradoParam.value}` : ''}<br/>
                                ${salesParam ? `Ventas: ${salesParam.value}` : ''}
                            </div>
                        `;
                    }
                    return '';
                }
            },
            legend: {
                data: ['Comprado', 'Ventas'],
                top: 10,
                textStyle: {
                    color: '#64748b'
                }
            },
            grid: {
                left: '10%',
                right: '10%',
                top: '15%',
                bottom: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: sortedTallas.map(t => t.talla),
                axisLabel: {
                    color: '#64748b',
                    fontSize: 12
                },
                axisLine: {
                    lineStyle: {
                        color: '#cbd5e1'
                    }
                }
            },
            yAxis: {
                type: 'value',
                name: 'Cantidad',
                nameTextStyle: {
                    color: '#64748b'
                },
                axisLabel: {
                    color: '#64748b'
                },
                axisLine: {
                    lineStyle: {
                        color: '#cbd5e1'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: '#e2e8f0',
                        type: 'dashed'
                    }
                }
            },
            series: [
                {
                    name: 'Comprado',
                    type: 'line',
                    data: compradoData.map(d => d.value),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: {
                        color: '#3b82f6',
                        width: 3
                    },
                    itemStyle: {
                        color: '#3b82f6',
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
                            ]
                        }
                    },
                    markPoint: {
                        data: [
                            {
                                name: 'Pico Comprado',
                                coord: [sortedTallas.findIndex(t => t.talla === peakCompradoTalla.talla), peakCompradoTalla.value],
                                symbol: 'pin',
                                symbolSize: 50,
                                itemStyle: {
                                    color: '#3b82f6'
                                },
                                label: {
                                    formatter: `Pico: ${peakCompradoTalla.talla}`,
                                    fontSize: 10
                                }
                            }
                        ]
                    }
                },
                {
                    name: 'Ventas',
                    type: 'line',
                    data: salesData.map(d => d.value),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: {
                        color: isAligned ? '#10b981' : '#ef4444',
                        width: 3
                    },
                    itemStyle: {
                        color: isAligned ? '#10b981' : '#ef4444',
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: isAligned ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' },
                                { offset: 1, color: isAligned ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)' }
                            ]
                        }
                    },
                    markPoint: {
                        data: [
                            {
                                name: 'Pico Ventas',
                                coord: [sortedTallas.findIndex(t => t.talla === peakSalesTalla.talla), peakSalesTalla.value],
                                symbol: 'pin',
                                symbolSize: 50,
                                itemStyle: {
                                    color: isAligned ? '#10b981' : '#ef4444'
                                },
                                label: {
                                    formatter: `Pico: ${peakSalesTalla.talla}`,
                                    fontSize: 10
                                }
                            }
                        ]
                    }
                }
            ]
        };

        chartInstance.current.setOption(option);

        // Handle resize
        const handleResize = () => {
            if (chartInstance.current) {
                chartInstance.current.resize();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartInstance.current) {
                chartInstance.current.dispose();
                chartInstance.current = null;
            }
        };
    }, [tallasData, width, height]);

    if (!tallasData || tallasData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                No hay datos de tallas disponibles
            </div>
        );
    }

    const peakCompradoTalla = tallasData.reduce((max, d) => (d.comprado || 0) > (max.comprado || 0) ? d : max, tallasData[0] || { talla: '', comprado: 0 });
    const peakSalesTalla = tallasData.reduce((max, d) => d.ventas > max.ventas ? d : max, tallasData[0] || { talla: '', ventas: 0 });
    const isAligned = peakCompradoTalla.talla === peakSalesTalla.talla;

    return (
        <div className="w-full">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-sm text-slate-700">Comprado</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded ${isAligned ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-slate-700">Ventas</span>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    isAligned 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-red-100 text-red-700'
                }`}>
                    {isAligned 
                        ? '✓ Alineado: Pico en talla ' + peakCompradoTalla.talla
                        : '⚠ Desfasado: Comprado pico ' + peakCompradoTalla.talla + ', Ventas pico ' + peakSalesTalla.talla
                    }
                </div>
            </div>
            <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />
        </div>
    );
}
