'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageSquare, 
    X, 
    Send, 
    Loader2, 
    Bot, 
    User, 
    Sparkles,
    Maximize2,
    Minimize2,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import { useFilters } from '@/context/FilterContext';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

interface ChatPanelProps {
    isFloating?: boolean;
    initialOpen?: boolean;
    onClose?: () => void;
    className?: string;
}

export function ChatPanel({ isFloating = true, initialOpen = false, onClose, className }: ChatPanelProps) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '¡Hola! Soy **StadiumGPT**, tu asistente de análisis de datos. Puedo ayudarte a:\n\n• Analizar ventas y métricas\n• Buscar productos específicos\n• Comparar períodos de tiempo\n• Generar reportes personalizados\n\n¿En qué puedo ayudarte hoy?',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { selectedFilters, filterData } = useFilters();

    // Verificar estado de Ollama
    useEffect(() => {
        async function checkOllama() {
            try {
                const res = await fetch('/api/chat');
                const data = await res.json();
                setOllamaStatus(data.ollama ? 'online' : 'offline');
            } catch {
                setOllamaStatus('offline');
            }
        }
        checkOllama();
    }, []);

    // Auto scroll al final
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Focus en input cuando se abre
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Enviar mensaje
    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        // Crear mensaje de asistente vacío para streaming
        const assistantMessageId = `assistant-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true
        }]);

        try {
            // Preparar mensajes para la API (sin el de bienvenida ni el mensaje vacío de streaming)
            const apiMessages = messages
                .filter(m => m.id !== 'welcome')
                .map(m => ({ role: m.role, content: m.content }));
            
            apiMessages.push({ role: 'user', content: userMessage.content });

            // CAPTURAR TODO EL ESTADO DEL DASHBOARD
            // Obtener métricas principales
            const metricsResponse = await fetch('/api/metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedFilters)
            });
            const metricsData = metricsResponse.ok ? await metricsResponse.json() : null;

            // Obtener datos de comparación
            const comparisonResponse = await fetch('/api/metrics/comparison', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedFilters)
            });
            const comparisonData = comparisonResponse.ok ? await comparisonResponse.json() : null;

            // Obtener top marcas
            const topBrandsResponse = await fetch('/api/metrics/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filters: selectedFilters, groupBy: 'brands' })
            });
            const topBrandsData = topBrandsResponse.ok ? await topBrandsResponse.json() : null;

            // Obtener top productos
            const topProductsResponse = await fetch('/api/metrics/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filters: selectedFilters, groupBy: 'products' })
            });
            const topProductsData = topProductsResponse.ok ? await topProductsResponse.json() : null;

            // Construir snapshot completo del dashboard
            const dashboardSnapshot = {
                periodo: {
                    inicio: selectedFilters.startDate,
                    fin: selectedFilters.endDate
                },
                filtrosActivos: {
                    tiendas: selectedFilters.stores?.length ? 
                        selectedFilters.stores.map(id => filterData.stores.find(s => s.id === id)?.label || id) : 'Todas',
                    marcas: selectedFilters.brands?.length ? 
                        selectedFilters.brands.map(id => filterData.brands.find(b => b.id === id)?.label || id) : 'Todas',
                    categorias: selectedFilters.categories?.length ?
                        selectedFilters.categories.map(id => filterData.categories.find(c => c.id === id)?.label || id) : 'Todas',
                    generos: selectedFilters.genders?.length ?
                        selectedFilters.genders.map(id => filterData.genders.find(g => g.id === id)?.label || id) : 'Todos'
                },
                metricas: metricsData ? {
                    periodoActual: {
                        ventas: metricsData.current?.sales || 0,
                        unidades: metricsData.current?.units || 0,
                        margen: metricsData.current?.margin,
                        markup: metricsData.current?.markup
                    },
                    periodoAnterior: {
                        ventas: metricsData.lastYear?.sales || 0,
                        unidades: metricsData.lastYear?.units || 0
                    },
                    variacionVsAnoAnterior: {
                        ventas: metricsData.growthLY?.sales,
                        unidades: metricsData.growthLY?.units
                    },
                    ytd: {
                        ventas: metricsData.ytd?.sales || 0,
                        unidades: metricsData.ytd?.units || 0,
                        margen: metricsData.ytd?.margin
                    },
                    stock: metricsData.stock || 0
                } : null,
                comparacionSemanal: comparisonData ? {
                    semanaActual: comparisonData.current?.totalUnits || 0,
                    semanaAnterior: comparisonData.previous?.totalUnits || 0,
                    variacion: comparisonData.percentages?.units
                } : null,
                topMarcas: Array.isArray(topBrandsData) ? topBrandsData.slice(0, 10).map((b: any) => ({
                    marca: b.label,
                    ventas: b.sales,
                    unidades: b.units,
                    margen: b.utility || null
                })) : [],
                topProductos: Array.isArray(topProductsData) ? topProductsData.slice(0, 10).map((p: any) => ({
                    producto: p.label,
                    ventas: p.sales,
                    unidades: p.units
                })) : []
            };

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    filters: selectedFilters,
                    filterData,
                    dashboardSnapshot,
                    stream: true
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Error al comunicarse con StadiumGPT');
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream') && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let accumulated = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });

                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() || '';

                    for (const part of parts) {
                        const line = part.split('\n').find(l => l.startsWith('data: '));
                        if (!line) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') {
                            break;
                        }
                        try {
                            const payload = JSON.parse(data);
                            if (payload.error) {
                                throw new Error(payload.error);
                            }
                            if (payload.content) {
                                accumulated += payload.content;
                                setMessages(prev => prev.map(m => 
                                    m.id === assistantMessageId 
                                        ? { ...m, content: accumulated, isStreaming: true }
                                        : m
                                ));
                            }
                        } catch (parseError) {
                            // Ignorar chunks malformados
                        }
                    }
                }

                setMessages(prev => prev.map(m => 
                    m.id === assistantMessageId 
                        ? { ...m, isStreaming: false }
                        : m
                ));
            } else {
                // Fallback a respuesta JSON
                const data = await response.json();
                const responseContent = data.content || data.message?.content || 'Sin respuesta';
                
                setMessages(prev => prev.map(m => 
                    m.id === assistantMessageId 
                        ? { ...m, content: responseContent, isStreaming: false }
                        : m
                ));
            }

        } catch (err) {
            console.error('Chat error:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
            // Remover mensaje vacío de streaming
            setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
        } finally {
            setIsLoading(false);
        }
    };

    // Manejar tecla Enter
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Componente para renderizar markdown con tablas estilizadas
    const MarkdownContent = ({ content }: { content: string }) => (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                // Tablas estilizadas
                table: ({ children }) => (
                    <div className="overflow-x-auto my-3 rounded-lg border border-slate-600">
                        <table className="min-w-full divide-y divide-slate-600 text-xs">
                            {children}
                        </table>
                    </div>
                ),
                thead: ({ children }) => (
                    <thead className="bg-slate-700/50">{children}</thead>
                ),
                tbody: ({ children }) => (
                    <tbody className="divide-y divide-slate-700 bg-slate-800/50">{children}</tbody>
                ),
                tr: ({ children }) => (
                    <tr className="hover:bg-slate-700/30 transition-colors">{children}</tr>
                ),
                th: ({ children }) => (
                    <th className="px-3 py-2 text-left font-semibold text-blue-300 whitespace-nowrap">
                        {children}
                    </th>
                ),
                td: ({ children }) => (
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{children}</td>
                ),
                // Otros elementos
                strong: ({ children }) => (
                    <strong className="font-bold text-white">{children}</strong>
                ),
                em: ({ children }) => (
                    <em className="italic text-slate-300">{children}</em>
                ),
                code: ({ children }) => (
                    <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-400">
                        {children}
                    </code>
                ),
                h1: ({ children }) => (
                    <h1 className="text-lg font-bold text-white mt-3 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                    <h2 className="text-base font-bold text-blue-300 mt-3 mb-2 flex items-center gap-2">
                        {children}
                    </h2>
                ),
                h3: ({ children }) => (
                    <h3 className="text-sm font-semibold text-purple-300 mt-2 mb-1">{children}</h3>
                ),
                ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 my-2 text-slate-300">{children}</ul>
                ),
                ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 my-2 text-slate-300">{children}</ol>
                ),
                li: ({ children }) => (
                    <li className="text-slate-300">{children}</li>
                ),
                p: ({ children }) => (
                    <p className="my-1.5 text-slate-200 leading-relaxed">{children}</p>
                ),
                hr: () => (
                    <hr className="my-3 border-slate-600" />
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );

    // Limpiar chat
    const clearChat = () => {
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: '¡Hola! Soy **StadiumGPT**, tu asistente de análisis de datos. ¿En qué puedo ayudarte?',
            timestamp: new Date()
        }]);
        setError(null);
    };

    // Contenido del chat
    const chatContent = (
        <div className={cn(
            "flex flex-col bg-slate-900 border border-slate-700 shadow-2xl",
            isFloating ? (
                isExpanded 
                    ? "fixed inset-4 z-50 rounded-2xl" 
                    : "w-[420px] h-[600px] rounded-2xl"
            ) : "h-full rounded-none",
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-t-2xl">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">StadiumGPT</h3>
                        <div className="flex items-center space-x-1.5">
                            <span className={cn(
                                "w-2 h-2 rounded-full",
                                ollamaStatus === 'online' ? "bg-green-500" : 
                                ollamaStatus === 'offline' ? "bg-red-500" : "bg-yellow-500 animate-pulse"
                            )} />
                            <span className="text-xs text-slate-400">
                                {ollamaStatus === 'online' ? 'En línea' : 
                                 ollamaStatus === 'offline' ? 'Desconectado' : 'Conectando...'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-1">
                    {isFloating && (
                        <>
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button
                                onClick={clearChat}
                                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                                title="Limpiar chat"
                            >
                                <RefreshCw size={18} />
                            </button>
                            <button
                                onClick={() => { setIsOpen(false); onClose?.(); }}
                                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </>
                    )}
                    {!isFloating && (
                        <Link 
                            href="/"
                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                        >
                            <X size={18} />
                        </Link>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center space-x-2"
                    >
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-sm text-red-400 flex-1">{error}</p>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "flex",
                            message.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        <div className={cn(
                            "flex items-start space-x-2 max-w-[85%]",
                            message.role === 'user' && "flex-row-reverse space-x-reverse"
                        )}>
                            {/* Avatar */}
                            <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                message.role === 'user' 
                                    ? "bg-blue-600" 
                                    : "bg-gradient-to-br from-purple-600 to-blue-600"
                            )}>
                                {message.role === 'user' 
                                    ? <User size={16} className="text-white" />
                                    : <Bot size={16} className="text-white" />
                                }
                            </div>

                            {/* Message Bubble */}
                            <div className={cn(
                                "rounded-2xl px-4 py-2.5",
                                message.role === 'user' 
                                    ? "bg-blue-600 text-white rounded-tr-sm" 
                                    : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700"
                            )}>
                                <div className="text-sm leading-relaxed max-w-none">
                                    <MarkdownContent content={message.content} />
                                </div>
                                {message.isStreaming && (
                                    <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse rounded-sm" />
                                )}
                                <p className="text-[10px] mt-1 opacity-50">
                                    {message.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700 bg-slate-900/50">
                <div className="flex items-end space-x-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={ollamaStatus === 'offline' 
                                ? "Servicio no disponible..." 
                                : "Escribe tu pregunta..."}
                            disabled={isLoading || ollamaStatus === 'offline'}
                            rows={1}
                            className={cn(
                                "w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white",
                                "placeholder:text-slate-500 resize-none",
                                "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "max-h-32"
                            )}
                            style={{
                                minHeight: '44px',
                                height: 'auto'
                            }}
                        />
                    </div>
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading || ollamaStatus === 'offline'}
                        className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            input.trim() && !isLoading
                                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25"
                                : "bg-slate-800 text-slate-500"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                    StadiumGPT puede cometer errores. Verifica la información importante.
                </p>
            </div>
        </div>
    );

    // Si no es flotante, retornar el contenido directamente
    if (!isFloating) {
        return chatContent;
    }

    // Versión flotante con botón
    return (
        <>
            {/* Botón flotante */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className={cn(
                            "fixed bottom-6 right-6 z-50",
                            "w-14 h-14 rounded-full",
                            "bg-gradient-to-br from-blue-600 to-purple-600",
                            "shadow-lg shadow-blue-600/30",
                            "flex items-center justify-center",
                            "hover:scale-110 transition-transform",
                            "group"
                        )}
                    >
                        <MessageSquare className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Panel de chat */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={cn(
                            "fixed z-50",
                            isExpanded ? "" : "bottom-6 right-6"
                        )}
                    >
                        {chatContent}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default ChatPanel;
