import React, { useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { ChartContainer } from './ChartContainer';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PieChartProps {
  title: string;
  data: ChartData<'pie'>;
  options?: ChartOptions<'pie'>;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: (format: 'png' | 'pdf' | 'csv') => void;
  onDataPointClick?: (datasetIndex: number, index: number, value: any) => void;
  height?: number;
}

export const PieChart: React.FC<PieChartProps> = ({
  title,
  data,
  options = {},
  loading,
  error,
  onRefresh,
  onExport,
  onDataPointClick,
  height = 400,
}) => {
  const chartRef = useRef<ChartJS<'pie'>>(null);

  const defaultOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
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
      <Pie ref={chartRef} data={data} options={mergedOptions} />
    </ChartContainer>
  );
};