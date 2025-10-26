import React, { useState, useEffect } from 'react';
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
  Chip,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Radio,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Schedule,
  CalendarToday,
  AccessTime,
  Person,
  CheckCircle,
} from '@mui/icons-material';
import type { ClientSession } from '../../types';
import { format, addDays, isWeekend } from 'date-fns';

interface AvailableTimeSlot {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  rbtName: string;
  rbtId: string;
  sessionType: string;
}

interface SessionRescheduleDialogProps {
  open: boolean;
  session: ClientSession | null;
  onClose: () => void;
  onConfirm: (sessionId: string, newTimeSlotId: string, reason: string) => void;
  loading?: boolean;
}

const rescheduleReasons = [
  'Scheduling conflict',
  'Transportation issues',
  'Child availability',
  'Family emergency',
  'Medical appointment',
  'Other',
];

export const SessionRescheduleDialog: React.FC<SessionRescheduleDialogProps> = ({
  open,
  session,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<AvailableTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Mock available time slots - in real app, this would come from API
  useEffect(() => {
    if (open && session) {
      setLoadingSlots(true);
      // Simulate API call
      setTimeout(() => {
        const mockSlots: AvailableTimeSlot[] = [];
        
        // Generate available slots for next 14 days
        for (let i = 1; i <= 14; i++) {
          const date = addDays(new Date(), i);
          if (!isWeekend(date)) {
            // Morning slots
            mockSlots.push({
              id: `slot-${i}-1`,
              date,
              startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0),
              endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0),
              rbtName: session.rbtName,
              rbtId: session.rbtId,
              sessionType: session.sessionType,
            });
            
            // Afternoon slots
            mockSlots.push({
              id: `slot-${i}-2`,
              date,
              startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14, 0),
              endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15, 0),
              rbtName: session.rbtName,
              rbtId: session.rbtId,
              sessionType: session.sessionType,
            });
            
            // Some slots with different RBT
            if (i % 3 === 0) {
              mockSlots.push({
                id: `slot-${i}-3`,
                date,
                startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 11, 0),
                endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0),
                rbtName: 'Sarah Johnson, RBT',
                rbtId: 'rbt-2',
                sessionType: session.sessionType,
              });
            }
          }
        }
        
        setAvailableSlots(mockSlots);
        setLoadingSlots(false);
      }, 1000);
    }
  }, [open, session]);

  const handleClose = () => {
    setReason('');
    setSelectedTimeSlot('');
    setAvailableSlots([]);
    onClose();
  };

  const handleConfirm = () => {
    if (!session || !selectedTimeSlot || !reason) return;
    onConfirm(session.id, selectedTimeSlot, reason);
  };

  const groupSlotsByDate = (slots: AvailableTimeSlot[]) => {
    const grouped: { [key: string]: AvailableTimeSlot[] } = {};
    slots.forEach(slot => {
      const dateKey = format(slot.date, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });
    return grouped;
  };

  const isFormValid = reason && selectedTimeSlot && session;
  const groupedSlots = groupSlotsByDate(availableSlots);

  if (!session) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Schedule color="primary" />
          Reschedule Session
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          Select a new time slot for your session. We'll confirm the change with your RBT.
        </Alert>

        {/* Current Session Details */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Current Session
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
          {/* Reschedule Reason */}
          <FormControl fullWidth required>
            <InputLabel>Reason for Rescheduling</InputLabel>
            <Select
              value={reason}
              label="Reason for Rescheduling"
              onChange={(e) => setReason(e.target.value)}
            >
              {rescheduleReasons.map((reasonOption) => (
                <MenuItem key={reasonOption} value={reasonOption}>
                  {reasonOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Available Time Slots */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Available Time Slots
            </Typography>
            
            {loadingSlots ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ maxHeight: 400, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {Object.keys(groupedSlots).length === 0 ? (
                  <Box p={3} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      No available time slots found. Please contact us directly to reschedule.
                    </Typography>
                  </Box>
                ) : (
                  Object.entries(groupedSlots).map(([dateKey, slots]) => (
                    <Box key={dateKey}>
                      <Box sx={{ p: 2, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {format(new Date(dateKey), 'EEEE, MMMM dd, yyyy')}
                        </Typography>
                      </Box>
                      <List disablePadding>
                        {slots.map((slot, index) => (
                          <React.Fragment key={slot.id}>
                            {index > 0 && <Divider />}
                            <ListItem disablePadding>
                              <ListItemButton
                                selected={selectedTimeSlot === slot.id}
                                onClick={() => setSelectedTimeSlot(slot.id)}
                              >
                                <ListItemIcon>
                                  <Radio
                                    checked={selectedTimeSlot === slot.id}
                                    value={slot.id}
                                    name="time-slot"
                                  />
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                      <Typography variant="body2" fontWeight="medium">
                                        {format(slot.startTime, 'h:mm a')} - {format(slot.endTime, 'h:mm a')}
                                      </Typography>
                                      {slot.rbtId === session.rbtId && (
                                        <Chip
                                          label="Same RBT"
                                          size="small"
                                          color="success"
                                          variant="outlined"
                                          icon={<CheckCircle />}
                                        />
                                      )}
                                    </Box>
                                  }
                                  secondary={
                                    <Box mt={0.5}>
                                      <Typography variant="caption" color="text.secondary">
                                        RBT: {slot.rbtName}
                                      </Typography>
                                      <br />
                                      <Typography variant="caption" color="text.secondary">
                                        Session Type: {slot.sessionType}
                                      </Typography>
                                    </Box>
                                  }
                                />
                              </ListItemButton>
                            </ListItem>
                          </React.Fragment>
                        ))}
                      </List>
                    </Box>
                  ))
                )}
              </Box>
            )}
          </Box>

          {/* Selected Slot Summary */}
          {selectedTimeSlot && (
            <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 1, border: 1, borderColor: 'success.200' }}>
              <Typography variant="subtitle2" color="success.dark" gutterBottom>
                New Session Details
              </Typography>
              {(() => {
                const selectedSlot = availableSlots.find(slot => slot.id === selectedTimeSlot);
                if (!selectedSlot) return null;
                
                return (
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Typography variant="body2" color="success.dark">
                      <strong>Date:</strong> {format(selectedSlot.date, 'EEEE, MMMM dd, yyyy')}
                    </Typography>
                    <Typography variant="body2" color="success.dark">
                      <strong>Time:</strong> {format(selectedSlot.startTime, 'h:mm a')} - {format(selectedSlot.endTime, 'h:mm a')}
                    </Typography>
                    <Typography variant="body2" color="success.dark">
                      <strong>RBT:</strong> {selectedSlot.rbtName}
                    </Typography>
                  </Box>
                );
              })()}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!isFormValid || loading}
        >
          {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};