'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ComparisonChartProps {
    title: string;
    currentData: Array<{ week: string; unidades?: number; importe?: number }>;
    previousData: Array<{ week: string; unidades?: number; importe?: number }>;
    currentTotal: number;
    previousTotal: number;
    percentage: number;
    type: 'unidades' | 'importe';
    isLoading?: boolean;
}

export function ComparisonChart({
    title,
    currentData,
    previousData,
    currentTotal,
    previousTotal,
    percentage,
    type,
    isLoading
}: ComparisonChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!chartRef.current || isLoading) return;

        // Initialize chart
        if (!chartInstance.current) {
            chartInstance.current = echarts.init(chartRef.current, 'dark');
        }

        const weeks = currentData.map(d => d.week);
        const currentValues = currentData.map(d => type === 'unidades' ? d.unidades || 0 : (d.importe || 0) / 1000000);
        const previousValues = previousData.map(d => type === 'unidades' ? d.unidades || 0 : (d.importe || 0) / 1000000);

        const option: echarts.EChartsOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                formatter: (params: any) => {
                    const current = params.find((p: any) => p.seriesName === 'Actual');
                    const previous = params.find((p: any) => p.seriesName === 'Anterior');
                    let html = `<div style="padding: 8px;"><strong>${current?.axisValue || ''}</strong><br/>`;
                    if (current) {
                        html += `<span style="color: #3b82f6;">●</span> Actual: ${type === 'unidades' 
                            ? current.value.toLocaleString() 
                            : `$${current.value.toFixed(2)}M`}<br/>`;
                    }
                    if (previous) {
                        html += `<span style="color: #475569;">●</span> Anterior: ${type === 'unidades' 
                            ? previous.value.toLocaleString() 
                            : `$${previous.value.toFixed(2)}M`}<br/>`;
                    }
                    html += `</div>`;
                    return html;
                }
            },
            legend: {
                data: ['Actual', 'Anterior'],
                top: 10,
                textStyle: {
                    color: '#94a3b8',
                    fontSize: 12
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: weeks,
                axisLine: {
                    lineStyle: {
                        color: '#334155'
                    }
                },
                axisLabel: {
                    color: '#94a3b8',
                    fontSize: 10,
                    rotate: weeks.length > 10 ? 45 : 0
                }
            },
            yAxis: {
                type: 'value',
                axisLine: {
                    lineStyle: {
                        color: '#334155'
                    }
                },
                axisLabel: {
                    color: '#94a3b8',
                    fontSize: 10,
                    formatter: (value: number) => {
                        if (type === 'importe') {
                            return `$${value.toFixed(1)}M`;
                        }
                        return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: '#1e293b',
                        type: 'dashed'
                    }
                }
            },
            series: [
                {
                    name: 'Actual',
                    type: 'line',
                    data: currentValues,
                    smooth: true,
                    lineStyle: {
                        color: '#3b82f6',
                        width: 2
                    },
                    itemStyle: {
                        color: '#3b82f6'
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
                    }
                },
                {
                    name: 'Anterior',
                    type: 'line',
                    data: previousValues,
                    smooth: true,
                    lineStyle: {
                        color: '#475569',
                        width: 2
                    },
                    itemStyle: {
                        color: '#475569'
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(71, 85, 105, 0.2)' },
                                { offset: 1, color: 'rgba(71, 85, 105, 0.05)' }
                            ]
                        }
                    }
                }
            ]
        };

        chartInstance.current.setOption(option);

        // Handle resize
        const handleResize = () => {
            chartInstance.current?.resize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [currentData, previousData, type, isLoading]);

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <div className="flex items-center space-x-4 mt-2">
                        <div className="text-xs text-slate-500">
                            <span className="font-bold text-white">
                                {type === 'unidades' 
                                    ? currentTotal.toLocaleString() 
                                    : `$${(currentTotal / 1000000).toFixed(2)}M`}
                            </span>
                            {' vs '}
                            <span className="text-slate-600">
                                {type === 'unidades' 
                                    ? previousTotal.toLocaleString() 
                                    : `$${(previousTotal / 1000000).toFixed(2)}M`}
                            </span>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded ${
                            percentage >= 0 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'bg-red-500/10 text-red-400'
                        }`}>
                            {percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
            <div ref={chartRef} className="flex-1 min-h-[300px]" />
        </div>
    );
}
