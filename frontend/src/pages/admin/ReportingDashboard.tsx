import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Paper,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Build as BuildIcon,
  Schedule as ScheduleIcon,
  LibraryBooks as LibraryBooksIcon,
} from '@mui/icons-material';
import { ReportBuilder } from '../../components/charts/ReportBuilder';
import { ScheduledReports } from '../../components/charts/ScheduledReports';
import { ReportTemplates } from '../../components/charts/ReportTemplates';
import { AnalyticsDashboard } from './AnalyticsDashboard';

interface ReportConfig {
  name: string;
  type: 'operational' | 'financial' | 'quality' | 'custom';
  dateRange: {
    start: Date;
    end: Date;
    preset?: 'last7days' | 'last30days' | 'lastQuarter' | 'lastYear' | 'custom';
  };
  metrics: string[];
  filters: any[];
  groupBy: string[];
  format: 'pdf' | 'excel' | 'csv' | 'dashboard';
  includeCharts: boolean;
  includeTables: boolean;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'operational' | 'financial' | 'quality' | 'custom';
  config: ReportConfig;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  tags: string[];
}

interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  nextRun: Date;
  lastRun?: Date;
  status: 'active' | 'paused' | 'error';
  reportConfig: {
    type: string;
    metrics: string[];
    format: string;
  };
  createdBy: string;
  createdAt: Date;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reporting-tabpanel-${index}`}
      aria-labelledby={`reporting-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const ReportingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  // Sample data - in a real app, this would come from API calls
  const [templates, setTemplates] = useState<ReportTemplate[]>([
    {
      id: '1',
      name: 'Monthly Operations Report',
      description: 'Comprehensive monthly operational metrics including session completion rates, staff utilization, and client satisfaction.',
      category: 'operational' as const,
      config: {
        name: 'Monthly Operations Report',
        type: 'operational',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
          preset: 'last30days',
        },
        metrics: ['session_completion_rate', 'staff_utilization', 'cancellation_rate'],
        filters: [],
        groupBy: [],
        format: 'pdf',
        includeCharts: true,
        includeTables: true,
      },
      isPublic: true,
      createdBy: 'Admin User',
      createdAt: new Date('2024-01-15'),
      lastUsed: new Date('2024-01-20'),
      usageCount: 15,
      tags: ['monthly', 'operations', 'kpi'],
    },
    {
      id: '2',
      name: 'Financial Summary',
      description: 'Revenue and cost analysis with profitability metrics.',
      category: 'financial' as const,
      config: {
        name: 'Financial Summary',
        type: 'financial',
        dateRange: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          end: new Date(),
          preset: 'lastQuarter',
        },
        metrics: ['revenue_per_session', 'cost_per_session'],
        filters: [],
        groupBy: [],
        format: 'excel',
        includeCharts: true,
        includeTables: true,
      },
      isPublic: false,
      createdBy: 'Finance Team',
      createdAt: new Date('2024-01-10'),
      usageCount: 8,
      tags: ['financial', 'revenue', 'quarterly'],
    },
  ]);

  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([
    {
      id: '1',
      name: 'Weekly Operations Summary',
      description: 'Weekly operational metrics for management review',
      frequency: 'weekly' as const,
      recipients: ['manager@example.com', 'operations@example.com'],
      nextRun: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      lastRun: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'active' as const,
      reportConfig: {
        type: 'operational',
        metrics: ['session_completion_rate', 'staff_utilization'],
        format: 'pdf',
      },
      createdBy: 'Admin User',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      name: 'Monthly Financial Report',
      description: 'Comprehensive financial analysis for stakeholders',
      frequency: 'monthly' as const,
      recipients: ['finance@example.com', 'ceo@example.com'],
      nextRun: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'paused' as const,
      reportConfig: {
        type: 'financial',
        metrics: ['revenue_per_session', 'cost_per_session'],
        format: 'excel',
      },
      createdBy: 'Finance Team',
      createdAt: new Date('2024-01-05'),
    },
  ]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleGenerateReport = async (config: any) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setNotification({
        message: `Report "${config.name}" generated successfully!`,
        severity: 'success',
      });
    } catch (error) {
      setNotification({
        message: 'Failed to generate report. Please try again.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = (template: any) => {
    const newTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date(),
      usageCount: 0,
    };
    setTemplates(prev => [...prev, newTemplate]);
    setNotification({
      message: 'Template saved successfully!',
      severity: 'success',
    });
  };

  const handleScheduleReport = (schedule: any) => {
    const newSchedule = {
      ...schedule,
      id: Date.now().toString(),
      status: 'active' as const,
      createdBy: 'Current User',
      createdAt: new Date(),
    };
    setScheduledReports(prev => [...prev, newSchedule]);
    setNotification({
      message: 'Report scheduled successfully!',
      severity: 'success',
    });
  };

  // Template management handlers
  const handleCreateTemplate = (template: any) => {
    const newTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date(),
      usageCount: 0,
    };
    setTemplates(prev => [...prev, newTemplate]);
    setNotification({
      message: 'Template created successfully!',
      severity: 'success',
    });
  };

  const handleUpdateTemplate = (id: string, updates: any) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setNotification({
      message: 'Template updated successfully!',
      severity: 'success',
    });
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    setNotification({
      message: 'Template deleted successfully!',
      severity: 'success',
    });
  };

  const handleDuplicateTemplate = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template) {
      const duplicated = {
        ...template,
        id: Date.now().toString(),
        name: `${template.name} (Copy)`,
        createdAt: new Date(),
        usageCount: 0,
      };
      setTemplates(prev => [...prev, duplicated]);
      setNotification({
        message: 'Template duplicated successfully!',
        severity: 'success',
      });
    }
  };

  const handleUseTemplate = (template: any) => {
    setActiveTab(1); // Switch to Report Builder tab
    setNotification({
      message: `Template "${template.name}" loaded in Report Builder!`,
      severity: 'info',
    });
  };

  const handleExportTemplate = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template) {
      // Simulate export
      const dataStr = JSON.stringify(template, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}-template.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      setNotification({
        message: 'Template exported successfully!',
        severity: 'success',
      });
    }
  };

  // Scheduled reports handlers
  const handleCreateSchedule = (schedule: any) => {
    setScheduledReports(prev => [...prev, schedule]);
    setNotification({
      message: 'Report scheduled successfully!',
      severity: 'success',
    });
  };

  const handleUpdateSchedule = (id: string, updates: any) => {
    setScheduledReports(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setNotification({
      message: 'Schedule updated successfully!',
      severity: 'success',
    });
  };

  const handleDeleteSchedule = (id: string) => {
    setScheduledReports(prev => prev.filter(s => s.id !== id));
    setNotification({
      message: 'Scheduled report deleted successfully!',
      severity: 'success',
    });
  };

  const handleRunNow = (id: string) => {
    const report = scheduledReports.find(r => r.id === id);
    if (report) {
      setNotification({
        message: `Report "${report.name}" is being generated...`,
        severity: 'info',
      });
    }
  };

  const handleToggleActive = (id: string, active: boolean) => {
    setScheduledReports(prev => prev.map(s => 
      s.id === id ? { ...s, status: active ? 'active' as const : 'paused' as const } : s
    ));
    setNotification({
      message: `Report ${active ? 'activated' : 'paused'} successfully!`,
      severity: 'success',
    });
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        Reporting & Analytics
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="reporting dashboard tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<AssessmentIcon />}
            label="Analytics"
            id="reporting-tab-0"
            aria-controls="reporting-tabpanel-0"
          />
          <Tab
            icon={<BuildIcon />}
            label="Report Builder"
            id="reporting-tab-1"
            aria-controls="reporting-tabpanel-1"
          />
          <Tab
            icon={<LibraryBooksIcon />}
            label="Templates"
            id="reporting-tab-2"
            aria-controls="reporting-tabpanel-2"
          />
          <Tab
            icon={<ScheduleIcon />}
            label="Scheduled Reports"
            id="reporting-tab-3"
            aria-controls="reporting-tabpanel-3"
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <AnalyticsDashboard />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <ReportBuilder
            onGenerateReport={handleGenerateReport}
            onSaveTemplate={handleSaveTemplate}
            onScheduleReport={handleScheduleReport}
            templates={templates}
            loading={loading}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <ReportTemplates
            templates={templates}
            onCreateTemplate={handleCreateTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onDuplicateTemplate={handleDuplicateTemplate}
            onUseTemplate={handleUseTemplate}
            onExportTemplate={handleExportTemplate}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <ScheduledReports
            reports={scheduledReports}
            onCreateSchedule={handleCreateSchedule}
            onUpdateSchedule={handleUpdateSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onRunNow={handleRunNow}
            onToggleActive={handleToggleActive}
          />
        </TabPanel>
      </Paper>

      {/* Notification Snackbar */}
      {notification && (
        <Snackbar
          open={!!notification}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleCloseNotification}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
};