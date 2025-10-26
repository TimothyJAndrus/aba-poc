import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  SelectAll,
  ClearAll,
  Delete,
  Edit,
  Cancel,
  EventRepeat,
  CheckCircle,
  Event,
  Person,
  Schedule,
  Close,
} from '@mui/icons-material';
import type { CalendarEvent } from '../../types';
import { format } from 'date-fns';

interface BulkOperation {
  type: 'cancel' | 'reschedule' | 'complete' | 'delete' | 'update';
  reason?: string;
  newDate?: Date;
  newRbtId?: string;
  newLocation?: string;
}

interface BulkOperationsProps {
  open: boolean;
  sessions: CalendarEvent[];
  onClose: () => void;
  onExecute: (sessionIds: string[], operation: BulkOperation) => void;
  userRole?: 'admin' | 'employee' | 'client';
  rbts?: Array<{ id: string; name: string }>;
}

export const BulkOperations: React.FC<BulkOperationsProps> = ({
  open,
  sessions,
  onClose,
  onExecute,
  userRole = 'admin',
  rbts = [],
}) => {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [operation, setOperation] = useState<BulkOperation['type']>('cancel');
  const [reason, setReason] = useState('');
  const [newRbtId, setNewRbtId] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const handleSessionToggle = (sessionId: string) => {
    setSelectedSessions(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleSelectAll = () => {
    const eligibleSessions = sessions
      .filter(session => canOperateOnSession(session))
      .map(session => session.id);
    setSelectedSessions(eligibleSessions);
  };

  const handleDeselectAll = () => {
    setSelectedSessions([]);
  };

  const canOperateOnSession = (session: CalendarEvent): boolean => {
    // Only allow operations on scheduled sessions
    if (session.status !== 'scheduled') return false;

    // Role-based permissions
    switch (userRole) {
      case 'admin':
        return true;
      case 'employee':
        return operation === 'complete' || operation === 'update';
      case 'client':
        return operation === 'cancel' || operation === 'reschedule';
      default:
        return false;
    }
  };

  const getOperationIcon = (type: BulkOperation['type']) => {
    switch (type) {
      case 'cancel':
        return <Cancel color="error" />;
      case 'reschedule':
        return <EventRepeat color="warning" />;
      case 'complete':
        return <CheckCircle color="success" />;
      case 'delete':
        return <Delete color="error" />;
      case 'update':
        return <Edit color="primary" />;
      default:
        return <Event />;
    }
  };

  const getOperationLabel = (type: BulkOperation['type']) => {
    switch (type) {
      case 'cancel':
        return 'Cancel Sessions';
      case 'reschedule':
        return 'Reschedule Sessions';
      case 'complete':
        return 'Mark as Complete';
      case 'delete':
        return 'Delete Sessions';
      case 'update':
        return 'Update Sessions';
      default:
        return 'Unknown Operation';
    }
  };

  const getAvailableOperations = (): BulkOperation['type'][] => {
    const operations: BulkOperation['type'][] = [];
    
    switch (userRole) {
      case 'admin':
        operations.push('cancel', 'reschedule', 'complete', 'delete', 'update');
        break;
      case 'employee':
        operations.push('complete', 'update');
        break;
      case 'client':
        operations.push('cancel', 'reschedule');
        break;
    }
    
    return operations;
  };

  const handleExecute = () => {
    if (selectedSessions.length === 0) return;

    const bulkOperation: BulkOperation = {
      type: operation,
      reason: reason || undefined,
      newRbtId: newRbtId || undefined,
      newLocation: newLocation || undefined,
    };

    onExecute(selectedSessions, bulkOperation);
    
    // Reset form
    setSelectedSessions([]);
    setReason('');
    setNewRbtId('');
    setNewLocation('');
    onClose();
  };

  const eligibleSessions = sessions.filter(canOperateOnSession);
  const selectedSessionsData = sessions.filter(session => 
    selectedSessions.includes(session.id)
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getOperationIcon(operation)}
            Bulk Session Operations
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Operation Selection */}
          <Box>
            <FormControl fullWidth>
              <InputLabel>Operation</InputLabel>
              <Select
                value={operation}
                onChange={(e) => setOperation(e.target.value as BulkOperation['type'])}
                label="Operation"
              >
                {getAvailableOperations().map((op) => (
                  <MenuItem key={op} value={op}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getOperationIcon(op)}
                      {getOperationLabel(op)}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Operation-specific fields */}
          {(operation === 'cancel' || operation === 'delete') && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason (Required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for this action..."
              required
            />
          )}

          {operation === 'update' && (
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>New RBT (Optional)</InputLabel>
                <Select
                  value={newRbtId}
                  onChange={(e) => setNewRbtId(e.target.value)}
                  label="New RBT (Optional)"
                >
                  <MenuItem value="">
                    <em>No change</em>
                  </MenuItem>
                  {rbts.map((rbt) => (
                    <MenuItem key={rbt.id} value={rbt.id}>
                      {rbt.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="New Location (Optional)"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Leave empty to keep current location"
              />
            </Stack>
          )}

          <Divider />

          {/* Session Selection */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">
                Select Sessions ({selectedSessions.length} of {eligibleSessions.length} selected)
              </Typography>
              <Box>
                <Tooltip title="Select All">
                  <IconButton onClick={handleSelectAll} size="small">
                    <SelectAll />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Deselect All">
                  <IconButton onClick={handleDeselectAll} size="small">
                    <ClearAll />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {eligibleSessions.length === 0 ? (
              <Alert severity="info">
                No sessions are eligible for the selected operation.
              </Alert>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {eligibleSessions.map((session) => (
                  <ListItem
                    key={session.id}
                    dense
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedSessions.includes(session.id)}
                        onChange={() => handleSessionToggle(session.id)}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {session.title}
                          </Typography>
                          <Chip
                            label={session.status}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Schedule fontSize="small" />
                            <Typography variant="caption">
                              {format(session.start, 'MMM d, yyyy h:mm a')} - {format(session.end, 'h:mm a')}
                            </Typography>
                          </Box>
                          {session.participants.client && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Person fontSize="small" />
                              <Typography variant="caption">
                                {session.participants.client.name}
                                {session.participants.rbt && ` • ${session.participants.rbt.name}`}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Selected Sessions Summary */}
          {selectedSessionsData.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="h6" gutterBottom>
                  Selected Sessions Summary
                </Typography>
                <Alert severity="warning">
                  You are about to {getOperationLabel(operation).toLowerCase()} {selectedSessionsData.length} session(s).
                  This action cannot be undone.
                </Alert>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          color={operation === 'delete' || operation === 'cancel' ? 'error' : 'primary'}
          disabled={
            selectedSessions.length === 0 ||
            ((operation === 'cancel' || operation === 'delete') && !reason.trim())
          }
        >
          {getOperationLabel(operation)} ({selectedSessions.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkOperations;