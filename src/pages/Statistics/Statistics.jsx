/**
 * Página Statistics
 * Estadísticas completas y análisis del inventario
 */

import { useState, useEffect, useMemo } from 'react';
import { getProducts } from '../../services/products';
import { getSuppliers } from '../../services/suppliers';
import { getProductRotationStats } from '../../services/orders';
import { getAllMerma } from '../../services/merma';
import { getDishesStats } from '../../services/dishes';
import { getPurchasedQuantityByProductLast30Days } from '../../services/purchases';
import { supabase } from '../../services/supabase';
import PieChart from '../../components/Charts/PieChart';
import BarChart from '../../components/Charts/BarChart';
import LineChart from '../../components/Charts/LineChart';
import './Statistics.css';

/**
 * Componente de Rotación de Productos
 */
function ProductRotationSection({ topProducts, allProducts, productRotationData }) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Cargar datos del gráfico cuando cambian las fechas o productos seleccionados
  useEffect(() => {
    if (selectedProducts.length === 0) {
      setChartData([]);
      return;
    }

    const loadChartData = async () => {
      setLoadingChart(true);
      try {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Obtener historial de stock para los productos seleccionados en el rango de fechas
        const { data: history, error } = await supabase
          .from('stock_history')
          .select(`
            product_id,
            quantity,
            created_at,
            products (
              id,
              nombre
            )
          `)
          .eq('action_type', 'subtract')
          .in('product_id', selectedProducts)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Agrupar por producto y fecha
        const productDataMap = {};
        selectedProducts.forEach(productId => {
          // Buscar en allProducts (array de productos completos) o en productRotationData
          const product = allProducts?.find(p => p.id === productId);
          const rotationInfo = productRotationData?.allProducts?.find(p => p.productId === productId);
          
          if (product || rotationInfo) {
            productDataMap[productId] = {
              productId,
              productName: product?.nombre || rotationInfo?.productName || 'Producto',
              color: getColorForProduct(productId, selectedProducts),
              data: [],
            };
          }
        });

        // Inicializar todos los días en el rango con 0
        const daysMap = {};
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const dateKey = currentDate.toISOString().split('T')[0];
          daysMap[dateKey] = {};
          selectedProducts.forEach(productId => {
            daysMap[dateKey][productId] = 0;
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Sumar cantidades por día y producto
        history?.forEach(entry => {
          const date = new Date(entry.created_at);
          const dateKey = date.toISOString().split('T')[0];
          if (daysMap[dateKey] && daysMap[dateKey][entry.product_id] !== undefined) {
            daysMap[dateKey][entry.product_id] += parseFloat(entry.quantity || 0);
          }
        });

        // Convertir a formato del gráfico
        const chartSeries = Object.values(productDataMap);
        const dateKeys = Object.keys(daysMap).sort();

        chartSeries.forEach(series => {
          series.data = dateKeys.map(dateKey => ({
            label: new Date(dateKey).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
            value: daysMap[dateKey][series.productId] || 0,
          }));
        });

        setChartData(chartSeries);
      } catch (err) {
        console.error('Error al cargar datos del gráfico:', err);
      } finally {
        setLoadingChart(false);
      }
    };

    loadChartData();
  }, [startDate, endDate, selectedProducts, allProducts]);

  const getColorForProduct = (productId, selected) => {
    const colors = ['#DC2626', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    const index = selected.indexOf(productId);
    return colors[index % colors.length];
  };

  const handleProductToggle = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  return (
    <div className="statistics-section">
      <h2 className="statistics-section-title">🔄 Rotación de Productos</h2>

      {/* Tabla Top Productos */}
      {topProducts && topProducts.length > 0 && (
        <div className="statistics-table-card">
          <h3 className="statistics-table-title">Top 10 Productos por Rotación</h3>
          <div className="statistics-table">
            <div className="statistics-table-header">
              <div className="statistics-table-col">#</div>
              <div className="statistics-table-col">Producto</div>
              <div className="statistics-table-col">Cantidad Total</div>
            </div>
            {topProducts.map((product, index) => (
              <div key={product.productId} className="statistics-table-row">
                <div className="statistics-table-col">{index + 1}</div>
                <div className="statistics-table-col">{product.productName}</div>
                <div className="statistics-table-col statistics-table-value">
                  {product.totalQuantity.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico Interactivo */}
      <div className="statistics-chart-card">
        <h3 className="statistics-chart-title">Rotación por Productos y Fechas</h3>
        
        {/* Selectores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: '#1A1A1A', borderRadius: '8px', border: '1px solid #374151' }}>
          {/* Selector de Fechas */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ color: '#D1D5DB', fontSize: '0.875rem', fontWeight: 500 }}>
              Desde:
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.5rem',
                  background: '#000000',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '0.875rem',
                }}
              />
            </label>
            <label style={{ color: '#D1D5DB', fontSize: '0.875rem', fontWeight: 500 }}>
              Hasta:
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.5rem',
                  background: '#000000',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '0.875rem',
                }}
              />
            </label>
          </div>

          {/* Selector de Productos - Multi-Dropdown */}
          <div style={{ position: 'relative' }}>
            <label style={{ color: '#D1D5DB', fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
              Seleccionar Productos:
            </label>
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                padding: '0.75rem 1rem',
                background: '#000000',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#DC2626'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#374151'}
            >
              <span style={{ color: selectedProducts.length > 0 ? '#FFFFFF' : '#6B7280' }}>
                {selectedProducts.length > 0 
                  ? `${selectedProducts.length} producto${selectedProducts.length !== 1 ? 's' : ''} seleccionado${selectedProducts.length !== 1 ? 's' : ''}`
                  : 'Selecciona productos...'}
              </span>
              <span style={{ 
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                fontSize: '0.75rem',
                color: '#9CA3AF'
              }}>
                ▼
              </span>
            </div>
            
            {dropdownOpen && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 998,
                  }}
                  onClick={() => setDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.5rem',
                    background: '#1A1A1A',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 999,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {allProducts && allProducts.length > 0 ? (
                    <>
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#000000',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                      }}>
                        <span style={{ color: '#D1D5DB', fontSize: '0.875rem', fontWeight: 500 }}>
                          {allProducts.length} productos
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedProducts.length === allProducts.length) {
                              setSelectedProducts([]);
                            } else {
                              setSelectedProducts(allProducts.map(p => p.id || p.productId));
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #374151',
                            borderRadius: '6px',
                            padding: '0.25rem 0.75rem',
                            color: '#D1D5DB',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#DC2626';
                            e.currentTarget.style.color = '#DC2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#374151';
                            e.currentTarget.style.color = '#D1D5DB';
                          }}
                        >
                          {selectedProducts.length === allProducts.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        </button>
                      </div>
                      <div style={{ padding: '0.5rem' }}>
                        {allProducts.map((product) => {
                          const productId = product.id || product.productId;
                          const productName = product.nombre || product.productName;
                          const isSelected = selectedProducts.includes(productId);
                          const rotationData = productRotationData?.allProducts?.find(p => p.productId === productId);
                          return (
                            <div
                              key={productId}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProductToggle(productId);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                background: isSelected ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                                border: isSelected ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid transparent',
                                marginBottom: '0.25rem',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = '#000000';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
                            >
                              <div style={{
                                width: '18px',
                                height: '18px',
                                border: '2px solid',
                                borderColor: isSelected ? '#DC2626' : '#6B7280',
                                borderRadius: '4px',
                                background: isSelected ? '#DC2626' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'all 0.2s ease',
                              }}>
                                {isSelected && (
                                  <span style={{ color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 'bold' }}>✓</span>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: '#D1D5DB', fontSize: '0.875rem', fontWeight: isSelected ? 500 : 400 }}>
                                  {productName}
                                </div>
                                {rotationData && (
                                  <div style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                    Rotación: {rotationData.totalQuantity.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>
                      No hay productos disponibles
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Gráfico de Líneas */}
        {loadingChart ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
            Cargando datos del gráfico...
          </div>
        ) : chartData.length > 0 ? (
          <LineChart
            data={chartData}
            height={300}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
            {selectedProducts.length === 0 
              ? 'Selecciona al menos un producto para ver el gráfico'
              : 'No hay datos de rotación en el rango de fechas seleccionado'}
          </div>
        )}
      </div>
    </div>
  );
}

function Statistics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('productos');
  const [stats, setStats] = useState({
    products: null,
    suppliers: null,
    productRotation: null,
    allProducts: null,
    merma: null,
    dishesStats: null,
    purchasedByProductLast30: null,
  });

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError('');

      const [products, suppliers, productRotationData, mermaList, dishesStats, purchasedByProductLast30] = await Promise.all([
        getProducts(),
        getSuppliers(),
        getProductRotationStats().catch(() => ({ topProducts: [], allProducts: [] })),
        getAllMerma().catch(() => []),
        getDishesStats().catch(() => ({ total: 0, byRestaurant: [], byCategory: {} })),
        getPurchasedQuantityByProductLast30Days().catch(() => ({})),
      ]);

      setStats({
        products,
        suppliers,
        productRotation: productRotationData,
        allProducts: products,
        merma: mermaList,
        dishesStats,
        purchasedByProductLast30: purchasedByProductLast30 || {},
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Formatea un valor numérico como moneda en euros
   */
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  /**
   * Formatea una fecha
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Calcula estadísticas de productos
   */
  const calculateProductStats = () => {
    if (!stats.products) return null;

    const products = stats.products;
    let totalValue = 0;
    let totalStock = 0;
    let lowStock = 0;
    let warningStock = 0;
    let goodStock = 0;
    const priceRanges = {
      '0-10': 0,
      '10-50': 0,
      '50-100': 0,
      '100+': 0,
    };

    products.forEach((product) => {
      const stock = parseFloat(product.stock || 0);
      const precio = parseFloat(product.precio || 0);
      const precioPorFormato = parseFloat(product.precio_por_formato || 0);
      const cantidadPorFormato = parseFloat(product.cantidad_por_formato || 0);
      const nivelReordenado = parseFloat(product.nivel_reordenado || 0);

      // Calcular el precio unitario correcto
      // Si hay precio_por_formato y cantidad_por_formato, calcular precio unitario
      let precioUnitario = precio;
      if (precioPorFormato > 0 && cantidadPorFormato > 0) {
        precioUnitario = precioPorFormato / cantidadPorFormato;
      } else if (precioPorFormato > 0 && cantidadPorFormato === 0) {
        // Si solo hay precio_por_formato sin cantidad, usar ese precio
        precioUnitario = precioPorFormato;
      }

      // Calcular valor del producto: stock * precio unitario
      totalValue += stock * precioUnitario;
      totalStock += stock;

      // Clasificar por estado de stock
      if (nivelReordenado === 0) {
        goodStock++;
      } else if (stock <= nivelReordenado) {
        lowStock++;
      } else if (stock > nivelReordenado && stock < nivelReordenado * 1.5) {
        warningStock++;
      } else {
        goodStock++;
      }

      // Clasificar por rango de precio
      if (precio < 10) priceRanges['0-10']++;
      else if (precio < 50) priceRanges['10-50']++;
      else if (precio < 100) priceRanges['50-100']++;
      else priceRanges['100+']++;
    });

    // Top productos por valor
    const topProductsByValue = [...products]
      .map((product) => {
        const stock = parseFloat(product.stock || 0);
        const precio = parseFloat(product.precio || 0);
        const precioPorFormato = parseFloat(product.precio_por_formato || 0);
        const cantidadPorFormato = parseFloat(product.cantidad_por_formato || 0);

        // Calcular el precio unitario correcto
        let precioUnitario = precio;
        if (precioPorFormato > 0 && cantidadPorFormato > 0) {
          precioUnitario = precioPorFormato / cantidadPorFormato;
        } else if (precioPorFormato > 0 && cantidadPorFormato === 0) {
          precioUnitario = precioPorFormato;
        }

        return {
          ...product,
          calculatedValue: stock * precioUnitario,
          precioUnitario,
        };
      })
      .sort((a, b) => b.calculatedValue - a.calculatedValue)
      .slice(0, 5);

    return {
      totalProducts: products.length,
      totalValue,
      totalStock,
      lowStock,
      warningStock,
      goodStock,
      priceRanges,
      topProductsByValue,
      averagePrice: products.length > 0
        ? products.reduce((sum, p) => sum + parseFloat(p.precio || 0), 0) / products.length
        : 0,
    };
  };

  /**
   * Calcula estadísticas de merma. Incluye % desperdicio/compra (últimos 30 días) por producto.
   */
  const calculateMermaStats = () => {
    const list = stats.merma && stats.merma.length > 0 ? stats.merma : [];
    const purchasedByProduct = stats.purchasedByProductLast30 || {};
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let totalCantidad = 0;
    const byProductMap = {};
    const merma30ByProduct = {};
    const byRestaurantMap = {};
    let last7 = 0;
    let last30 = 0;

    list.forEach((m) => {
      const qty = parseFloat(m.quantity) || 0;
      totalCantidad += qty;
      const pid = m.product_id || 'sin-producto';
      const pname = m.product?.nombre || 'Producto';
      if (!byProductMap[pid]) byProductMap[pid] = { productName: pname, total: 0 };
      byProductMap[pid].total += qty;
      if (!merma30ByProduct[pid]) merma30ByProduct[pid] = 0;
      const fecha = new Date(m.fecha);
      if (fecha >= thirtyDaysAgo) merma30ByProduct[pid] += qty;
      const rid = m.restaurant_id || 'sin-restaurante';
      const rname = m.restaurant?.nombre || 'Restaurante';
      if (!byRestaurantMap[rid]) byRestaurantMap[rid] = { restaurantName: rname, total: 0 };
      byRestaurantMap[rid].total += 1;
      if (fecha >= sevenDaysAgo) last7 += 1;
      if (fecha >= thirtyDaysAgo) last30 += 1;
    });

    const byProduct = Object.entries(byProductMap)
      .map(([id, o]) => {
        const merma30d = merma30ByProduct[id] || 0;
        const compra30d = purchasedByProduct[id] || 0;
        const porcentaje =
          compra30d > 0 ? Math.min(100, (merma30d / compra30d) * 100) : null;
        return {
          productId: id,
          productName: o.productName,
          total: o.total,
          merma30d,
          compra30d,
          porcentaje,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    const byRestaurant = Object.entries(byRestaurantMap)
      .map(([id, o]) => ({ restaurantId: id, restaurantName: o.restaurantName, count: o.total }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRegistros: list.length,
      totalCantidad,
      last7Days: last7,
      last30Days: last30,
      byProduct,
      byRestaurant,
    };
  };

  /**
   * Formatea tiempo de procesamiento
   */
  const formatProcessingTime = (hours) => {
    if (!hours || hours === 0) return 'N/A';
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)} h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours < 1) {
        return `${days} día${days !== 1 ? 's' : ''}`;
      }
      return `${days}d ${remainingHours.toFixed(1)}h`;
    }
  };

  /**
   * Calcula estadísticas de proveedores
   */
  const calculateSupplierStats = () => {
    if (!stats.suppliers) return null;

    const suppliers = stats.suppliers;
    const productsWithSuppliers = stats.products?.filter((p) => p.suppliers && p.suppliers.length > 0) || [];
    
    // Contar productos por proveedor
    const supplierProductCount = {};
    productsWithSuppliers.forEach((product) => {
      product.suppliers.forEach((supplier) => {
        supplierProductCount[supplier.id] = (supplierProductCount[supplier.id] || 0) + 1;
      });
    });

    const topSuppliers = Object.entries(supplierProductCount)
      .map(([supplierId, count]) => {
        const supplier = suppliers.find((s) => s.id === supplierId);
        return {
          supplier: supplier || { nombre: 'Desconocido' },
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalSuppliers: suppliers.length,
      suppliersWithProducts: Object.keys(supplierProductCount).length,
      productsWithSuppliers: productsWithSuppliers.length,
      topSuppliers,
    };
  };

  const productStats = calculateProductStats();
  const mermaStats = calculateMermaStats();
  const supplierStats = calculateSupplierStats();
  const dishesStats = stats.dishesStats;
  const tabs = [
    { id: 'productos', label: 'Productos', icon: '📦' },
    { id: 'merma', label: 'Merma', icon: '📉' },
    { id: 'platos', label: 'Platos', icon: '🍽️' },
    { id: 'proveedores', label: 'Proveedores', icon: '🏢' },
  ];

  if (loading) {
    return (
      <div className="statistics">
        <div className="statistics-loading">
          <div className="statistics-spinner"></div>
          <p>Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics">
        <div className="statistics-error">
          <span className="statistics-icon">⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="statistics">
      <div className="statistics-header">
        <div>
          <h1 className="statistics-title">📈 Estadísticas</h1>
          <p className="statistics-subtitle">Análisis por categoría</p>
        </div>
        <button className="statistics-refresh" onClick={loadStatistics}>
          <span className="statistics-icon">🔄</span>
          Actualizar
        </button>
      </div>

      <div className="statistics-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`statistics-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="statistics-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Productos */}
      {activeTab === 'productos' && productStats && (
        <div className="statistics-section">
          <h2 className="statistics-section-title">📊 Estadísticas de Productos</h2>
          <div className="statistics-grid">
            <div className="statistics-card">
              <div className="statistics-card-icon">📦</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Total Productos</h3>
                <p className="statistics-card-value">{productStats.totalProducts}</p>
              </div>
            </div>

            <div className="statistics-card">
              <div className="statistics-card-icon">💰</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Valor Total</h3>
                <p className="statistics-card-value">{formatCurrency(productStats.totalValue)}</p>
              </div>
            </div>

            <div className="statistics-card">
              <div className="statistics-card-icon">📊</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Stock Total</h3>
                <p className="statistics-card-value">{productStats.totalStock.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Gráficos de Distribución */}
          <div className="statistics-charts-grid">
            {/* Distribución por Estado de Stock */}
            <div className="statistics-chart-card">
              <h3 className="statistics-chart-title">Distribución por Estado de Stock</h3>
              <PieChart
                data={[
                  {
                    label: 'Stock Bajo',
                    value: productStats.lowStock,
                    color: '#DC2626',
                  },
                  {
                    label: 'Stock Advertencia',
                    value: productStats.warningStock,
                    color: '#F59E0B',
                  },
                  {
                    label: 'Stock Óptimo',
                    value: productStats.goodStock,
                    color: '#10B981',
                  },
                ]}
                size={180}
              />
            </div>
          </div>

          {/* Top Productos por Valor */}
          {productStats.topProductsByValue.length > 0 && (
            <div className="statistics-table-card">
              <h3 className="statistics-table-title">Top 5 Productos por Valor</h3>
              <div className="statistics-table">
                <div className="statistics-table-header">
                  <div className="statistics-table-col">Producto</div>
                  <div className="statistics-table-col">Stock</div>
                  <div className="statistics-table-col">Precio</div>
                  <div className="statistics-table-col">Valor Total</div>
                </div>
                {productStats.topProductsByValue.map((product) => {
                  const value = product.calculatedValue || 0;
                  const precioUnitario = product.precioUnitario || parseFloat(product.precio || 0);
                  return (
                    <div key={product.id} className="statistics-table-row">
                      <div className="statistics-table-col">{product.nombre}</div>
                      <div className="statistics-table-col">{product.stock || '0'}</div>
                      <div className="statistics-table-col">{formatCurrency(precioUnitario)}</div>
                      <div className="statistics-table-col statistics-table-value">
                        {formatCurrency(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rotación de Productos */}
          {stats.productRotation && (
            <ProductRotationSection
              topProducts={stats.productRotation.topProducts}
              allProducts={stats.allProducts}
              productRotationData={stats.productRotation}
            />
          )}
        </div>
      )}

      {/* Tab: Merma */}
      {activeTab === 'merma' && (
        <div className="statistics-section">
          <h2 className="statistics-section-title">📉 Merma (pérdidas / desperdicios)</h2>
          <div className="statistics-grid">
            <div className="statistics-card">
              <div className="statistics-card-icon">📋</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Total registros</h3>
                <p className="statistics-card-value">{mermaStats.totalRegistros}</p>
              </div>
            </div>
            <div className="statistics-card">
              <div className="statistics-card-icon">📦</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Cantidad total</h3>
                <p className="statistics-card-value">{mermaStats.totalCantidad.toLocaleString()}</p>
              </div>
            </div>
            <div className="statistics-card">
              <div className="statistics-card-icon">📅</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Últimos 7 días</h3>
                <p className="statistics-card-value">{mermaStats.last7Days}</p>
              </div>
            </div>
            <div className="statistics-card">
              <div className="statistics-card-icon">📆</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Últimos 30 días</h3>
                <p className="statistics-card-value">{mermaStats.last30Days}</p>
              </div>
            </div>
          </div>
          {mermaStats.byProduct.length > 0 && (
            <div className="statistics-table-card">
              <h3 className="statistics-table-title">Top 10 productos con más merma</h3>
              <p className="statistics-table-hint">% Desperdicio/Compra = merma (últimos 30 días) respecto a compra mensual (últimos 30 días) del mismo producto.</p>
              <div className="statistics-table">
                <div className="statistics-table-header statistics-table-merma">
                  <div className="statistics-table-col">#</div>
                  <div className="statistics-table-col">Producto</div>
                  <div className="statistics-table-col">Merma total</div>
                  <div className="statistics-table-col">Compra (30 d)</div>
                  <div className="statistics-table-col">% Desperdicio/Compra</div>
                </div>
                {mermaStats.byProduct.map((item, index) => (
                  <div key={item.productId} className="statistics-table-row statistics-table-merma">
                    <div className="statistics-table-col">{index + 1}</div>
                    <div className="statistics-table-col">{item.productName}</div>
                    <div className="statistics-table-col">{item.total.toLocaleString()}</div>
                    <div className="statistics-table-col">{item.compra30d > 0 ? item.compra30d.toLocaleString() : '—'}</div>
                    <div className="statistics-table-col statistics-table-value">
                      {item.porcentaje != null ? `${item.porcentaje.toFixed(1)} %` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mermaStats.byRestaurant.length > 0 && (
            <div className="statistics-table-card">
              <h3 className="statistics-table-title">Registros por restaurante</h3>
              <div className="statistics-table">
                <div className="statistics-table-header">
                  <div className="statistics-table-col">Restaurante</div>
                  <div className="statistics-table-col">Registros</div>
                </div>
                {mermaStats.byRestaurant.map((item) => (
                  <div key={item.restaurantId} className="statistics-table-row">
                    <div className="statistics-table-col">{item.restaurantName}</div>
                    <div className="statistics-table-col statistics-table-value">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Platos */}
      {activeTab === 'platos' && dishesStats && (
        <div className="statistics-section">
          <h2 className="statistics-section-title">🍽️ Platos del local</h2>
          <div className="statistics-grid">
            <div className="statistics-card">
              <div className="statistics-card-icon">🍽️</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Total platos</h3>
                <p className="statistics-card-value">{dishesStats.total}</p>
              </div>
            </div>
            <div className="statistics-card">
              <div className="statistics-card-icon">🏪</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Locales con platos</h3>
                <p className="statistics-card-value">{dishesStats.byRestaurant?.length || 0}</p>
              </div>
            </div>
          </div>
          {dishesStats.byRestaurant && dishesStats.byRestaurant.length > 0 && (
            <div className="statistics-table-card">
              <h3 className="statistics-table-title">Platos por restaurante</h3>
              <div className="statistics-table">
                <div className="statistics-table-header">
                  <div className="statistics-table-col">Restaurante</div>
                  <div className="statistics-table-col">Platos</div>
                </div>
                {dishesStats.byRestaurant.map((item) => (
                  <div key={item.id} className="statistics-table-row">
                    <div className="statistics-table-col">{item.nombre}</div>
                    <div className="statistics-table-col statistics-table-value">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dishesStats.byCategory && Object.keys(dishesStats.byCategory).length > 0 && (
            <div className="statistics-chart-card">
              <h3 className="statistics-chart-title">Platos por categoría</h3>
              <BarChart
                data={Object.entries(dishesStats.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 12)
                  .map(([label, value], i) => ({
                    label: label.length > 20 ? label.slice(0, 18) + '…' : label,
                    value,
                    color: ['#DC2626', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 6],
                  }))}
                height={220}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab: Proveedores */}
      {activeTab === 'proveedores' && supplierStats && (
        <div className="statistics-section">
          <h2 className="statistics-section-title">🏢 Estadísticas de Proveedores</h2>
          <div className="statistics-grid">
            <div className="statistics-card">
              <div className="statistics-card-icon">🏢</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Total Proveedores</h3>
                <p className="statistics-card-value">{supplierStats.totalSuppliers}</p>
              </div>
            </div>

            <div className="statistics-card">
              <div className="statistics-card-icon">🔗</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Con Productos</h3>
                <p className="statistics-card-value">{supplierStats.suppliersWithProducts}</p>
              </div>
            </div>

            <div className="statistics-card">
              <div className="statistics-card-icon">📦</div>
              <div className="statistics-card-content">
                <h3 className="statistics-card-title">Productos Asociados</h3>
                <p className="statistics-card-value">{supplierStats.productsWithSuppliers}</p>
              </div>
            </div>
          </div>

          {/* Top Proveedores */}
          {supplierStats.topSuppliers.length > 0 && (
            <div className="statistics-table-card">
              <h3 className="statistics-table-title">Top 5 Proveedores</h3>
              <div className="statistics-table">
                <div className="statistics-table-header">
                  <div className="statistics-table-col">Proveedor</div>
                  <div className="statistics-table-col">Productos</div>
                </div>
                {supplierStats.topSuppliers.map((item, index) => (
                  <div key={item.supplier.id || index} className="statistics-table-row">
                    <div className="statistics-table-col">{item.supplier.nombre}</div>
                    <div className="statistics-table-col">{item.count} productos</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Statistics;

