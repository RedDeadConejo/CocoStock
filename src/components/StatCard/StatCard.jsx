/**
 * Componente StatCard
 * Tarjeta reutilizable para mostrar estadísticas
 */

import './StatCard.css';

function StatCard({ icon, title, value, color, description, onClick, clickable }) {
  const handleClick = () => {
    if (onClick && clickable) {
      onClick();
    }
  };

  return (
    <div 
      className={`stat-card ${clickable ? 'stat-card-clickable' : ''}`}
      onClick={handleClick}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      <div className="stat-card-header">
        <div className="stat-card-icon">{icon}</div>
        <h3 className="stat-card-title">{title}</h3>
      </div>
      <div className="stat-card-value" style={{ color: color || '#FFFFFF' }}>
        {value}
      </div>
      {description && (
        <p className="stat-card-description">{description}</p>
      )}
    </div>
  );
}

export default StatCard;
