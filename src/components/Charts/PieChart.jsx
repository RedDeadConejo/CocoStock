/**
 * Componente PieChart
 * Gráfico de pastel interactivo
 */

import './PieChart.css';

function PieChart({ data, size = 200 }) {
  if (!data || data.length === 0) {
    return (
      <div className="pie-chart-empty">
        <p>No hay datos para mostrar</p>
      </div>
    );
  }

  // Calcular total para porcentajes
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) {
    return (
      <div className="pie-chart-empty">
        <p>No hay datos para mostrar</p>
      </div>
    );
  }

  // Calcular ángulos para cada segmento
  let currentAngle = -90; // Empezar desde arriba
  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Calcular coordenadas para el arco SVG
    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return {
      ...item,
      percentage,
      angle,
      pathData,
      color: item.color || '#DC2626',
    };
  });

  return (
    <div className="pie-chart-container">
      <svg width={size} height={size} className="pie-chart-svg">
        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment.pathData}
            fill={segment.color}
            className="pie-chart-segment"
            style={{
              opacity: 0.9,
            }}
          />
        ))}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 10}
          fill="none"
          stroke="#000000"
          strokeWidth="2"
        />
      </svg>
      <div className="pie-chart-legend">
        {segments.map((segment, index) => (
          <div key={index} className="pie-chart-legend-item">
            <div
              className="pie-chart-legend-color"
              style={{ backgroundColor: segment.color }}
            ></div>
            <div className="pie-chart-legend-content">
              <span className="pie-chart-legend-label">{segment.label}</span>
              <span className="pie-chart-legend-value">
                {segment.value} ({segment.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PieChart;

