'use client';

import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
    stars: number;
}

interface ProductInsightsProps {
    insights: Insight[];
}

export function ProductInsights({ insights }: ProductInsightsProps) {
    if (!insights || insights.length === 0) {
        return null;
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="text-emerald-600" size={20} />;
            case 'warning':
                return <AlertTriangle className="text-orange-600" size={20} />;
            case 'error':
                return <AlertTriangle className="text-red-600" size={20} />;
            case 'info':
                return <Info className="text-blue-600" size={20} />;
            default:
                return <Info className="text-slate-600" size={20} />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'success':
                return 'bg-emerald-50 border-emerald-200';
            case 'warning':
                return 'bg-orange-50 border-orange-200';
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'info':
                return 'bg-blue-50 border-blue-200';
            default:
                return 'bg-slate-50 border-slate-200';
        }
    };

    const getTextColor = (type: string) => {
        switch (type) {
            case 'success':
                return 'text-emerald-900';
            case 'warning':
                return 'text-orange-900';
            case 'error':
                return 'text-red-900';
            case 'info':
                return 'text-blue-900';
            default:
                return 'text-slate-900';
        }
    };

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="text-purple-600" size={24} />
                <h3 className="text-xl font-bold text-purple-900">Consejo Pro</h3>
                <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded-full font-semibold">
                    IA
                </span>
            </div>
            <p className="text-sm text-purple-700 mb-4">
                Insights generados automáticamente basados en el análisis de rotación, stock y ventas
            </p>
            <div className="space-y-3">
                {insights.map((insight, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "border rounded-xl p-4 transition-all hover:shadow-md",
                            getBgColor(insight.type)
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                                {getIcon(insight.type)}
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1">
                                        <h4 className={cn("font-bold text-sm", getTextColor(insight.type))}>
                                            {insight.title}
                                        </h4>
                                        <div className="flex items-center space-x-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={cn(
                                                        "text-xs",
                                                        i < insight.stars ? "text-yellow-500" : "text-slate-300"
                                                    )}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className={cn("text-sm leading-relaxed", getTextColor(insight.type))}>
                                        {insight.message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
