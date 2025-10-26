import React, { useState, useEffect } from 'react';
import { Box, Container } from '@mui/material';
import { MetricsDashboard, DrillDownView } from '../../components/charts';

interface AnalyticsDashboardProps {}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = () => {
  const [drillDownData, setDrillDownData] = useState<any>(null);
  const [breadcrumbs, setBreadcrumbs] = useState([{ label: 'Analytics Dashboard', active: true }]);

  // Sample data for demonstration
  const sampleMetrics = [
    {
      id: 'session-completion',
      title: 'Session Completion Rate',
      type: 'line' as const,
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Completion Rate (%)',
            data: [85, 88, 92, 89, 94, 91],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.4,
          },
        ],
      },
      gridSize: { xs: 12, md: 6 },
    },
    {
      id: 'session-types',
      title: 'Session Types Distribution',
      type: 'doughnut' as const,
      data: {
        labels: ['Individual Therapy', 'Group Therapy', 'Assessment', 'Consultation'],
        datasets: [
          {
            data: [45, 25, 20, 10],
            backgroundColor: ['#2563eb', '#0891b2', '#059669', '#d97706'],
            borderWidth: 2,
          },
        ],
      },
      gridSize: { xs: 12, md: 6 },
    },
    {
      id: 'monthly-sessions',
      title: 'Monthly Sessions',
      type: 'bar' as const,
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Scheduled',
            data: [120, 135, 148, 142, 156, 149],
            backgroundColor: '#2563eb',
          },
          {
            label: 'Completed',
            data: [102, 119, 136, 127, 147, 135],
            backgroundColor: '#059669',
          },
          {
            label: 'Cancelled',
            data: [18, 16, 12, 15, 9, 14],
            backgroundColor: '#dc2626',
          },
        ],
      },
      gridSize: { xs: 12, md: 8 },
    },
    {
      id: 'staff-utilization',
      title: 'Staff Utilization',
      type: 'pie' as const,
      data: {
        labels: ['Fully Booked', 'Partially Booked', 'Available'],
        datasets: [
          {
            data: [60, 30, 10],
            backgroundColor: ['#dc2626', '#d97706', '#059669'],
            borderWidth: 2,
          },
        ],
      },
      gridSize: { xs: 12, md: 4 },
    },
  ];

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    console.log('Date range changed:', startDate, endDate);
    // Here you would typically fetch new data based on the date range
  };

  const handleFilterChange = (filters: Record<string, any>) => {
    console.log('Filters changed:', filters);
    // Here you would typically apply filters to the data
  };

  const handleDrillDown = (metricId: string, dataPoint: any) => {
    console.log('Drill down:', metricId, dataPoint);
    
    // Sample drill-down data
    const drillDownSample = {
      summary: {
        title: 'Session Completion Details',
        value: '94%',
        change: {
          value: 3.2,
          direction: 'up' as const,
        },
      },
      chart: {
        type: 'line' as const,
        data: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          datasets: [
            {
              label: 'Daily Completion Rate',
              data: [92, 94, 96, 94],
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              tension: 0.4,
            },
          ],
        },
      },
      table: {
        columns: [
          { id: 'date', label: 'Date' },
          { id: 'scheduled', label: 'Scheduled', align: 'center' as const },
          { id: 'completed', label: 'Completed', align: 'center' as const },
          { id: 'rate', label: 'Rate (%)', align: 'center' as const },
          { id: 'therapist', label: 'Primary Therapist' },
        ],
        rows: [
          {
            id: '1',
            date: '2024-01-15',
            scheduled: 8,
            completed: 7,
            rate: 87.5,
            therapist: 'Dr. Smith',
          },
          {
            id: '2',
            date: '2024-01-16',
            scheduled: 10,
            completed: 9,
            rate: 90.0,
            therapist: 'Dr. Johnson',
          },
          {
            id: '3',
            date: '2024-01-17',
            scheduled: 12,
            completed: 12,
            rate: 100.0,
            therapist: 'Dr. Williams',
          },
        ],
        totalCount: 3,
      },
    };

    setDrillDownData(drillDownSample);
    setBreadcrumbs([
      { label: 'Analytics Dashboard' },
      { label: 'Session Completion Rate', active: true },
    ]);
  };

  const handleBack = () => {
    setDrillDownData(null);
    setBreadcrumbs([{ label: 'Analytics Dashboard', active: true }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      handleBack();
    }
  };

  const handleExportData = () => {
    console.log('Exporting data...');
    // Here you would implement data export functionality
  };

  const handleViewDetails = (item: any) => {
    console.log('View details:', item);
    // Here you would navigate to detailed view or open a modal
  };

  if (drillDownData) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <DrillDownView
          title="Session Completion Analysis"
          breadcrumbs={breadcrumbs}
          data={drillDownData}
          onBack={handleBack}
          onBreadcrumbClick={handleBreadcrumbClick}
          onExportData={handleExportData}
          onViewDetails={handleViewDetails}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <MetricsDashboard
        title="ABA Scheduling Analytics"
        metrics={sampleMetrics}
        onDateRangeChange={handleDateRangeChange}
        onFilterChange={handleFilterChange}
        onDrillDown={handleDrillDown}
      />
    </Container>
  );
};