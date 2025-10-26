import React, { useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { ChartContainer } from './ChartContainer';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DoughnutChartProps {
  title: string;
  data: ChartData<'doughnut'>;
  options?: ChartOptions<'doughnut'>;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: (format: 'png' | 'pdf' | 'csv') => void;
  onDataPointClick?: (datasetIndex: number, index: number, value: any) => void;
  height?: number;
  centerText?: string;
}

export const DoughnutChart: React.FC<DoughnutChartProps> = ({
  title,
  data,
  options = {},
  loading,
  error,
  onRefresh,
  onExport,
  onDataPointClick,
  height = 400,
  centerText,
}) => {
  const chartRef = useRef<ChartJS<'doughnut'>>(null);

  const defaultOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && onDataPointClick) {
        const element = elements[0];
        onDataPointClick(element.datasetIndex, element.index, data.datasets[element.datasetIndex].data[element.index]);
      }
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    plugins: {
      ...defaultOptions.plugins,
      ...options.plugins,
    },
  };

  return (
    <ChartContainer
      title={title}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onExport={onExport}
      height={height}
      chartRef={chartRef}
    >
      <div style={{ position: 'relative', height: '100%' }}>
        <Doughnut ref={chartRef} data={data} options={mergedOptions} />
        {centerText && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#333',
            }}
          >
            {centerText}
          </div>
        )}
      </div>
    </ChartContainer>
  );
};