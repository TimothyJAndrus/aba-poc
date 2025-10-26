import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Avatar,
  Divider,
  IconButton,
  TextField,
  Stack,
  Alert,
} from '@mui/material';
import {
  Close,
  Edit,
  Delete,
  Person,
  Schedule,
  LocationOn,
  Notes,
  Cancel,
  Reschedule,
} from '@mui/icons-material';
import { CalendarEvent } from '../../types';
import { format } from 'date-fns';

interface EventDetailsModalProps {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  onCancel?: (eventId: string, reason: string) => void;
  onReschedule?: (eventId: string) => void;
  editable?: boolean;
  userRole?: 'admin' | 'employee' | 'client';
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  open,
  event,
  onClose,
  onEdit,
  onDelete,
  onCancel,
  onReschedule,
  editable = false,
  userRole = 'client',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!event) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'success';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      case 'rescheduled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'session':
        return '🎯';
      case 'time-off':
        return '🏖️';
      case 'meeting':
        return '👥';
      default:
        return '📅';
    }
  };

  const handleCancel = () => {
    if (onCancel && cancelReason.trim()) {
      onCancel(event.id, cancelReason);
      setShowCancelForm(false);
      setCancelReason('');
      onClose();
    }
  };

  const canEdit = editable && (userRole === 'admin' || (userRole === 'employee' && event.type === 'time-off'));
  const canCancel = userRole === 'admin' || userRole === 'client';
  const canReschedule = userRole === 'admin' || userRole === 'client';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="span">
              {getTypeIcon(event.type)} {event.title}
            </Typography>
            <Chip
              label={event.status}
              color={getStatusColor(event.status) as any}
              size="small"
              variant="outlined"
            />
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {/* Time Information */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Schedule color="action" />
              <Typography variant="subtitle2">Schedule</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {format(event.start, 'EEEE, MMMM d, yyyy')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
            </Typography>
          </Box>

          <Divider />

          {/* Participants */}
          {(event.participants.client || event.participants.rbt) && (
            <>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Person color="action" />
                  <Typography variant="subtitle2">Participants</Typography>
                </Box>
                <Stack spacing={1}>
                  {event.participants.client && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24 }}>
                        {event.participants.client.name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">
                        {event.participants.client.name} (Client)
                      </Typography>
                    </Box>
                  )}
                  {event.participants.rbt && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24 }}>
                        {event.participants.rbt.name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">
                        {event.participants.rbt.name} (RBT)
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
              <Divider />
            </>
          )}

          {/* Session Type and Notes */}
          {event.type === 'session' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Notes color="action" />
                <Typography variant="subtitle2">Session Details</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                ABA Therapy Session
              </Typography>
            </Box>
          )}

          {/* Cancel Form */}
          {showCancelForm && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Please provide a reason for cancelling this session.
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Cancellation Reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please explain why you need to cancel this session..."
              />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {showCancelForm ? (
          <>
            <Button onClick={() => setShowCancelForm(false)}>
              Back
            </Button>
            <Button
              onClick={handleCancel}
              color="error"
              variant="contained"
              disabled={!cancelReason.trim()}
            >
              Confirm Cancellation
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Close</Button>
            
            {event.status === 'scheduled' && (
              <>
                {canReschedule && onReschedule && (
                  <Button
                    startIcon={<Reschedule />}
                    onClick={() => {
                      onReschedule(event.id);
                      onClose();
                    }}
                  >
                    Reschedule
                  </Button>
                )}
                
                {canCancel && onCancel && (
                  <Button
                    startIcon={<Cancel />}
                    color="error"
                    onClick={() => setShowCancelForm(true)}
                  >
                    Cancel Session
                  </Button>
                )}
              </>
            )}
            
            {canEdit && onEdit && (
              <Button
                startIcon={<Edit />}
                variant="contained"
                onClick={() => {
                  onEdit(event);
                  onClose();
                }}
              >
                Edit
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EventDetailsModal;