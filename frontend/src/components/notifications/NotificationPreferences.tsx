import React, { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMoreOutlined,
  NotificationsOutlined,
  EmailOutlined,
  PhoneAndroidOutlined,
  ScheduleOutlined,
  SystemUpdateOutlined,
  SaveOutlined,
} from '@mui/icons-material';
import type { NotificationSettings } from '../../types';

interface NotificationPreferencesProps {
  settings: NotificationSettings;
  onSettingsChange: (settings: NotificationSettings) => void;
  onSave: () => void;
  loading?: boolean;
}

interface NotificationCategory {
  id: keyof NotificationSettings;
  label: string;
  description: string;
  icon: React.ReactNode;
  subcategories?: {
    id: string;
    label: string;
    description: string;
  }[];
}

const notificationCategories: NotificationCategory[] = [
  {
    id: 'email',
    label: 'Email Notifications',
    description: 'Receive notifications via email',
    icon: <EmailOutlined />,
  },
  {
    id: 'push',
    label: 'Push Notifications',
    description: 'Receive browser push notifications',
    icon: <PhoneAndroidOutlined />,
  },
  {
    id: 'scheduleChanges',
    label: 'Schedule Changes',
    description: 'Get notified when your schedule changes',
    icon: <ScheduleOutlined />,
  },
  {
    id: 'reminders',
    label: 'Reminders',
    description: 'Receive session and appointment reminders',
    icon: <NotificationsOutlined />,
  },
  {
    id: 'systemAlerts',
    label: 'System Alerts',
    description: 'Important system notifications and updates',
    icon: <SystemUpdateOutlined />,
  },
];

const reminderTimes = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

const emailFrequencies = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'hourly', label: 'Hourly digest' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
  { value: 'never', label: 'Never' },
];

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  settings,
  onSettingsChange,
  onSave,
  loading = false,
}) => {
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [reminderTime, setReminderTime] = useState(30);
  const [emailFrequency, setEmailFrequency] = useState('immediate');

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    setHasChanges(true);
    onSettingsChange(newSettings);
  };

  const handleSave = () => {
    onSave();
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
    onSettingsChange(settings);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Card>
        <CardHeader
          title="Notification Preferences"
          subheader="Customize how and when you receive notifications"
          avatar={<NotificationsOutlined color="primary" />}
        />
        
        <CardContent>
          {/* Quick Settings */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Settings
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const allOn = {
                    email: true,
                    push: true,
                    scheduleChanges: true,
                    reminders: true,
                    systemAlerts: true,
                  };
                  setLocalSettings(allOn);
                  setHasChanges(true);
                  onSettingsChange(allOn);
                }}
              >
                Enable All
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const allOff = {
                    email: false,
                    push: false,
                    scheduleChanges: false,
                    reminders: false,
                    systemAlerts: false,
                  };
                  setLocalSettings(allOff);
                  setHasChanges(true);
                  onSettingsChange(allOff);
                }}
              >
                Disable All
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const essentialOnly = {
                    email: false,
                    push: true,
                    scheduleChanges: true,
                    reminders: true,
                    systemAlerts: true,
                  };
                  setLocalSettings(essentialOnly);
                  setHasChanges(true);
                  onSettingsChange(essentialOnly);
                }}
              >
                Essential Only
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Notification Categories */}
          <Typography variant="h6" gutterBottom>
            Notification Types
          </Typography>
          
          <FormGroup>
            {notificationCategories.map((category) => (
              <Box key={category.id} sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={localSettings[category.id]}
                      onChange={(e) => handleSettingChange(category.id, e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {category.icon}
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          {category.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{ 
                    alignItems: 'flex-start',
                    '& .MuiFormControlLabel-label': {
                      mt: 0.5,
                    },
                  }}
                />
              </Box>
            ))}
          </FormGroup>

          <Divider sx={{ my: 3 }} />

          {/* Advanced Settings */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
              <Typography variant="h6">Advanced Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Reminder Timing */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Reminder Timing
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Default reminder time</InputLabel>
                    <Select
                      value={reminderTime}
                      label="Default reminder time"
                      onChange={(e) => setReminderTime(e.target.value as number)}
                    >
                      {reminderTimes.map((time) => (
                        <MenuItem key={time.value} value={time.value}>
                          {time.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Email Frequency */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Email Frequency
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Email frequency</InputLabel>
                    <Select
                      value={emailFrequency}
                      label="Email frequency"
                      onChange={(e) => setEmailFrequency(e.target.value)}
                      disabled={!localSettings.email}
                    >
                      {emailFrequencies.map((freq) => (
                        <MenuItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Quiet Hours */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Quiet Hours
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    No notifications will be sent during these hours
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small">
                      <InputLabel>From</InputLabel>
                      <Select
                        value="22:00"
                        label="From"
                        sx={{ minWidth: 100 }}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <MenuItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                            {`${i.toString().padStart(2, '0')}:00`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Typography>to</Typography>
                    <FormControl size="small">
                      <InputLabel>To</InputLabel>
                      <Select
                        value="08:00"
                        label="To"
                        sx={{ minWidth: 100 }}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <MenuItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                            {`${i.toString().padStart(2, '0')}:00`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Status Alert */}
          {hasChanges && (
            <Alert severity="info" sx={{ mt: 3 }}>
              You have unsaved changes. Click "Save Changes" to apply your preferences.
            </Alert>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleReset}
              disabled={!hasChanges || loading}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!hasChanges || loading}
              startIcon={<SaveOutlined />}
            >
              Save Changes
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};