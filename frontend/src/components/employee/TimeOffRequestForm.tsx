import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { CalendarMonth, Info } from '@mui/icons-material';
import type { TimeOffRequest } from '../../types';

interface TimeOffRequestFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: Omit<TimeOffRequest, 'id' | 'employeeId' | 'submittedAt' | 'status'>) => void;
  loading?: boolean;
}

const timeOffReasons = [
  'Vacation',
  'Sick Leave',
  'Personal Day',
  'Family Emergency',
  'Medical Appointment',
  'Bereavement',
  'Other',
];

export const TimeOffRequestForm: React.FC<TimeOffRequestFormProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (startDate && endDate && startDate > endDate) {
      newErrors.dateRange = 'End date must be after start date';
    }

    if (!reason) {
      newErrors.reason = 'Reason is required';
    }

    // Check if dates are in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDate && startDate < today) {
      newErrors.startDate = 'Start date cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    onSubmit({
      startDate: startDate!,
      endDate: endDate!,
      reason,
      notes: notes.trim() || undefined,
    });
  };

  const handleClose = () => {
    setStartDate(null);
    setEndDate(null);
    setReason('');
    setNotes('');
    setErrors({});
    onClose();
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
    return daysDiff;
  };

  const getDayType = () => {
    const days = calculateDays();
    if (days === 1) return 'day';
    return 'days';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonth color="primary" />
          Request Time Off
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {errors.dateRange && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.dateRange}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Box sx={{ flex: 1 }}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(newValue) => {
                    setStartDate(newValue);
                    setErrors(prev => ({ ...prev, startDate: '', dateRange: '' }));
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.startDate,
                      helperText: errors.startDate,
                    },
                  }}
                  minDate={new Date()}
                />
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => {
                    setEndDate(newValue);
                    setErrors(prev => ({ ...prev, endDate: '', dateRange: '' }));
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.endDate,
                      helperText: errors.endDate,
                    },
                  }}
                  minDate={startDate || new Date()}
                />
              </Box>
            </Box>

            {startDate && endDate && calculateDays() > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Info color="primary" fontSize="small" />
                  <Typography variant="subtitle2" color="primary.main">
                    Time Off Summary
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  You are requesting <Chip 
                    label={`${calculateDays()} ${getDayType()}`} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  /> off from{' '}
                  <strong>{startDate.toLocaleDateString()}</strong> to{' '}
                  <strong>{endDate.toLocaleDateString()}</strong>
                </Typography>
              </Box>
            )}

            <FormControl fullWidth sx={{ mt: 2 }} error={!!errors.reason}>
              <InputLabel>Reason</InputLabel>
              <Select
                value={reason}
                label="Reason"
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors(prev => ({ ...prev, reason: '' }));
                }}
              >
                {timeOffReasons.map((reasonOption) => (
                  <MenuItem key={reasonOption} value={reasonOption}>
                    {reasonOption}
                  </MenuItem>
                ))}
              </Select>
              {errors.reason && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  {errors.reason}
                </Typography>
              )}
            </FormControl>

            <TextField
              fullWidth
              label="Additional Notes (Optional)"
              multiline
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any additional details about your time-off request..."
              sx={{ mt: 2 }}
            />

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Your request will be reviewed by your supervisor. You will receive a notification once it's approved or denied.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !startDate || !endDate || !reason}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default TimeOffRequestForm;