import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Alert,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import {
  Add,
  CalendarToday,
  AccessTime,
  PriorityHigh,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { AdditionalSessionRequest, ClientChild } from '../../types';
import { format, addDays, isWeekend } from 'date-fns';

interface AdditionalSessionRequestDialogProps {
  open: boolean;
  child: ClientChild | null;
  onClose: () => void;
  onSubmit: (request: AdditionalSessionRequest) => void;
  loading?: boolean;
}

const sessionTypes = [
  'Individual ABA Therapy',
  'Group ABA Therapy',
  'Social Skills Training',
  'Behavioral Assessment',
  'Parent Training Session',
  'Consultation',
];

const timeSlots = [
  '9:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 1:00 PM',
  '1:00 PM - 2:00 PM',
  '2:00 PM - 3:00 PM',
  '3:00 PM - 4:00 PM',
  '4:00 PM - 5:00 PM',
  '5:00 PM - 6:00 PM',
  '6:00 PM - 7:00 PM',
];

export const AdditionalSessionRequestDialog: React.FC<AdditionalSessionRequestDialogProps> = ({
  open,
  child,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const [sessionType, setSessionType] = useState('');
  const [preferredDates, setPreferredDates] = useState<Date[]>([]);
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');

  const handleClose = () => {
    setSessionType('');
    setPreferredDates([]);
    setPreferredTimes([]);
    setReason('');
    setNotes('');
    setUrgency('medium');
    onClose();
  };

  const handleSubmit = () => {
    if (!child || !sessionType || !reason || preferredDates.length === 0) return;

    const request: AdditionalSessionRequest = {
      childId: child.id,
      sessionType,
      preferredDates,
      preferredTimes,
      reason,
      notes: notes || undefined,
      urgency,
    };

    onSubmit(request);
  };

  const handleDateAdd = (date: Date | null) => {
    if (date && !preferredDates.some(d => d.getTime() === date.getTime())) {
      setPreferredDates([...preferredDates, date]);
    }
  };

  const handleDateRemove = (dateToRemove: Date) => {
    setPreferredDates(preferredDates.filter(date => date.getTime() !== dateToRemove.getTime()));
  };

  const handleTimeToggle = (timeSlot: string) => {
    if (preferredTimes.includes(timeSlot)) {
      setPreferredTimes(preferredTimes.filter(t => t !== timeSlot));
    } else {
      setPreferredTimes([...preferredTimes, timeSlot]);
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const isFormValid = sessionType && reason && preferredDates.length > 0 && child;

  // Generate suggested dates (next 14 weekdays)
  const suggestedDates = [];
  let currentDate = addDays(new Date(), 1);
  while (suggestedDates.length < 14) {
    if (!isWeekend(currentDate)) {
      suggestedDates.push(new Date(currentDate));
    }
    currentDate = addDays(currentDate, 1);
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Add color="primary" />
            Request Additional Session
          </Box>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Request additional therapy sessions for {child?.name}. Our team will review your request and contact you within 24-48 hours.
          </Alert>

          <Box display="flex" flexDirection="column" gap={3}>
            {/* Session Type */}
            <FormControl fullWidth required>
              <InputLabel>Session Type</InputLabel>
              <Select
                value={sessionType}
                label="Session Type"
                onChange={(e) => setSessionType(e.target.value)}
              >
                {sessionTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Reason */}
            <TextField
              fullWidth
              required
              label="Reason for Additional Session"
              multiline
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you need an additional session (e.g., behavioral concerns, skill reinforcement, etc.)"
            />

            {/* Urgency */}
            <Box>
              <FormLabel component="legend" sx={{ mb: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PriorityHigh sx={{ fontSize: 20 }} />
                  Urgency Level
                </Box>
              </FormLabel>
              <RadioGroup
                row
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as 'low' | 'medium' | 'high')}
              >
                <FormControlLabel value="low" control={<Radio />} label="Low" />
                <FormControlLabel value="medium" control={<Radio />} label="Medium" />
                <FormControlLabel value="high" control={<Radio />} label="High" />
              </RadioGroup>
              <Typography variant="caption" color="text.secondary">
                High urgency requests will be prioritized for scheduling
              </Typography>
            </Box>

            {/* Preferred Dates */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                <CalendarToday sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                Preferred Dates *
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <DatePicker
                  label="Add preferred date"
                  value={null}
                  onChange={handleDateAdd}
                  minDate={addDays(new Date(), 1)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: false,
                    },
                  }}
                />
              </Box>

              {preferredDates.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Selected dates:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {preferredDates.map((date, index) => (
                      <Chip
                        key={index}
                        label={format(date, 'MMM dd, yyyy')}
                        onDelete={() => handleDateRemove(date)}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Quick select (next 2 weeks):
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {suggestedDates.slice(0, 10).map((date, index) => (
                    <Chip
                      key={index}
                      label={format(date, 'MMM dd')}
                      clickable
                      size="small"
                      color={preferredDates.some(d => d.getTime() === date.getTime()) ? 'primary' : 'default'}
                      variant={preferredDates.some(d => d.getTime() === date.getTime()) ? 'filled' : 'outlined'}
                      onClick={() => {
                        if (preferredDates.some(d => d.getTime() === date.getTime())) {
                          handleDateRemove(date);
                        } else {
                          handleDateAdd(date);
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>

            {/* Preferred Times */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                <AccessTime sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                Preferred Time Slots (Optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Select your preferred time slots to help us schedule your session
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {timeSlots.map((timeSlot) => (
                  <Chip
                    key={timeSlot}
                    label={timeSlot}
                    clickable
                    size="small"
                    color={preferredTimes.includes(timeSlot) ? 'primary' : 'default'}
                    variant={preferredTimes.includes(timeSlot) ? 'filled' : 'outlined'}
                    onClick={() => handleTimeToggle(timeSlot)}
                  />
                ))}
              </Box>
            </Box>

            {/* Additional Notes */}
            <TextField
              fullWidth
              label="Additional Notes (Optional)"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information that might help us schedule your session..."
            />

            {/* Summary */}
            {isFormValid && (
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Request Summary
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Typography variant="body2">
                    <strong>Session Type:</strong> {sessionType}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Preferred Dates:</strong> {preferredDates.length} date(s) selected
                  </Typography>
                  <Typography variant="body2">
                    <strong>Preferred Times:</strong> {preferredTimes.length > 0 ? `${preferredTimes.length} time slot(s)` : 'Any time'}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <strong>Urgency:</strong>
                    <Chip
                      label={urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                      size="small"
                      color={getUrgencyColor(urgency)}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!isFormValid || loading}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};