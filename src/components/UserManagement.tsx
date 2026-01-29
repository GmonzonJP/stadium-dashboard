'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Edit, Trash2, Save, User, Mail, Lock, Shield, Check, X as XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

interface UserData {
    id: number;
    usuario: string;
    email?: string;
    nombre?: string;
    rol: 'admin' | 'usuario' | 'viewer';
    activo: boolean;
    fechaCreacion?: string;
    ultimoAcceso?: string;
}

export function UserManagement({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        usuario: '',
        password: '',
        email: '',
        nombre: '',
        rol: 'usuario' as 'admin' | 'usuario' | 'viewer'
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && user?.rol === 'admin') {
            fetchUsers();
        }
    }, [isOpen, user]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Error al cargar usuarios');
            const data = await response.json();
            setUsers(data.users || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Error al cargar usuarios');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUser = async () => {
        setError('');
        if (!formData.usuario || !formData.password) {
            setError('Usuario y contraseña son requeridos');
            return;
        }

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error al crear usuario');
            }

            setShowAddForm(false);
            setFormData({ usuario: '', password: '', email: '', nombre: '', rol: 'usuario' });
            fetchUsers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al crear usuario');
        }
    };

    const handleUpdateUser = async (userId: number, updates: Partial<UserData> & { password?: string }) => {
        setError('');
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al actualizar usuario');
            }

            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al actualizar usuario');
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al eliminar usuario');
            }

            fetchUsers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
        }
    };

    // Solo mostrar si es admin y está abierto
    if (user?.rol !== 'admin' || !isOpen) {
        return null;
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
            />
            <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-4 bg-slate-900 rounded-3xl z-[110] shadow-2xl flex flex-col overflow-hidden border border-slate-800"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Shield className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Gestión de Usuarios</h2>
                            <p className="text-sm text-slate-400">Administra los usuarios del sistema</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Add User Button */}
                    {!showAddForm && (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="mb-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            <span>Agregar Usuario</span>
                        </button>
                    )}

                    {/* Add User Form */}
                    <AnimatePresence>
                        {showAddForm && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl"
                            >
                                <h3 className="text-lg font-semibold text-white mb-4">Nuevo Usuario</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Usuario *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.usuario}
                                            onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="nombre_usuario"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Contraseña *
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="usuario@ejemplo.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Nombre
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.nombre}
                                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Nombre Completo"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Rol
                                        </label>
                                        <select
                                            value={formData.rol}
                                            onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="usuario">Usuario</option>
                                            <option value="admin">Administrador</option>
                                            <option value="viewer">Visualizador</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 mt-4">
                                    <button
                                        onClick={handleAddUser}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center space-x-2"
                                    >
                                        <Save size={18} />
                                        <span>Guardar</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAddForm(false);
                                            setFormData({ usuario: '', password: '', email: '', nombre: '', rol: 'usuario' });
                                            setError('');
                                        }}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Users Table */}
                    {isLoading ? (
                        <div className="text-center py-12 text-slate-400">Cargando usuarios...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left p-3 text-sm font-semibold text-slate-400">Usuario</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-400">Nombre</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-400">Email</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-400">Rol</th>
                                        <th className="text-center p-3 text-sm font-semibold text-slate-400">Estado</th>
                                        <th className="text-center p-3 text-sm font-semibold text-slate-400">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                            {editingUser?.id === u.id ? (
                                                <>
                                                    <td className="p-3">
                                                        <input
                                                            type="text"
                                                            value={editingUser.usuario}
                                                            onChange={(e) => setEditingUser({ ...editingUser, usuario: e.target.value })}
                                                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            type="text"
                                                            value={editingUser.nombre || ''}
                                                            onChange={(e) => setEditingUser({ ...editingUser, nombre: e.target.value })}
                                                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            type="email"
                                                            value={editingUser.email || ''}
                                                            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <select
                                                            value={editingUser.rol}
                                                            onChange={(e) => setEditingUser({ ...editingUser, rol: e.target.value as any })}
                                                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                                                        >
                                                            <option value="usuario">Usuario</option>
                                                            <option value="admin">Admin</option>
                                                            <option value="viewer">Visualizador</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => handleUpdateUser(u.id, { activo: !editingUser.activo })}
                                                            className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                editingUser.activo
                                                                    ? 'bg-green-500/20 text-green-400'
                                                                    : 'bg-red-500/20 text-red-400'
                                                            }`}
                                                        >
                                                            {editingUser.activo ? 'Activo' : 'Inactivo'}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <button
                                                                onClick={() => handleUpdateUser(u.id, editingUser)}
                                                                className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingUser(null)}
                                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white"
                                                            >
                                                                <XIcon size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-3 text-white font-medium">{u.usuario}</td>
                                                    <td className="p-3 text-slate-300">{u.nombre || '-'}</td>
                                                    <td className="p-3 text-slate-300">{u.email || '-'}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                            u.rol === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                                            u.rol === 'viewer' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            {u.rol === 'admin' ? 'Admin' : u.rol === 'viewer' ? 'Visualizador' : 'Usuario'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                            u.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                        }`}>
                                                            {u.activo ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <button
                                                                onClick={() => setEditingUser({ ...u })}
                                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            {u.id !== user?.id && (
                                                                <button
                                                                    onClick={() => handleDeleteUser(u.id)}
                                                                    className="p-1.5 bg-red-600/20 hover:bg-red-600/30 rounded text-red-400 hover:text-red-300 transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
