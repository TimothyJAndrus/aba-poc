import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Box,
  Typography,
  Chip,
  Stack,
  Alert,
  Divider,
  Select,
  MenuItem,
  InputLabel,
  Checkbox,
  FormGroup,
} from '@mui/material';
import {
  DatePicker,
  TimePicker,
} from '@mui/x-date-pickers';
import {
  Repeat,
  Event,
} from '@mui/icons-material';
import { addDays, addWeeks, addMonths, format, startOfWeek } from 'date-fns';

interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // Every X days/weeks/months
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  endDate?: Date;
  occurrences?: number;
  exceptions?: Date[]; // Dates to skip
}

interface RecurringSessionData {
  title: string;
  startTime: Date;
  endTime: Date;
  clientId: string;
  rbtId: string;
  sessionType: string;
  location?: string;
  pattern: RecurringPattern;
}

interface RecurringSessionManagerProps {
  open: boolean;
  onClose: () => void;
  onSave: (sessionData: RecurringSessionData) => void;
  initialData?: Partial<RecurringSessionData>;
  clients: Array<{ id: string; name: string }>;
  rbts: Array<{ id: string; name: string }>;
}

export const RecurringSessionManager: React.FC<RecurringSessionManagerProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  clients = [],
  rbts = [],
}) => {
  const [sessionData, setSessionData] = useState<RecurringSessionData>({
    title: '',
    startTime: new Date(),
    endTime: new Date(),
    clientId: '',
    rbtId: '',
    sessionType: 'ABA Therapy',
    location: '',
    pattern: {
      type: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
      occurrences: 12,
    },
    ...initialData,
  });

  const [previewSessions, setPreviewSessions] = useState<Date[]>([]);

  const handlePatternChange = (field: keyof RecurringPattern, value: any) => {
    const newPattern = { ...sessionData.pattern, [field]: value };
    setSessionData({ ...sessionData, pattern: newPattern });
    generatePreview(newPattern);
  };

  const handleDayOfWeekChange = (day: number, checked: boolean) => {
    const currentDays = sessionData.pattern.daysOfWeek || [];
    const newDays = checked
      ? [...currentDays, day].sort()
      : currentDays.filter(d => d !== day);
    
    handlePatternChange('daysOfWeek', newDays);
  };

  const generatePreview = (pattern: RecurringPattern) => {
    const sessions: Date[] = [];
    const startDate = sessionData.startTime;
    let currentDate = new Date(startDate);
    
    const maxSessions = pattern.occurrences || 20;
    const endDate = pattern.endDate || addMonths(startDate, 6);

    for (let i = 0; i < maxSessions && currentDate <= endDate; i++) {
      switch (pattern.type) {
        case 'daily':
          if (i > 0) {
            currentDate = addDays(currentDate, pattern.interval);
          }
          sessions.push(new Date(currentDate));
          break;

        case 'weekly':
          if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
            // For weekly patterns with specific days
            if (i === 0) {
              // First session uses the selected start date
              sessions.push(new Date(currentDate));
            } else {
              // Find next occurrence
              const weekStart = startOfWeek(currentDate);
              let found = false;
              
              for (const dayOfWeek of pattern.daysOfWeek) {
                const nextDate = addDays(weekStart, dayOfWeek);
                if (nextDate > currentDate && nextDate <= endDate) {
                  currentDate = nextDate;
                  sessions.push(new Date(currentDate));
                  found = true;
                  break;
                }
              }
              
              if (!found) {
                // Move to next week
                currentDate = addWeeks(weekStart, pattern.interval);
                const nextWeekStart = startOfWeek(currentDate);
                const firstDay = pattern.daysOfWeek[0];
                currentDate = addDays(nextWeekStart, firstDay);
                if (currentDate <= endDate) {
                  sessions.push(new Date(currentDate));
                }
              }
            }
          } else {
            if (i > 0) {
              currentDate = addWeeks(currentDate, pattern.interval);
            }
            sessions.push(new Date(currentDate));
          }
          break;

        case 'monthly':
          if (i > 0) {
            currentDate = addMonths(currentDate, pattern.interval);
          }
          sessions.push(new Date(currentDate));
          break;
      }
    }

    setPreviewSessions(sessions.slice(0, 10)); // Show first 10 for preview
  };

  const handleSave = () => {
    if (!sessionData.clientId || !sessionData.rbtId || !sessionData.title) {
      return;
    }
    onSave(sessionData);
    onClose();
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  React.useEffect(() => {
    generatePreview(sessionData.pattern);
  }, [sessionData.startTime]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Repeat />
          Create Recurring Sessions
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Basic Session Information */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Session Details
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Session Title"
                value={sessionData.title}
                onChange={(e) => setSessionData({ ...sessionData, title: e.target.value })}
                placeholder="e.g., ABA Therapy - John Doe"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Client</InputLabel>
                  <Select
                    value={sessionData.clientId}
                    onChange={(e) => setSessionData({ ...sessionData, clientId: e.target.value })}
                    label="Client"
                  >
                    {clients.map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {client.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>RBT</InputLabel>
                  <Select
                    value={sessionData.rbtId}
                    onChange={(e) => setSessionData({ ...sessionData, rbtId: e.target.value })}
                    label="RBT"
                  >
                    {rbts.map((rbt) => (
                      <MenuItem key={rbt.id} value={rbt.id}>
                        {rbt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={sessionData.startTime}
                  onChange={(date) => date && setSessionData({ 
                    ...sessionData, 
                    startTime: date 
                  })}
                />
                <TimePicker
                  label="Start Time"
                  value={sessionData.startTime}
                  onChange={(time) => time && setSessionData({ 
                    ...sessionData, 
                    startTime: time 
                  })}
                />
                <TimePicker
                  label="End Time"
                  value={sessionData.endTime}
                  onChange={(time) => time && setSessionData({ 
                    ...sessionData, 
                    endTime: time 
                  })}
                />
              </Box>

              <TextField
                fullWidth
                label="Location (Optional)"
                value={sessionData.location}
                onChange={(e) => setSessionData({ ...sessionData, location: e.target.value })}
              />
            </Stack>
          </Box>

          <Divider />

          {/* Recurrence Pattern */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Recurrence Pattern
            </Typography>
            
            <FormControl component="fieldset">
              <FormLabel component="legend">Repeat</FormLabel>
              <RadioGroup
                value={sessionData.pattern.type}
                onChange={(e) => handlePatternChange('type', e.target.value)}
              >
                <FormControlLabel value="daily" control={<Radio />} label="Daily" />
                <FormControlLabel value="weekly" control={<Radio />} label="Weekly" />
                <FormControlLabel value="monthly" control={<Radio />} label="Monthly" />
              </RadioGroup>
            </FormControl>

            <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="Every"
                type="number"
                value={sessionData.pattern.interval}
                onChange={(e) => handlePatternChange('interval', parseInt(e.target.value) || 1)}
                sx={{ width: 100 }}
                inputProps={{ min: 1, max: 12 }}
              />
              <Typography>
                {sessionData.pattern.type === 'daily' ? 'day(s)' :
                 sessionData.pattern.type === 'weekly' ? 'week(s)' : 'month(s)'}
              </Typography>
            </Box>

            {sessionData.pattern.type === 'weekly' && (
              <Box sx={{ mt: 2 }}>
                <FormLabel component="legend">Days of the week</FormLabel>
                <FormGroup row>
                  {dayNames.map((day, index) => (
                    <FormControlLabel
                      key={index}
                      control={
                        <Checkbox
                          checked={sessionData.pattern.daysOfWeek?.includes(index) || false}
                          onChange={(e) => handleDayOfWeekChange(index, e.target.checked)}
                        />
                      }
                      label={day}
                    />
                  ))}
                </FormGroup>
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">End after</FormLabel>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                  <TextField
                    label="Number of sessions"
                    type="number"
                    value={sessionData.pattern.occurrences || ''}
                    onChange={(e) => handlePatternChange('occurrences', parseInt(e.target.value) || undefined)}
                    sx={{ width: 150 }}
                    inputProps={{ min: 1, max: 100 }}
                  />
                  <Typography>or</Typography>
                  <DatePicker
                    label="End date"
                    value={sessionData.pattern.endDate || null}
                    onChange={(date) => handlePatternChange('endDate', date)}
                  />
                </Box>
              </FormControl>
            </Box>
          </Box>

          <Divider />

          {/* Preview */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Preview (First 10 sessions)
            </Typography>
            {previewSessions.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {previewSessions.map((date, index) => (
                  <Chip
                    key={index}
                    icon={<Event />}
                    label={format(date, 'MMM d, yyyy')}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                No sessions will be created with the current pattern.
              </Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!sessionData.clientId || !sessionData.rbtId || !sessionData.title}
        >
          Create {previewSessions.length} Sessions
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecurringSessionManager;