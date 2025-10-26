import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Box,
  IconButton,
  Collapse,
  Button,
  Tooltip,
  TablePagination,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  CalendarMonth,
  Refresh,
  FilterList,
} from '@mui/icons-material';
import type { TimeOffRequest } from '../../types';

interface TimeOffHistoryProps {
  requests: TimeOffRequest[];
  loading?: boolean;
  onRefresh?: () => void;
}

interface ExpandedRowProps {
  request: TimeOffRequest;
  expanded: boolean;
}

const getStatusColor = (status: TimeOffRequest['status']) => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'denied':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: TimeOffRequest['status']) => {
  switch (status) {
    case 'approved':
      return '✓';
    case 'denied':
      return '✗';
    case 'pending':
      return '⏳';
    default:
      return '';
  }
};

const formatDateRange = (startDate: Date, endDate: Date) => {
  const start = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(startDate);
  
  const end = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(endDate);
  
  if (startDate.toDateString() === endDate.toDateString()) {
    return start;
  }
  
  return `${start} - ${end}`;
};

const calculateDays = (startDate: Date, endDate: Date) => {
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  return daysDiff;
};

const ExpandedRow: React.FC<ExpandedRowProps> = ({ request, expanded }) => {
  return (
    <TableRow>
      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ margin: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Request Details
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Submitted
                </Typography>
                <Typography variant="body2">
                  {new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(request.submittedAt)}
                </Typography>
              </Box>
              
              {request.reviewedAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reviewed
                  </Typography>
                  <Typography variant="body2">
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(request.reviewedAt)}
                  </Typography>
                </Box>
              )}
              
              {request.reviewedBy && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reviewed By
                  </Typography>
                  <Typography variant="body2">
                    {request.reviewedBy}
                  </Typography>
                </Box>
              )}
              
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Duration
                </Typography>
                <Typography variant="body2">
                  {calculateDays(request.startDate, request.endDate)} {calculateDays(request.startDate, request.endDate) === 1 ? 'day' : 'days'}
                </Typography>
              </Box>
            </Box>
            
            {request.notes && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Notes
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {request.notes}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
};

export const TimeOffHistory: React.FC<TimeOffHistoryProps> = ({
  requests,
  loading = false,
  onRefresh,
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleExpandRow = (requestId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRows(newExpanded);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Sort requests by submission date (newest first)
  const sortedRequests = [...requests].sort((a, b) => 
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  const paginatedRequests = sortedRequests.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Card>
        <CardHeader title="Time Off History" />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Loading time off history...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader title="Time Off History" />
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CalendarMonth sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No time off requests found
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Time Off History"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Filter requests">
              <IconButton size="small">
                <FilterList />
              </IconButton>
            </Tooltip>
            {onRefresh && (
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={onRefresh}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        }
      />
      <CardContent sx={{ p: 0 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50}></TableCell>
                <TableCell>Date Range</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell width={100}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRequests.map((request) => (
                <React.Fragment key={request.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleExpandRow(request.id)}
                      >
                        {expandedRows.has(request.id) ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateRange(request.startDate, request.endDate)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {calculateDays(request.startDate, request.endDate)} {calculateDays(request.startDate, request.endDate) === 1 ? 'day' : 'days'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {request.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={getStatusColor(request.status) as any}
                        size="small"
                        icon={<span>{getStatusIcon(request.status)}</span>}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                        }).format(request.submittedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleExpandRow(request.id)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                  <ExpandedRow
                    request={request}
                    expanded={expandedRows.has(request.id)}
                  />
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={requests.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </CardContent>
    </Card>
  );
};

export default TimeOffHistory;