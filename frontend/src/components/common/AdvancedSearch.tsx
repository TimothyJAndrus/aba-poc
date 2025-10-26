import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,

  TextField,
  InputAdornment,
  Button,
  Tabs,
  Tab,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { SearchFilter } from './SearchFilter';
import { SearchResults } from './SearchResults';
import {
  searchService,
  type SearchQuery,
  type SearchResponse,
  type SearchFilters,
  type SearchResult,
} from '../../services/searchService';

interface AdvancedSearchProps {
  onResultSelect?: (result: SearchResult) => void;
  initialQuery?: string;
  initialFilters?: SearchFilters;
  showExport?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`search-tabpanel-${index}`}
      aria-labelledby={`search-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onResultSelect,
  initialQuery = '',
  initialFilters = {},
  showExport = true,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'title'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState(0);
  const [savedResultIds, setSavedResultIds] = useState<Set<string>>(new Set());

  // Available options for filters
  const availableTypes = ['user', 'session', 'client', 'rbt', 'team', 'report'];
  const availableStatuses = ['active', 'inactive', 'pending', 'completed', 'cancelled', 'scheduled'];
  const availableTags = ['urgent', 'follow-up', 'review', 'approved', 'draft'];
  const availableUsers = [
    { id: '1', name: 'John Doe', role: 'Admin' },
    { id: '2', name: 'Jane Smith', role: 'RBT' },
    { id: '3', name: 'Bob Johnson', role: 'Client' },
  ];

  useEffect(() => {
    if (query.trim() || hasActiveFilters()) {
      performSearch();
    }
  }, [currentPage, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadSavedResults();
  }, []);

  const hasActiveFilters = () => {
    return !!(
      filters.type?.length ||
      filters.status?.length ||
      filters.tags?.length ||
      filters.dateRange ||
      filters.userId
    );
  };

  const performSearch = async () => {
    if (!query.trim() && !hasActiveFilters()) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchQuery: SearchQuery = {
        query: query.trim(),
        filters,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        sortBy,
        sortOrder,
      };

      const searchResults = await searchService.search(searchQuery);
      setResults(searchResults);
    } catch (err) {
      setError('An error occurred while searching. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    performSearch();
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    performSearch();
  };

  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(1);
    if (query.trim()) {
      performSearch();
    } else {
      setResults(null);
    }
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (event: any) => {
    setPageSize(event.target.value as number);
    setCurrentPage(1);
  };

  const handleSortChange = (field: 'sortBy' | 'sortOrder', value: string) => {
    if (field === 'sortBy') {
      setSortBy(value as 'relevance' | 'date' | 'title');
    } else {
      setSortOrder(value as 'asc' | 'desc');
    }
    setCurrentPage(1);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSaveResult = (result: SearchResult) => {
    const newSavedIds = new Set(savedResultIds);
    if (newSavedIds.has(result.id)) {
      newSavedIds.delete(result.id);
    } else {
      newSavedIds.add(result.id);
    }
    setSavedResultIds(newSavedIds);
    saveSavedResults(newSavedIds);
  };

  const handleExportResults = () => {
    if (!results) return;

    const csvContent = [
      ['Title', 'Type', 'Description', 'URL', 'Relevance Score'].join(','),
      ...results.results.map(result => [
        `"${result.title}"`,
        result.type,
        `"${result.description || ''}"`,
        result.url || '',
        result.relevanceScore || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const loadSavedResults = () => {
    try {
      const saved = localStorage.getItem('savedSearchResults');
      if (saved) {
        setSavedResultIds(new Set(JSON.parse(saved)));
      }
    } catch (error) {
      console.error('Error loading saved results:', error);
    }
  };

  const saveSavedResults = (savedIds: Set<string>) => {
    try {
      localStorage.setItem('savedSearchResults', JSON.stringify(Array.from(savedIds)));
    } catch (error) {
      console.error('Error saving results:', error);
    }
  };



  const totalPages = results ? Math.ceil(results.total / pageSize) : 0;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Advanced Search
      </Typography>

      {/* Search Input */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="flex-end">
          <TextField
            fullWidth
            label="Search Query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter your search terms..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            Search
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            Reset
          </Button>
        </Box>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Active Filters:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {filters.type?.map(type => (
                <Chip key={type} label={`Type: ${type}`} size="small" />
              ))}
              {filters.status?.map(status => (
                <Chip key={status} label={`Status: ${status}`} size="small" />
              ))}
              {filters.tags?.map(tag => (
                <Chip key={tag} label={`Tag: ${tag}`} size="small" />
              ))}
              {filters.dateRange && (
                <Chip label="Date Range" size="small" />
              )}
              {filters.userId && (
                <Chip label="User Filter" size="small" />
              )}
            </Box>
          </Box>
        )}
      </Paper>

      <Box display="flex" gap={3} flexDirection={{ xs: 'column', md: 'row' }}>
        {/* Filters Sidebar */}
        <Box sx={{ width: { xs: '100%', md: '300px' }, flexShrink: 0 }}>
          <SearchFilter
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onApplyFilters={handleApplyFilters}
            onClearFilters={handleClearFilters}
            availableTypes={availableTypes}
            availableStatuses={availableStatuses}
            availableTags={availableTags}
            availableUsers={availableUsers}
            showPresets={true}
          />
        </Box>

        {/* Results Area */}
        <Box sx={{ flex: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Results Header */}
          {results && (
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Typography variant="h6">
                  {results.total} results found in {results.searchTime}ms
                </Typography>
                
                <Box display="flex" gap={2} alignItems="center">
                  {/* Sort Controls */}
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      label="Sort By"
                      onChange={(e) => handleSortChange('sortBy', e.target.value)}
                    >
                      <MenuItem value="relevance">Relevance</MenuItem>
                      <MenuItem value="date">Date</MenuItem>
                      <MenuItem value="title">Title</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>Order</InputLabel>
                    <Select
                      value={sortOrder}
                      label="Order"
                      onChange={(e) => handleSortChange('sortOrder', e.target.value)}
                    >
                      <MenuItem value="desc">Desc</MenuItem>
                      <MenuItem value="asc">Asc</MenuItem>
                    </Select>
                  </FormControl>

                  {showExport && (
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleExportResults}
                      size="small"
                    >
                      Export
                    </Button>
                  )}
                </Box>
              </Box>
            </Paper>
          )}

          {/* Results Tabs */}
          {results && Object.keys(results.categories).length > 1 && (
            <Paper elevation={1} sx={{ mb: 2 }}>
              <Tabs value={activeTab} onChange={handleTabChange}>
                <Tab label={`All (${results.total})`} />
                {Object.entries(results.categories).map(([category, categoryResults]) => (
                  <Tab
                    key={category}
                    label={`${category} (${categoryResults.length})`}
                  />
                ))}
              </Tabs>
            </Paper>
          )}

          {/* Results Content */}
          {loading ? (
            <Box>
              {[...Array(5)].map((_, index) => (
                <Paper key={index} elevation={1} sx={{ p: 2, mb: 2 }}>
                  <Skeleton variant="text" width="60%" height={24} />
                  <Skeleton variant="text" width="40%" height={20} />
                  <Skeleton variant="text" width="80%" height={16} />
                </Paper>
              ))}
            </Box>
          ) : results ? (
            <>
              <TabPanel value={activeTab} index={0}>
                <SearchResults
                  results={results}
                  onResultClick={onResultSelect}
                  onSaveResult={handleSaveResult}
                  savedResultIds={savedResultIds}
                  showCategories={false}
                />
              </TabPanel>
              
              {Object.entries(results.categories).map(([category, categoryResults], index) => (
                <TabPanel key={category} value={activeTab} index={index + 1}>
                  <SearchResults
                    results={{
                      ...results,
                      results: categoryResults,
                      total: categoryResults.length,
                      categories: { [category]: categoryResults },
                    }}
                    onResultClick={onResultSelect}
                    onSaveResult={handleSaveResult}
                    savedResultIds={savedResultIds}
                    showCategories={false}
                  />
                </TabPanel>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <Box display="flex" justifyContent="center" alignItems="center" gap={2} mt={3}>
                  <FormControl size="small">
                    <InputLabel>Per Page</InputLabel>
                    <Select
                      value={pageSize}
                      label="Per Page"
                      onChange={handlePageSizeChange}
                    >
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={20}>20</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          ) : (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No search performed yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter a search query or apply filters to get started
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>
    </Container>
  );
};