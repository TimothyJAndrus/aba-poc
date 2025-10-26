import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Divider,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

interface ReportBuilderProps {
  onGenerateReport: (config: ReportConfig) => void;
  onSaveTemplate: (template: ReportTemplate) => void;
  onScheduleReport: (schedule: ReportSchedule) => void;
  templates?: ReportTemplate[];
  loading?: boolean;
}

interface ReportConfig {
  name: string;
  type: 'operational' | 'financial' | 'quality' | 'custom';
  dateRange: {
    start: Date;
    end: Date;
    preset?: 'last7days' | 'last30days' | 'lastQuarter' | 'lastYear' | 'custom';
  };
  metrics: string[];
  filters: ReportFilter[];
  groupBy: string[];
  format: 'pdf' | 'excel' | 'csv' | 'dashboard';
  includeCharts: boolean;
  includeTables: boolean;
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: any;
  label: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  config: ReportConfig;
  createdAt: Date;
  isPublic: boolean;
}

interface ReportSchedule {
  reportConfig: ReportConfig;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  nextRun: Date;
}

const AVAILABLE_METRICS = [
  { id: 'session_completion_rate', label: 'Session Completion Rate', category: 'operational' },
  { id: 'cancellation_rate', label: 'Cancellation Rate', category: 'operational' },
  { id: 'staff_utilization', label: 'Staff Utilization', category: 'operational' },
  { id: 'client_satisfaction', label: 'Client Satisfaction', category: 'quality' },
  { id: 'revenue_per_session', label: 'Revenue per Session', category: 'financial' },
  { id: 'cost_per_session', label: 'Cost per Session', category: 'financial' },
  { id: 'no_show_rate', label: 'No-Show Rate', category: 'operational' },
  { id: 'therapist_productivity', label: 'Therapist Productivity', category: 'operational' },
];

const FILTER_FIELDS = [
  { id: 'department', label: 'Department', type: 'select', options: ['Therapy', 'Admin', 'Support'] },
  { id: 'therapist', label: 'Therapist', type: 'select', options: ['Dr. Smith', 'Dr. Johnson', 'Dr. Williams'] },
  { id: 'client_age', label: 'Client Age', type: 'number' },
  { id: 'session_type', label: 'Session Type', type: 'select', options: ['Individual', 'Group', 'Assessment'] },
  { id: 'location', label: 'Location', type: 'select', options: ['Clinic A', 'Clinic B', 'Home Visit'] },
];

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  onGenerateReport,
  onSaveTemplate,
  onScheduleReport,
  templates = [],
  loading = false,
}) => {
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    type: 'operational',
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
      preset: 'last30days',
    },
    metrics: [],
    filters: [],
    groupBy: [],
    format: 'pdf',
    includeCharts: true,
    includeTables: true,
  });

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'weekly' as const,
    recipients: [''],
    nextRun: new Date(),
  });

  const handleConfigChange = useCallback((field: keyof ReportConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleDatePresetChange = (preset: string) => {
    const now = new Date();
    let start = new Date();

    switch (preset) {
      case 'last7days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'lastQuarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        break;
      default:
        return;
    }

    setConfig(prev => ({
      ...prev,
      dateRange: { ...prev.dateRange, start, end: now, preset: preset as any },
    }));
  };

  const handleMetricToggle = (metricId: string) => {
    setConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter(m => m !== metricId)
        : [...prev.metrics, metricId],
    }));
  };

  const handleAddFilter = () => {
    const newFilter: ReportFilter = {
      field: '',
      operator: 'equals',
      value: '',
      label: '',
    };
    setConfig(prev => ({
      ...prev,
      filters: [...prev.filters, newFilter],
    }));
  };

  const handleFilterChange = (index: number, field: keyof ReportFilter, value: any) => {
    setConfig(prev => ({
      ...prev,
      filters: prev.filters.map((filter, i) =>
        i === index ? { ...filter, [field]: value } : filter
      ),
    }));
  };

  const handleRemoveFilter = (index: number) => {
    setConfig(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  };

  const handleLoadTemplate = (template: ReportTemplate) => {
    setConfig(template.config);
  };

  const handleSaveTemplate = () => {
    const template: ReportTemplate = {
      id: Date.now().toString(),
      name: config.name || 'Untitled Report',
      description: `${config.type} report with ${config.metrics.length} metrics`,
      config,
      createdAt: new Date(),
      isPublic: false,
    };
    onSaveTemplate(template);
  };

  const handleGenerateReport = () => {
    if (config.metrics.length === 0) {
      return;
    }
    onGenerateReport(config);
  };

  const handleScheduleReport = () => {
    const schedule: ReportSchedule = {
      reportConfig: config,
      frequency: scheduleConfig.frequency,
      recipients: scheduleConfig.recipients.filter(email => email.trim()),
      nextRun: scheduleConfig.nextRun,
    };
    onScheduleReport(schedule);
    setShowScheduleDialog(false);
  };

  const getMetricsByCategory = (category: string) => {
    return AVAILABLE_METRICS.filter(metric => metric.category === category);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Report Builder
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {/* Report Configuration */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            {/* Basic Settings */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Basic Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Report Name"
                      value={config.name}
                      onChange={(e) => handleConfigChange('name', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Report Type</InputLabel>
                      <Select
                        value={config.type}
                        label="Report Type"
                        onChange={(e) => handleConfigChange('type', e.target.value)}
                      >
                        <MenuItem value="operational">Operational</MenuItem>
                        <MenuItem value="financial">Financial</MenuItem>
                        <MenuItem value="quality">Quality</MenuItem>
                        <MenuItem value="custom">Custom</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Date Range */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Date Range</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      {['last7days', 'last30days', 'lastQuarter', 'lastYear', 'custom'].map((preset) => (
                        <Chip
                          key={preset}
                          label={preset.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          onClick={() => handleDatePresetChange(preset)}
                          color={config.dateRange.preset === preset ? 'primary' : 'default'}
                          variant={config.dateRange.preset === preset ? 'filled' : 'outlined'}
                        />
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="Start Date"
                      value={config.dateRange.start}
                      onChange={(date) => date && handleConfigChange('dateRange', { ...config.dateRange, start: date, preset: 'custom' })}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="End Date"
                      value={config.dateRange.end}
                      onChange={(date) => date && handleConfigChange('dateRange', { ...config.dateRange, end: date, preset: 'custom' })}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Metrics Selection */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  Metrics ({config.metrics.length} selected)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {['operational', 'financial', 'quality'].map((category) => (
                  <Box key={category} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, textTransform: 'capitalize' }}>
                      {category} Metrics
                    </Typography>
                    <Grid container spacing={1}>
                      {getMetricsByCategory(category).map((metric) => (
                        <Grid item xs={12} sm={6} key={metric.id}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={config.metrics.includes(metric.id)}
                                onChange={() => handleMetricToggle(metric.id)}
                              />
                            }
                            label={metric.label}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    {category !== 'quality' && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>

            {/* Filters */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  Filters ({config.filters.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {config.filters.map((filter, index) => (
                  <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Field</InputLabel>
                          <Select
                            value={filter.field}
                            label="Field"
                            onChange={(e) => handleFilterChange(index, 'field', e.target.value)}
                          >
                            {FILTER_FIELDS.map((field) => (
                              <MenuItem key={field.id} value={field.id}>
                                {field.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Operator</InputLabel>
                          <Select
                            value={filter.operator}
                            label="Operator"
                            onChange={(e) => handleFilterChange(index, 'operator', e.target.value)}
                          >
                            <MenuItem value="equals">Equals</MenuItem>
                            <MenuItem value="contains">Contains</MenuItem>
                            <MenuItem value="greaterThan">Greater Than</MenuItem>
                            <MenuItem value="lessThan">Less Than</MenuItem>
                            <MenuItem value="between">Between</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Value"
                          value={filter.value}
                          onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Button
                          color="error"
                          onClick={() => handleRemoveFilter(index)}
                          startIcon={<DeleteIcon />}
                        >
                          Remove
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddFilter}
                  variant="outlined"
                >
                  Add Filter
                </Button>
              </AccordionDetails>
            </Accordion>

            {/* Output Format */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Output Format</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl component="fieldset">
                      <Typography variant="subtitle2" gutterBottom>
                        Format
                      </Typography>
                      <RadioGroup
                        value={config.format}
                        onChange={(e) => handleConfigChange('format', e.target.value)}
                      >
                        <FormControlLabel value="pdf" control={<Radio />} label="PDF Report" />
                        <FormControlLabel value="excel" control={<Radio />} label="Excel Spreadsheet" />
                        <FormControlLabel value="csv" control={<Radio />} label="CSV Data" />
                        <FormControlLabel value="dashboard" control={<Radio />} label="Interactive Dashboard" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Include
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.includeCharts}
                          onChange={(e) => handleConfigChange('includeCharts', e.target.checked)}
                        />
                      }
                      label="Charts and Visualizations"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.includeTables}
                          onChange={(e) => handleConfigChange('includeTables', e.target.checked)}
                        />
                      }
                      label="Data Tables"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Paper>
        </Grid>

        {/* Templates and Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Report Templates
            </Typography>
            {templates.length > 0 ? (
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {templates.map((template) => (
                  <Box
                    key={template.id}
                    sx={{
                      p: 2,
                      mb: 1,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'grey.50' },
                    }}
                    onClick={() => handleLoadTemplate(template)}
                  >
                    <Typography variant="subtitle2">{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Alert severity="info">No templates available</Alert>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleGenerateReport}
                disabled={config.metrics.length === 0 || loading}
                fullWidth
              >
                Generate Report
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={handleSaveTemplate}
                disabled={!config.name || config.metrics.length === 0}
                fullWidth
              >
                Save as Template
              </Button>
              <Button
                variant="outlined"
                startIcon={<ScheduleIcon />}
                onClick={() => setShowScheduleDialog(true)}
                disabled={config.metrics.length === 0}
                fullWidth
              >
                Schedule Report
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};