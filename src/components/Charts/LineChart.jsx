/**
 * Componente LineChart
 * Gráfico de líneas interactivo para mostrar tendencias temporales
 */

import './LineChart.css';

function LineChart({ data, height = 300, showGrid = true, showPoints = true }) {
  if (!data || data.length === 0) {
    return (
      <div className="line-chart-empty">
        <p>No hay datos para mostrar</p>
      </div>
    );
  }

  // Calcular valores máximos y mínimos
  const values = data.flatMap((series) => series.data.map((point) => point.value));
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const valueRange = maxValue - minValue || 1;

  // Dimensiones del gráfico
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = 800; // Ancho fijo para el viewBox
  const chartHeight = height - padding.top - padding.bottom;

  // Calcular puntos para cada serie
  const seriesPaths = data.map((series, seriesIndex) => {
    const points = series.data.map((point, index) => {
      const x = padding.left + (index / (data[0].data.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
      const y = padding.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
      return { x, y, value: point.value, label: point.label };
    });

    // Crear path SVG para la línea
    const pathData = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    return {
      ...series,
      points,
      pathData,
      color: series.color || '#DC2626',
    };
  });

  // Calcular posiciones de las etiquetas del eje X
  const xLabels = data[0].data.map((point, index) => {
    const x = padding.left + (index / (data[0].data.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
    return { x, label: point.label };
  });

  // Calcular posiciones de las líneas de la cuadrícula
  const gridLines = 5;
  const gridLinePositions = Array.from({ length: gridLines }, (_, i) => {
    const value = minValue + (valueRange / (gridLines - 1)) * i;
    const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    return { y, value };
  });

  return (
    <div className="line-chart-container">
      <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="xMidYMid meet" className="line-chart-svg">
        {/* Cuadrícula */}
        {showGrid && (
          <g className="line-chart-grid">
            {gridLinePositions.map((grid, index) => (
              <g key={index}>
                <line
                  x1={padding.left}
                  y1={grid.y}
                  x2={chartWidth - padding.right}
                  y2={grid.y}
                  stroke="#374151"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
                <text
                  x={padding.left - 10}
                  y={grid.y + 4}
                  fill="#9CA3AF"
                  fontSize="10"
                  textAnchor="end"
                >
                  {Math.round(grid.value)}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Líneas */}
        {seriesPaths.map((series, seriesIndex) => (
          <g key={seriesIndex} className="line-chart-series">
            <path
              d={series.pathData}
              fill="none"
              stroke={series.color}
              strokeWidth="3"
              className="line-chart-path"
            />
            {/* Área bajo la curva (opcional) */}
            <path
              d={`${series.pathData} L ${series.points[series.points.length - 1].x} ${padding.top + chartHeight} L ${series.points[0].x} ${padding.top + chartHeight} Z`}
              fill={series.color}
              opacity="0.1"
              className="line-chart-area"
            />
            {/* Puntos */}
            {showPoints &&
              series.points.map((point, pointIndex) => (
                <g key={pointIndex}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={series.color}
                    stroke="#000000"
                    strokeWidth="2"
                    className="line-chart-point"
                  />
                  <title>{`${point.label}: ${point.value}`}</title>
                </g>
              ))}
          </g>
        ))}

        {/* Eje X - Etiquetas */}
        <g className="line-chart-x-axis">
          {xLabels.map((label, index) => {
            // Mostrar solo algunas etiquetas si hay muchas (cada 5 días aproximadamente)
            const showLabel = xLabels.length <= 10 || index % Math.ceil(xLabels.length / 10) === 0 || index === xLabels.length - 1;
            if (!showLabel) return null;
            
            return (
              <text
                key={index}
                x={label.x}
                y={height - padding.bottom + 20}
                fill="#9CA3AF"
                fontSize="10"
                textAnchor="middle"
              >
                {label.label}
              </text>
            );
          })}
        </g>

        {/* Línea del eje X */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={chartWidth - padding.right}
          y2={height - padding.bottom}
          stroke="#374151"
          strokeWidth="2"
        />

        {/* Línea del eje Y */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#374151"
          strokeWidth="2"
        />
      </svg>

      {/* Leyenda */}
      <div className="line-chart-legend">
        {seriesPaths.map((series, index) => (
          <div key={index} className="line-chart-legend-item">
            <div
              className="line-chart-legend-color"
              style={{ backgroundColor: series.color }}
            ></div>
            <span className="line-chart-legend-label">{series.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LineChart;

