import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Breadcrumbs,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Button,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';

interface DrillDownViewProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  data: DrillDownData;
  onBack: () => void;
  onBreadcrumbClick: (index: number) => void;
  onExportData: () => void;
  onViewDetails: (item: any) => void;
}

interface BreadcrumbItem {
  label: string;
  active?: boolean;
}

interface DrillDownData {
  summary: {
    title: string;
    value: string | number;
    change?: {
      value: number;
      direction: 'up' | 'down' | 'stable';
    };
  };
  chart?: {
    type: 'line' | 'bar';
    data: any;
    options?: any;
  };
  table: {
    columns: TableColumn[];
    rows: TableRow[];
    totalCount: number;
  };
}

interface TableColumn {
  id: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
}

interface TableRow {
  id: string;
  [key: string]: any;
}

export const DrillDownView: React.FC<DrillDownViewProps> = ({
  title,
  breadcrumbs,
  data,
  onBack,
  onBreadcrumbClick,
  onExportData,
  onViewDetails,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatValue = (value: any, column: TableColumn) => {
    if (column.format) {
      return column.format(value);
    }
    return value?.toString() || '';
  };

  const getChangeColor = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      default:
        return 'default';
    }
  };

  const getChangeIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <IconButton onClick={onBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
              {title}
            </Typography>
          </Box>
          
          <Breadcrumbs aria-label="breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <Link
                key={index}
                color={crumb.active ? 'text.primary' : 'inherit'}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (!crumb.active) {
                    onBreadcrumbClick(index);
                  }
                }}
                sx={{
                  textDecoration: crumb.active ? 'none' : 'underline',
                  cursor: crumb.active ? 'default' : 'pointer',
                }}
              >
                {crumb.label}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>

        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={onExportData}
        >
          Export Data
        </Button>
      </Box>

      {/* Summary Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {data.summary.title}
            </Typography>
            <Typography variant="h3" component="div">
              {data.summary.value}
            </Typography>
          </Box>
          {data.summary.change && (
            <Chip
              label={`${getChangeIcon(data.summary.change.direction)} ${Math.abs(data.summary.change.value)}%`}
              color={getChangeColor(data.summary.change.direction)}
              variant="outlined"
            />
          )}
        </Box>
      </Paper>

      {/* Chart */}
      {data.chart && (
        <Box sx={{ mb: 3 }}>
          {data.chart.type === 'line' ? (
            <LineChart
              title="Trend Analysis"
              data={data.chart.data}
              options={data.chart.options}
              height={300}
            />
          ) : (
            <BarChart
              title="Distribution Analysis"
              data={data.chart.data}
              options={data.chart.options}
              height={300}
            />
          )}
        </Box>
      )}

      {/* Data Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {data.table.columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align || 'left'}
                    sx={{ fontWeight: 'bold' }}
                  >
                    {column.label}
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.table.rows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => (
                  <TableRow key={row.id} hover>
                    {data.table.columns.map((column) => (
                      <TableCell key={column.id} align={column.align || 'left'}>
                        {formatValue(row[column.id], column)}
                      </TableCell>
                    ))}
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => onViewDetails(row)}
                        title="View Details"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={data.table.totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};