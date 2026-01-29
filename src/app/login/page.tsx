'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogIn, Lock, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Verificar si ya está autenticado
        fetch('/api/auth/me')
            .then(res => {
                if (res.ok) {
                    router.push('/');
                }
            })
            .catch(() => {
                // No autenticado, mostrar login
            });
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ usuario, password, rememberMe }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Error al iniciar sesión');
                setIsLoading(false);
                return;
            }

            // Redirigir al dashboard
            router.push('/');
            router.refresh();
        } catch (err) {
            setError('Error de conexión. Intente nuevamente.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-2xl mb-4">
                            <LogIn className="text-blue-400" size={32} />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Stadium Dashboard
                        </h1>
                        <p className="text-slate-400">
                            Inicia sesión para continuar
                        </p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-2"
                        >
                            <AlertCircle className="text-red-400" size={18} />
                            <span className="text-red-400 text-sm">{error}</span>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Usuario
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={usuario}
                                    onChange={(e) => setUsuario(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="Ingresa tu usuario"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="Ingresa tu contraseña"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 bg-slate-900/50 border-slate-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-2"
                            />
                            <label htmlFor="rememberMe" className="ml-2 text-sm text-slate-300">
                                Recordar sesión
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                    <span>Iniciando sesión...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    <span>Iniciar Sesión</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-xs text-slate-500">
                        <p>Versión 1.0.0</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
