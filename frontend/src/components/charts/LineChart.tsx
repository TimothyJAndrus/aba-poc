import React, { useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ChartContainer } from './ChartContainer';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface LineChartProps {
  title: string;
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: (format: 'png' | 'pdf' | 'csv') => void;
  onDataPointClick?: (datasetIndex: number, index: number, value: any) => void;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
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
  const chartRef = useRef<ChartJS<'line'>>(null);

  const defaultOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        display: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
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
    scales: {
      ...defaultOptions.scales,
      ...options.scales,
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
      <Line ref={chartRef} data={data} options={mergedOptions} />
    </ChartContainer>
  );
};