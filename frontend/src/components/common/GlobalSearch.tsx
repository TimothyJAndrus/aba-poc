import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  History as HistoryIcon,
  Bookmark as BookmarkIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { SearchResults } from './SearchResults';
import {
  searchService,
  SearchResult,
  SearchResponse,
  SavedSearch,
  SearchHistory,
  SearchQuery,
} from '../../services/searchService';

interface GlobalSearchProps {
  placeholder?: string;
  showFilters?: boolean;
  onResultSelect?: (result: SearchResult) => void;
  variant?: 'outlined' | 'filled' | 'standard';
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  placeholder = 'Search users, sessions, clients...',
  showFilters = true,
  onResultSelect,
  variant = 'outlined',
  size = 'medium',
  fullWidth = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const isOpen = Boolean(anchorEl);
  const showDropdown = isOpen && (query.length > 0 || searchHistory.length > 0 || savedSearches.length > 0);

  useEffect(() => {
    // Load initial data
    setSearchHistory(searchService.getSearchHistory());
    setSavedSearches(searchService.getSavedSearches());
    setPopularSearches(searchService.getPopularSearches());
  }, []);

  useEffect(() => {
    if (query.trim().length > 0) {
      setLoading(true);
      
      searchService.debouncedSearch(
        { query: query.trim() },
        (searchResults) => {
          setResults(searchResults);
          setLoading(false);
        }
      );
    } else {
      setResults(null);
      setLoading(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    }
    handleClose();
  };

  const handleHistoryClick = (historyItem: SearchHistory) => {
    setQuery(historyItem.query);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSavedSearchClick = async (savedSearch: SavedSearch) => {
    setLoading(true);
    try {
      const searchResults = await searchService.executeSavedSearch(savedSearch.id);
      setResults(searchResults);
      setQuery(savedSearch.query.query);
    } catch (error) {
      console.error('Error executing saved search:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePopularSearchClick = (popularQuery: string) => {
    setQuery(popularQuery);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSaveSearch = async () => {
    if (saveSearchName.trim() && query.trim()) {
      try {
        const savedSearch = await searchService.saveSearch(saveSearchName.trim(), {
          query: query.trim(),
        });
        setSavedSearches(searchService.getSavedSearches());
        setShowSaveDialog(false);
        setSaveSearchName('');
      } catch (error) {
        console.error('Error saving search:', error);
      }
    }
  };

  const handleDeleteSavedSearch = (savedSearchId: string) => {
    searchService.deleteSavedSearch(savedSearchId);
    setSavedSearches(searchService.getSavedSearches());
  };

  const handleClearHistory = () => {
    searchService.clearSearchHistory();
    setSearchHistory([]);
    setMenuAnchorEl(null);
  };

  const handleClearInput = () => {
    setQuery('');
    setResults(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  return (
    <Box position="relative">
      <TextField
        ref={inputRef}
        value={query}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {query && (
                <IconButton size="small" onClick={handleClearInput}>
                  <ClearIcon />
                </IconButton>
              )}
              {showFilters && (
                <Tooltip title="Search options">
                  <IconButton size="small" onClick={handleMenuOpen}>
                    <FilterIcon />
                  </IconButton>
                </Tooltip>
              )}
            </InputAdornment>
          ),
        }}
      />

      <Popover
        open={showDropdown}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            width: anchorEl?.clientWidth || 400,
            maxWidth: 600,
            maxHeight: 500,
            overflow: 'auto',
          },
        }}
      >
        {query.length > 0 && results ? (
          <Box>
            <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Search Results</Typography>
              {query.trim() && (
                <Button
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={() => setShowSaveDialog(true)}
                >
                  Save Search
                </Button>
              )}
            </Box>
            <SearchResults
              results={results}
              loading={loading}
              onResultClick={handleResultClick}
              showCategories={false}
              maxResults={10}
            />
          </Box>
        ) : (
          <Box>
            {/* Saved Searches */}
            {savedSearches.length > 0 && (
              <Box>
                <Box p={2} pb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Saved Searches
                  </Typography>
                </Box>
                <List dense>
                  {savedSearches.slice(0, 5).map((savedSearch) => (
                    <ListItem
                      key={savedSearch.id}
                      button
                      onClick={() => handleSavedSearchClick(savedSearch)}
                    >
                      <ListItemIcon>
                        <BookmarkIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={savedSearch.name}
                        secondary={`"${savedSearch.query.query}" • Used ${savedSearch.useCount} times`}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSavedSearch(savedSearch.id);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
                <Divider />
              </Box>
            )}

            {/* Popular Searches */}
            {popularSearches.length > 0 && (
              <Box>
                <Box p={2} pb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Popular Searches
                  </Typography>
                </Box>
                <Box p={2} pt={0}>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {popularSearches.slice(0, 6).map((popularQuery) => (
                      <Chip
                        key={popularQuery}
                        label={popularQuery}
                        size="small"
                        icon={<TrendingUpIcon />}
                        onClick={() => handlePopularSearchClick(popularQuery)}
                        clickable
                      />
                    ))}
                  </Box>
                </Box>
                <Divider />
              </Box>
            )}

            {/* Recent Searches */}
            {searchHistory.length > 0 && (
              <Box>
                <Box p={2} pb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Recent Searches
                  </Typography>
                </Box>
                <List dense>
                  {searchHistory.slice(0, 5).map((historyItem) => (
                    <ListItem
                      key={historyItem.id}
                      button
                      onClick={() => handleHistoryClick(historyItem)}
                    >
                      <ListItemIcon>
                        <HistoryIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={historyItem.query}
                        secondary={`${historyItem.resultCount} results • ${historyItem.timestamp.toLocaleDateString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {savedSearches.length === 0 && popularSearches.length === 0 && searchHistory.length === 0 && (
              <Box p={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Start typing to search...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Popover>

      {/* Search Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => setShowSaveDialog(true)} disabled={!query.trim()}>
          <ListItemIcon>
            <SaveIcon />
          </ListItemIcon>
          <ListItemText>Save Current Search</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleClearHistory} disabled={searchHistory.length === 0}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <ListItemText>Clear Search History</ListItemText>
        </MenuItem>
      </Menu>

      {/* Save Search Dialog */}
      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)}>
        <DialogTitle>Save Search</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Search Name"
            fullWidth
            variant="outlined"
            value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
            placeholder="Enter a name for this search..."
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Query: "{query}"
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};