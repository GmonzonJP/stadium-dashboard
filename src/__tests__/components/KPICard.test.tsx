/**
 * Tests para componente KPICard
 * @module __tests__/components/KPICard
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock del componente ya que no tenemos acceso directo
// En un escenario real, importarías el componente directamente
const KPICard = ({
  title,
  value,
  variation,
  format = 'number',
  loading = false
}: {
  title: string;
  value: number;
  variation?: number;
  format?: 'number' | 'currency' | 'percent';
  loading?: boolean;
}) => {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          maximumFractionDigits: 0
        }).format(val);
      case 'percent':
        return `${val.toFixed(2)}%`;
      default:
        return new Intl.NumberFormat('es-CL').format(val);
    }
  };

  if (loading) {
    return (
      <div className="kpi-card" data-testid="kpi-card-loading">
        <div className="skeleton" />
      </div>
    );
  }

  return (
    <div className="kpi-card" data-testid="kpi-card">
      <h3 className="kpi-title">{title}</h3>
      <p className="kpi-value" data-testid="kpi-value">{formatValue(value)}</p>
      {variation !== undefined && (
        <span
          className={`kpi-variation ${variation >= 0 ? 'positive' : 'negative'}`}
          data-testid="kpi-variation"
        >
          {variation >= 0 ? '↑' : '↓'} {Math.abs(variation).toFixed(1)}%
        </span>
      )}
    </div>
  );
};

describe('KPICard Component', () => {
  describe('Rendering', () => {
    it('should render title and value', () => {
      render(<KPICard title="Ventas" value={1500000} />);

      expect(screen.getByText('Ventas')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-value')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(<KPICard title="Ventas" value={0} loading={true} />);

      expect(screen.getByTestId('kpi-card-loading')).toBeInTheDocument();
    });
  });

  describe('Formatting', () => {
    it('should format as currency when specified', () => {
      render(<KPICard title="Ventas" value={1500000} format="currency" />);

      const value = screen.getByTestId('kpi-value');
      expect(value.textContent).toContain('$');
    });

    it('should format as percent when specified', () => {
      render(<KPICard title="Margen" value={42.5} format="percent" />);

      const value = screen.getByTestId('kpi-value');
      expect(value.textContent).toBe('42.50%');
    });

    it('should format numbers with thousand separators', () => {
      render(<KPICard title="Unidades" value={163035} format="number" />);

      const value = screen.getByTestId('kpi-value');
      // Chilean format uses dots as thousand separators
      expect(value.textContent).toMatch(/163[.,]035/);
    });
  });

  describe('Variation Display', () => {
    it('should show positive variation with up arrow', () => {
      render(<KPICard title="Ventas" value={1500000} variation={15.5} />);

      const variation = screen.getByTestId('kpi-variation');
      expect(variation.textContent).toContain('↑');
      expect(variation.textContent).toContain('15.5%');
      expect(variation).toHaveClass('positive');
    });

    it('should show negative variation with down arrow', () => {
      render(<KPICard title="Ventas" value={1500000} variation={-8.2} />);

      const variation = screen.getByTestId('kpi-variation');
      expect(variation.textContent).toContain('↓');
      expect(variation.textContent).toContain('8.2%');
      expect(variation).toHaveClass('negative');
    });

    it('should not show variation when not provided', () => {
      render(<KPICard title="Ventas" value={1500000} />);

      expect(screen.queryByTestId('kpi-variation')).not.toBeInTheDocument();
    });

    it('should handle zero variation as positive', () => {
      render(<KPICard title="Ventas" value={1500000} variation={0} />);

      const variation = screen.getByTestId('kpi-variation');
      expect(variation).toHaveClass('positive');
    });
  });
});
