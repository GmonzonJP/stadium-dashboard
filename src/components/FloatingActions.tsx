'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, MessageSquare, Info, MessageSquarePlus, Send, CheckCircle } from 'lucide-react';

const FEEDBACK_TYPES = [
  { value: 'mejora', label: 'Mejora', color: 'bg-blue-500' },
  { value: 'bug', label: 'Bug / Error', color: 'bg-red-500' },
  { value: 'solicitud', label: 'Solicitud', color: 'bg-purple-500' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-500' },
] as const;

interface FloatingActionsProps {
  onOpenChat: () => void;
  onOpenDefinitions: () => void;
}

export function FloatingActions({ onOpenChat, onOpenDefinitions }: FloatingActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>('solicitud');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAction = (action: 'chat' | 'definitions' | 'feedback') => {
    setIsExpanded(false);
    if (action === 'chat') onOpenChat();
    if (action === 'definitions') onOpenDefinitions();
    if (action === 'feedback') setShowFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    if (!title.trim() || !description.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          title: title.trim(),
          description: description.trim(),
          page: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setShowFeedback(false);
          setSubmitted(false);
          setTitle('');
          setDescription('');
          setFeedbackType('solicitud');
        }, 2000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = [
    { key: 'chat', icon: <MessageSquare size={18} />, label: 'StadiumGPT', color: 'bg-purple-600 hover:bg-purple-500' },
    { key: 'definitions', icon: <Info size={18} />, label: 'Definiciones', color: 'bg-slate-700 hover:bg-slate-600' },
    { key: 'feedback', icon: <MessageSquarePlus size={18} />, label: 'Feedback', color: 'bg-blue-600 hover:bg-blue-500' },
  ] as const;

  return (
    <>
      {/* FAB group */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Expanded action buttons */}
        <AnimatePresence>
          {isExpanded && actions.map((action, i) => (
            <motion.div
              key={action.key}
              initial={{ opacity: 0, y: 16, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.85 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="bg-slate-900 border border-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                {action.label}
              </span>
              <button
                onClick={() => handleAction(action.key)}
                className={`w-11 h-11 rounded-full ${action.color} text-white flex items-center justify-center shadow-lg transition-colors`}
              >
                {action.icon}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Main toggle button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${
            isExpanded
              ? 'bg-slate-700 hover:bg-slate-600 rotate-45'
              : 'bg-gradient-to-br from-blue-600 to-purple-600 hover:scale-110'
          }`}
          style={{ transition: 'transform 0.2s, background-color 0.2s' }}
        >
          {isExpanded ? <X size={22} className="text-white" /> : <Plus size={22} className="text-white" />}
        </button>
      </div>

      {/* Feedback modal */}
      <AnimatePresence>
        {showFeedback && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => !isSubmitting && setShowFeedback(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-24 right-6 z-50 w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            >
              {submitted ? (
                <div className="p-8 text-center">
                  <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white">Enviado</h3>
                  <p className="text-sm text-slate-400 mt-1">Tu feedback fue registrado correctamente</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Enviar Feedback</h3>
                    <button onClick={() => setShowFeedback(false)} className="text-slate-500 hover:text-white">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo</label>
                      <div className="flex gap-2 flex-wrap">
                        {FEEDBACK_TYPES.map((t) => (
                          <button
                            key={t.value}
                            onClick={() => setFeedbackType(t.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              feedbackType === t.value ? `${t.color} text-white` : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Resumen breve..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detallá qué cambio necesitás, qué funciona mal, o qué te gustaría ver..."
                        rows={4}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        maxLength={1000}
                      />
                      <div className="text-right text-[10px] text-slate-600 mt-0.5">{description.length}/1000</div>
                    </div>
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={!title.trim() || !description.trim() || isSubmitting}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                    >
                      <Send size={14} />
                      {isSubmitting ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
