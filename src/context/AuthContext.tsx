'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: number;
    usuario: string;
    email?: string;
    nombre?: string;
    rol: 'admin' | 'usuario' | 'viewer';
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (usuario: string, password: string, rememberMe: boolean) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    // Verificar autenticación al cargar
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include',
                cache: 'no-store'
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            // Silenciar errores en la página de login
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (usuario: string, password: string, rememberMe: boolean) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ usuario, password, rememberMe }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al iniciar sesión');
        }

        setUser(data.user);
        router.push('/');
        router.refresh();
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Error logging out:', error);
        } finally {
            setUser(null);
            router.push('/login');
            router.refresh();
        }
    };

    const refreshUser = async () => {
        await checkAuth();
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
