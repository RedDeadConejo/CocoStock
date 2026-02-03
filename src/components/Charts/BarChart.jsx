/**
 * Componente BarChart
 * Gráfico de barras interactivo
 */

import './BarChart.css';

function BarChart({ data, maxValue, showValues = true, height = 300 }) {
  if (!data || data.length === 0) {
    return (
      <div className="bar-chart-empty">
        <p>No hay datos para mostrar</p>
      </div>
    );
  }

  // Calcular el valor máximo si no se proporciona
  const calculatedMax = maxValue || Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="bar-chart-container">
      <div className="bar-chart-bars" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const percentage = (item.value / calculatedMax) * 100;
          return (
            <div key={index} className="bar-chart-item">
              <div className="bar-chart-bar-wrapper">
                <div
                  className="bar-chart-bar"
                  style={{
                    height: `${percentage}%`,
                    backgroundColor: item.color || '#DC2626',
                    minHeight: item.value > 0 ? '4px' : '0',
                  }}
                  title={`${item.label}: ${item.value}`}
                >
                  {showValues && item.value > 0 && (
                    <span className="bar-chart-value">{item.value}</span>
                  )}
                </div>
              </div>
              <div className="bar-chart-label">{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BarChart;

