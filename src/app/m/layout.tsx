'use client';

import React, { useEffect } from 'react';
import { useFilters } from '@/context/FilterContext';

function formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
    const { setSelectedFilters } = useFilters();

    // Override FilterContext dates to TODAY on mobile mount
    useEffect(() => {
        const today = formatDateLocal(new Date());
        setSelectedFilters(prev => ({
            ...prev,
            startDate: today,
            endDate: today,
        }));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="theme-color" content="#020617" />
            </head>
            <div
                className="min-h-screen bg-[#020617] text-slate-200"
                style={{
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    paddingLeft: 'env(safe-area-inset-left)',
                    paddingRight: 'env(safe-area-inset-right)',
                }}
            >
                {children}
            </div>
        </>
    );
}
