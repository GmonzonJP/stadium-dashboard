'use client';

import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FEEDBACK_TYPES = [
  { value: 'mejora', label: 'Mejora', color: 'bg-blue-500' },
  { value: 'bug', label: 'Bug / Error', color: 'bg-red-500' },
  { value: 'solicitud', label: 'Solicitud', color: 'bg-purple-500' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-500' },
] as const;

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<string>('solicitud');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          page: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
          setTitle('');
          setDescription('');
          setType('solicitud');
        }, 2000);
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        title="Enviar feedback"
      >
        <MessageSquarePlus size={20} className="group-hover:scale-110 transition-transform" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => !isSubmitting && setIsOpen(false)} />
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
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Enviar Feedback</h3>
                    <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4">
                    {/* Type selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo</label>
                      <div className="flex gap-2">
                        {FEEDBACK_TYPES.map((t) => (
                          <button
                            key={t.value}
                            onClick={() => setType(t.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              type === t.value
                                ? `${t.color} text-white`
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Title */}
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

                    {/* Description */}
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

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
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
