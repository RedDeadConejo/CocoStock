/**
 * Página Purchases
 * Gestión de compras - Dashboard (Estado de compras) y vistas según el cargo
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';
import { getPurchaseStats, PURCHASE_STATUS } from '../../services/purchases';
import { FILTER_PURCHASE_INCIDENTS } from '../../utils/purchaseStatus';
import PurchaseCart from '../../components/PurchaseCart/PurchaseCart';
import PurchasesList from '../../components/PurchasesList/PurchasesList';
import StatCard from '../../components/StatCard/StatCard';
import './Purchases.css';

function Purchases() {
  const [currentUser, setCurrentUser] = useState(null);
  const [purchaseView, setPurchaseView] = useState('list'); // 'list' o 'cart'
  const [purchasesDashboard, setPurchasesDashboard] = useState({
    stats: { pending: 0, processing: 0, completedToday: 0, cancelled: 0, rotation24h: 0, incidentsWeekly: 0 },
    loading: true,
  });
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const { isAlmacen, isAdmin, loading: roleLoading } = useRole(currentUser?.id);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  // Cargar dashboard de compras (estadísticas)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPurchasesDashboard((prev) => ({ ...prev, loading: true }));
      try {
        const stats = await getPurchaseStats();
        if (cancelled) return;
        setPurchasesDashboard({ stats, loading: false });
      } catch (err) {
        if (!cancelled) setPurchasesDashboard((prev) => ({ ...prev, loading: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Si hay una compra seleccionada desde el Dashboard, cambiar a la vista de lista
  useEffect(() => {
    const selectedPurchaseId = sessionStorage.getItem('selectedPurchaseId');
    if (selectedPurchaseId) {
      setPurchaseView('list');
    }
  }, []);

  // Si se viene desde el Dashboard de almacén con "Nueva compra", abrir el carrito
  useEffect(() => {
    const openCart = sessionStorage.getItem('purchasesOpenCart');
    if (openCart === 'true') {
      sessionStorage.removeItem('purchasesOpenCart');
      setPurchaseView('cart');
    }
  }, []);

  const handlePurchaseStatusFilter = (status) => {
    sessionStorage.setItem('purchasesStatusFilter', status);
    setListRefreshKey((k) => k + 1);
    setPurchaseView('list');
  };

  const purchaseCards = useMemo(
    () => [
      { id: 'pending', icon: '⏳', title: 'Pendientes', value: purchasesDashboard.stats.pending, color: '#F59E0B', description: 'Esperando procesamiento', clickable: true, onClick: () => handlePurchaseStatusFilter(PURCHASE_STATUS.PENDING) },
      { id: 'processing', icon: '⚙️', title: 'En Proceso', value: purchasesDashboard.stats.processing, color: '#3B82F6', description: 'Siendo recibidas', clickable: true, onClick: () => handlePurchaseStatusFilter(PURCHASE_STATUS.PROCESSING) },
      { id: 'incidents', icon: '⚠️', title: 'Incidencias (semana)', value: purchasesDashboard.stats.incidentsWeekly ?? 0, color: '#DC2626', description: 'Compras con cantidad recibida distinta a la solicitada en los últimos 7 días', clickable: true, onClick: () => handlePurchaseStatusFilter(FILTER_PURCHASE_INCIDENTS) },
      { id: 'completed', icon: '✅', title: 'Completados (hoy)', value: purchasesDashboard.stats.completedToday ?? 0, color: '#10B981', description: 'Completadas hoy', clickable: true, onClick: () => handlePurchaseStatusFilter(PURCHASE_STATUS.COMPLETED) },
      { id: 'cancelled', icon: '❌', title: 'Canceladas', value: purchasesDashboard.stats.cancelled, color: '#DC2626', description: 'Compras canceladas', clickable: true, onClick: () => handlePurchaseStatusFilter(PURCHASE_STATUS.CANCELLED) },
      { id: 'rotation', icon: '🔄', title: 'Rotación (24h)', value: purchasesDashboard.stats.rotation24h ?? 0, color: '#8B5CF6', description: 'Completadas en últimas 24h', clickable: false },
    ],
    [purchasesDashboard.stats]
  );

  const renderPurchasesDashboard = () => (
    <div className="purchases-dashboard">
      <h2 className="purchases-dashboard-section-title">📋 Estado de compras</h2>
      {purchasesDashboard.loading ? (
        <div className="purchases-dashboard-loading">
          <div className="purchases-dashboard-spinner" />
          <p>Cargando estadísticas...</p>
        </div>
      ) : (
        <div className="purchases-dashboard-grid">
          {purchaseCards.map((card) => (
            <StatCard key={card.id} {...card} />
          ))}
        </div>
      )}
    </div>
  );

  // Mostrar loading mientras se carga el usuario o el rol
  if (roleLoading || !currentUser) {
    return (
      <div className="purchases-container">
        <div className="purchases-loading">Cargando...</div>
      </div>
    );
  }

  // Solo almacén y admin pueden acceder aquí (ya está protegido por RoleGuard en Layout)
  return (
    <div className="purchases-container">
      <div className="purchases-header">
        <div>
          <h1 className="purchases-title">💰 Compras</h1>
          <p className="purchases-subtitle">Gestiona las compras</p>
        </div>
        <div className="purchases-header-actions">
          {(isAlmacen || isAdmin) && (
            <button
              className={`purchases-button-create ${purchaseView === 'cart' ? 'active' : ''}`}
              onClick={() => setPurchaseView(purchaseView === 'cart' ? 'list' : 'cart')}
            >
              <span className="purchases-icon">➕</span>
              {purchaseView === 'cart' ? 'Volver a compras' : 'Nueva compra'}
            </button>
          )}
        </div>
      </div>
      {renderPurchasesDashboard()}
      <div className="purchases-content">
        {purchaseView === 'cart' ? (
          <PurchaseCart
            userId={currentUser?.id}
            onPurchaseCreated={() => {
              setPurchaseView('list');
              setListRefreshKey((k) => k + 1);
              window.dispatchEvent(new CustomEvent('purchaseCreated'));
            }}
          />
        ) : (
          <PurchasesList key={listRefreshKey} userId={currentUser?.id} />
        )}
      </div>
    </div>
  );
}

export default Purchases;
