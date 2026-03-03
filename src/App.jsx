import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

// Desktop
import Dashboard from './components/desktop/Dashboard';
import Inventory from './components/desktop/Inventory';
import Employees from './components/desktop/Employees';
import Deliveries from './components/desktop/Deliveries';
import Orders from './components/desktop/Orders';
import Assignments from './components/desktop/Assignments';
import Sidebar from './components/desktop/Sidebar';

// Mobile
import MobileHome from './components/mobile/MobileHome';
import Scanner from './components/mobile/Scanner';
import MobileInventory from './components/mobile/MobileInventory';
import MobileDeliveries from './components/mobile/MobileDeliveries';
import MobileAssignments from './components/mobile/MobileAssignments';
import MobileNav from './components/mobile/MobileNav';

// Shared
import ToastContainer from './components/shared/ToastContainer';

function AppContent() {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const { toasts } = useApp();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (isMobile) {
        return (
            <div className="app-mobile">
                <Routes>
                    <Route path="/" element={<MobileHome />} />
                    <Route path="/scan" element={<Scanner />} />
                    <Route path="/m-inventory" element={<MobileInventory />} />
                    <Route path="/m-deliveries" element={<MobileDeliveries />} />
                    <Route path="/m-assignments" element={<MobileAssignments />} />
                    <Route path="*" element={<MobileHome />} />
                </Routes>
                <MobileNav />
                <ToastContainer toasts={toasts} />
            </div>
        );
    }

    return (
        <div className="app-desktop">
            <Sidebar />
            <div className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/deliveries" element={<Deliveries />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/assignments" element={<Assignments />} />
                    <Route path="*" element={<Dashboard />} />
                </Routes>
            </div>
            <ToastContainer toasts={toasts} />
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AppProvider>
                <AppContent />
            </AppProvider>
        </BrowserRouter>
    );
}
