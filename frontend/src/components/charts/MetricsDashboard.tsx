import React, { useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  FilterList as FilterIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { PieChart } from './PieChart';
import { DoughnutChart } from './DoughnutChart';

interface MetricsDashboardProps {
  title?: string;
  metrics: DashboardMetric[];
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  onFilterChange?: (filters: Record<string, any>) => void;
  onDrillDown?: (metricId: string, dataPoint: any) => void;
}

interface DashboardMetric {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  data: any;
  options?: any;
  loading?: boolean;
  error?: string;
  gridSize?: { xs?: number; sm?: number; md?: number; lg?: number };
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  title = 'Analytics Dashboard',
  metrics,
  onDateRangeChange,
  onFilterChange,
  onDrillDown,
}) => {
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});

  const handleDateRangeChange = useCallback(() => {
    if (onDateRangeChange) {
      onDateRangeChange(startDate, endDate);
    }
  }, [startDate, endDate, onDateRangeChange]);

  const handleFilterChange = useCallback((key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  }, [filters, onFilterChange]);

  const handleDrillDown = useCallback((metricId: string, datasetIndex: number, index: number, value: any) => {
    if (onDrillDown) {
      onDrillDown(metricId, { datasetIndex, index, value });
    }
  }, [onDrillDown]);

  const handleExport = useCallback((metricId: string, format: 'png' | 'pdf' | 'csv') => {
    // Export functionality would be implemented here
    console.log(`Exporting ${metricId} as ${format}`);
  }, []);

  const renderChart = (metric: DashboardMetric) => {
    const commonProps = {
      title: metric.title,
      data: metric.data,
      options: metric.options,
      loading: metric.loading,
      error: metric.error,
      onExport: (format: 'png' | 'pdf' | 'csv') => handleExport(metric.id, format),
      onFullscreen: () => setFullscreenChart(metric.id),
      onDataPointClick: (datasetIndex: number, index: number, value: any) =>
        handleDrillDown(metric.id, datasetIndex, index, value),
    };

    switch (metric.type) {
      case 'line':
        return <LineChart {...commonProps} />;
      case 'bar':
        return <BarChart {...commonProps} />;
      case 'pie':
        return <PieChart {...commonProps} />;
      case 'doughnut':
        return <DoughnutChart {...commonProps} />;
      default:
        return null;
    }
  };

  const fullscreenMetric = metrics.find(m => m.id === fullscreenChart);

  return (
    <Box>
      {/* Dashboard Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Range Picker */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <DateRangeIcon color="action" />
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(date) => date && setStartDate(date)}
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(date) => date && setEndDate(date)}
              slotProps={{ textField: { size: 'small' } }}
            />
            <Button variant="outlined" onClick={handleDateRangeChange}>
              Apply
            </Button>
          </Box>

          {/* Filters */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Department</InputLabel>
            <Select
              value={filters.department || ''}
              label="Department"
              onChange={(e) => handleFilterChange('department', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="therapy">Therapy</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="support">Support</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status || ''}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Active Filters */}
      {Object.keys(filters).length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FilterIcon color="action" sx={{ mr: 1 }} />
          {Object.entries(filters).map(([key, value]) => 
            value && (
              <Chip
                key={key}
                label={`${key}: ${value}`}
                onDelete={() => handleFilterChange(key, '')}
                size="small"
              />
            )
          )}
        </Box>
      )}

      {/* Charts Grid */}
      <Grid container spacing={3}>
        {metrics.map((metric) => (
          <Grid
            key={metric.id}
            item
            xs={metric.gridSize?.xs || 12}
            sm={metric.gridSize?.sm || 6}
            md={metric.gridSize?.md || 6}
            lg={metric.gridSize?.lg || 4}
          >
            {renderChart(metric)}
          </Grid>
        ))}
      </Grid>

      {/* Fullscreen Chart Dialog */}
      <Dialog
        open={!!fullscreenChart}
        onClose={() => setFullscreenChart(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {fullscreenMetric?.title}
          <IconButton onClick={() => setFullscreenChart(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ height: '100%', p: 2 }}>
          {fullscreenMetric && (
            <Box sx={{ height: '100%' }}>
              {renderChart({ ...fullscreenMetric, gridSize: undefined })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFullscreenChart(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};