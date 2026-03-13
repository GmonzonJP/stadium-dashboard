'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { MobileProductDetail } from '@/components/mobile/MobileProductDetail';

export default function MobileProductPage() {
    const params = useParams();
    const productId = decodeURIComponent(params.id as string);

    return <MobileProductDetail productId={productId} />;
}
