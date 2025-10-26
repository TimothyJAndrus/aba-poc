import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Refresh,
} from '@mui/icons-material';
import { TimeOffRequestForm, TimeOffHistory } from '../../components/employee';
import { apiService } from '../../services/api';
import type { TimeOffRequest } from '../../types';

export const TimeOffManagement: React.FC = () => {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTimeOffRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.get<TimeOffRequest[]>('/employee/time-off');
      setRequests(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch time off requests');
      console.error('Error fetching time off requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeOffRequests();
  }, []);

  const handleSubmitRequest = async (requestData: Omit<TimeOffRequest, 'id' | 'employeeId' | 'submittedAt' | 'status'>) => {
    try {
      setSubmitting(true);
      
      const newRequest = await apiService.post<TimeOffRequest>('/employee/time-off', requestData);
      
      // Add the new request to the list
      setRequests(prev => [newRequest, ...prev]);
      
      setFormOpen(false);
      setSuccessMessage('Time off request submitted successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit time off request');
      console.error('Error submitting time off request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = () => {
    fetchTimeOffRequests();
  };

  const handleCloseSuccess = () => {
    setSuccessMessage(null);
  };

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const approvedRequests = requests.filter(req => req.status === 'approved');
  const totalDaysRequested = requests
    .filter(req => req.status === 'approved')
    .reduce((total, req) => {
      const timeDiff = req.endDate.getTime() - req.startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      return total + daysDiff;
    }, 0);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Time Off Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setFormOpen(true)}
          >
            Request Time Off
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              p: 2,
              bgcolor: 'warning.50',
              borderRadius: 1,
              border: 1,
              borderColor: 'warning.200',
            }}
          >
            <Typography variant="h4" color="warning.main" sx={{ fontWeight: 600 }}>
              {pendingRequests.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pending Requests
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              p: 2,
              bgcolor: 'success.50',
              borderRadius: 1,
              border: 1,
              borderColor: 'success.200',
            }}
          >
            <Typography variant="h4" color="success.main" sx={{ fontWeight: 600 }}>
              {approvedRequests.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approved Requests
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              p: 2,
              bgcolor: 'primary.50',
              borderRadius: 1,
              border: 1,
              borderColor: 'primary.200',
            }}
          >
            <Typography variant="h4" color="primary.main" sx={{ fontWeight: 600 }}>
              {totalDaysRequested}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Days Approved This Year
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Time Off History */}
      <TimeOffHistory
        requests={requests}
        loading={loading}
        onRefresh={handleRefresh}
      />

      {/* Time Off Request Form */}
      <TimeOffRequestForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmitRequest}
        loading={submitting}
      />

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TimeOffManagement;