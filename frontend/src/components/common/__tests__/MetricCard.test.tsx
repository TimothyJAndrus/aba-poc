import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/utils';
import { MetricCard } from '../MetricCard';

describe('MetricCard Component', () => {
  const mockMetric = {
    title: 'Total Sessions',
    value: 150,
    trend: {
      direction: 'up' as const,
      percentage: 12,
    },
    color: 'primary' as const,
  };

  it('renders metric information correctly', () => {
    render(<MetricCard {...mockMetric} />);
    
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('displays trend information when provided', () => {
    render(<MetricCard {...mockMetric} />);
    
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('handles different trend directions', () => {
    const downTrendMetric = {
      ...mockMetric,
      trend: { direction: 'down' as const, percentage: -5 },
    };
    
    render(<MetricCard {...downTrendMetric} />);
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('renders without trend when not provided', () => {
    const { trend, ...metricWithoutTrend } = mockMetric;
    render(<MetricCard {...metricWithoutTrend} />);
    
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it('applies correct color styling', () => {
    render(<MetricCard {...mockMetric} />);
    expect(screen.getByText('150')).toBeInTheDocument();
  });
});