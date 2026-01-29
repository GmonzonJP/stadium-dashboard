import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Genera la URL de imagen de producto usando el proxy nginx
 * El proxy redirige /images/* a http://10.108.0.19/Imagenes/*
 */
export function getProductImageUrl(baseCol: string): string {
    return `/images/${baseCol}.jpg`;
}
