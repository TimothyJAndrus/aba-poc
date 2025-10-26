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
  FormControlLabel,
  Checkbox,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Warning,
  CalendarToday,
  AccessTime,
  Person,
} from '@mui/icons-material';
import type { ClientSession, SessionCancellationRequest } from '../../types';
import { format } from 'date-fns';

interface SessionCancellationDialogProps {
  open: boolean;
  session: ClientSession | null;
  onClose: () => void;
  onConfirm: (request: SessionCancellationRequest) => void;
  loading?: boolean;
}

const cancellationReasons = [
  'Child is sick',
  'Family emergency',
  'Transportation issues',
  'Scheduling conflict',
  'Weather conditions',
  'Other',
];

export const SessionCancellationDialog: React.FC<SessionCancellationDialogProps> = ({
  open,
  session,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [requestAlternative, setRequestAlternative] = useState(false);
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);

  const handleClose = () => {
    setReason('');
    setNotes('');
    setRequestAlternative(false);
    setPreferredTimes([]);
    onClose();
  };

  const handleConfirm = () => {
    if (!session || !reason) return;

    const request: SessionCancellationRequest = {
      sessionId: session.id,
      reason,
      notes: notes || undefined,
      requestAlternative,
      preferredTimes: preferredTimes.map(time => new Date(time)),
    };

    onConfirm(request);
  };

  const isFormValid = reason && session;

  if (!session) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Warning color="warning" />
          Cancel Session
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          You are about to cancel a scheduled session. Please provide a reason for the cancellation.
        </Alert>

        {/* Session Details */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Session Details
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {format(new Date(session.startTime), 'EEEE, MMMM dd, yyyy')}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {format(new Date(session.startTime), 'h:mm a')} - {format(new Date(session.endTime), 'h:mm a')}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                RBT: {session.rbtName}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={session.sessionType}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        </Box>

        <Box display="flex" flexDirection="column" gap={3}>
          {/* Cancellation Reason */}
          <FormControl fullWidth required>
            <InputLabel>Reason for Cancellation</InputLabel>
            <Select
              value={reason}
              label="Reason for Cancellation"
              onChange={(e) => setReason(e.target.value)}
            >
              {cancellationReasons.map((reasonOption) => (
                <MenuItem key={reasonOption} value={reasonOption}>
                  {reasonOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Additional Notes */}
          <TextField
            fullWidth
            label="Additional Notes (Optional)"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Please provide any additional details about the cancellation..."
          />

          <Divider />

          {/* Request Alternative */}
          <FormControlLabel
            control={
              <Checkbox
                checked={requestAlternative}
                onChange={(e) => setRequestAlternative(e.target.checked)}
              />
            }
            label="I would like to request an alternative session time"
          />

          {requestAlternative && (
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Please select your preferred alternative times (optional):
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                {['Morning (9:00 AM - 12:00 PM)', 'Afternoon (12:00 PM - 5:00 PM)', 'Evening (5:00 PM - 8:00 PM)'].map((timeSlot) => (
                  <Chip
                    key={timeSlot}
                    label={timeSlot}
                    clickable
                    color={preferredTimes.includes(timeSlot) ? 'primary' : 'default'}
                    variant={preferredTimes.includes(timeSlot) ? 'filled' : 'outlined'}
                    onClick={() => {
                      if (preferredTimes.includes(timeSlot)) {
                        setPreferredTimes(preferredTimes.filter(t => t !== timeSlot));
                      } else {
                        setPreferredTimes([...preferredTimes, timeSlot]);
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Keep Session
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="warning"
          disabled={!isFormValid || loading}
        >
          {loading ? 'Cancelling...' : 'Cancel Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};