import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { io } from 'socket.io-client';

const AppContext = createContext();

export function useApp() {
    return useContext(AppContext);
}

const socket = io(window.location.origin, { autoConnect: true });

export function AppProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [stats, setStats] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [loading, setLoading] = useState(true);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const fetchProducts = useCallback(async (params = {}) => {
        try {
            const query = new URLSearchParams(params).toString();
            const res = await fetch(`/api/products?${query}`);
            const data = await res.json();
            setProducts(data);
            return data;
        } catch (err) {
            addToast('Error cargando productos', 'error');
        }
    }, [addToast]);

    const fetchEmployees = useCallback(async (params = {}) => {
        try {
            const query = new URLSearchParams(params).toString();
            const res = await fetch(`/api/employees?${query}`);
            const data = await res.json();
            setEmployees(data);
            return data;
        } catch (err) {
            addToast('Error cargando empleados', 'error');
        }
    }, [addToast]);

    const fetchDeliveries = useCallback(async (params = {}) => {
        try {
            const query = new URLSearchParams(params).toString();
            const res = await fetch(`/api/deliveries?${query}`);
            const data = await res.json();
            setDeliveries(data);
            return data;
        } catch (err) {
            addToast('Error cargando entregas', 'error');
        }
    }, [addToast]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            setStats(data);
            return data;
        } catch (err) {
            addToast('Error cargando estadísticas', 'error');
        }
    }, [addToast]);

    const createProduct = useCallback(async (product) => {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        addToast('Producto creado exitosamente', 'success');
        return res.json();
    }, [addToast]);

    const updateProduct = useCallback(async (id, product) => {
        const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        addToast('Producto actualizado', 'success');
        return res.json();
    }, [addToast]);

    const deleteProduct = useCallback(async (id) => {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error eliminando producto');
        addToast('Producto eliminado', 'success');
    }, [addToast]);

    const restockProduct = useCallback(async (id, data) => {
        const res = await fetch(`/api/products/${id}/restock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        const result = await res.json();
        addToast(`✅ +${data.quantity} unidades de ${result.name}`, 'success');
        return result;
    }, [addToast]);

    const createEmployee = useCallback(async (employee) => {
        const res = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employee)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        addToast('Empleado registrado', 'success');
        return res.json();
    }, [addToast]);

    const updateEmployee = useCallback(async (id, employee) => {
        const res = await fetch(`/api/employees/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employee)
        });
        if (!res.ok) throw new Error('Error actualizando empleado');
        addToast('Empleado actualizado', 'success');
        return res.json();
    }, [addToast]);

    const deleteEmployee = useCallback(async (id) => {
        const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error eliminando empleado');
        addToast('Empleado eliminado', 'success');
    }, [addToast]);

    const createDelivery = useCallback(async (delivery) => {
        const res = await fetch('/api/deliveries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(delivery)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        addToast('Entrega registrada exitosamente', 'success');
        return res.json();
    }, [addToast]);

    const createBulkDelivery = useCallback(async (data) => {
        const res = await fetch('/api/deliveries/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        addToast('Equipos asignados exitosamente', 'success');
        return res.json();
    }, [addToast]);

    const getProductByCode = useCallback(async (code) => {
        const res = await fetch(`/api/products/code/${code}`);
        if (!res.ok) return null;
        return res.json();
    }, []);

    const getEmployeeDetails = useCallback(async (id) => {
        const res = await fetch(`/api/employees/${id}`);
        if (!res.ok) return null;
        return res.json();
    }, []);

    // ─── ASSIGNMENTS ───
    const fetchAssignments = useCallback(async (params = {}) => {
        try {
            const query = new URLSearchParams(params).toString();
            const res = await fetch(`/api/assignments?${query}`);
            return await res.json();
        } catch (err) {
            addToast('Error cargando asignaciones', 'error');
            return [];
        }
    }, [addToast]);

    const getEmployeeAssignments = useCallback(async (employeeId, status) => {
        try {
            const query = status ? `?status=${status}` : '';
            const res = await fetch(`/api/assignments/employee/${employeeId}${query}`);
            return await res.json();
        } catch (err) {
            addToast('Error cargando asignaciones del empleado', 'error');
            return [];
        }
    }, [addToast]);

    const returnAssignment = useCallback(async (id, data) => {
        const res = await fetch(`/api/assignments/${id}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        addToast('Artículo devuelto exitosamente', 'success');
        return res.json();
    }, [addToast]);

    const reportDamage = useCallback(async (id, data) => {
        const res = await fetch(`/api/assignments/${id}/damage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        const result = await res.json();
        if (result.stock_available) {
            addToast('Daño reportado y reemplazo asignado', 'success');
        } else {
            addToast('Daño reportado. Sin stock para reemplazo.', 'warning');
        }
        return result;
    }, [addToast]);

    // Real-time sync
    useEffect(() => {
        socket.on('product:created', () => { fetchProducts(); fetchStats(); });
        socket.on('product:updated', () => { fetchProducts(); fetchStats(); });
        socket.on('product:deleted', () => { fetchProducts(); fetchStats(); });
        socket.on('employee:created', () => fetchEmployees());
        socket.on('employee:updated', () => fetchEmployees());
        socket.on('employee:deleted', () => fetchEmployees());
        socket.on('delivery:created', () => { fetchDeliveries(); fetchProducts(); fetchStats(); });
        socket.on('assignment:created', () => { fetchProducts(); fetchStats(); });
        socket.on('assignment:updated', () => { fetchProducts(); fetchStats(); });

        return () => {
            socket.off('product:created');
            socket.off('product:updated');
            socket.off('product:deleted');
            socket.off('employee:created');
            socket.off('employee:updated');
            socket.off('employee:deleted');
            socket.off('delivery:created');
            socket.off('assignment:created');
            socket.off('assignment:updated');
        };
    }, [fetchProducts, fetchEmployees, fetchDeliveries, fetchStats]);

    // Initial load
    useEffect(() => {
        Promise.all([fetchProducts(), fetchEmployees(), fetchDeliveries(), fetchStats()])
            .finally(() => setLoading(false));
    }, []);

    const value = {
        products, employees, deliveries, stats, toasts, loading,
        fetchProducts, fetchEmployees, fetchDeliveries, fetchStats,
        createProduct, updateProduct, deleteProduct, restockProduct,
        createEmployee, updateEmployee, deleteEmployee,
        createDelivery, createBulkDelivery, getProductByCode, getEmployeeDetails,
        fetchAssignments, getEmployeeAssignments, returnAssignment, reportDamage,
        addToast
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
