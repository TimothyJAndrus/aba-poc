import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Autocomplete,
  Chip,
  Button,
  IconButton,
  Collapse,
  FormControl,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Bookmark as BookmarkIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { type SearchFilters } from '../../services/searchService';

export interface FilterPreset {
  id: string;
  name: string;
  filters: SearchFilters;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  isDefault?: boolean;
}

interface SearchFilterProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApplyFilters?: () => void;
  onClearFilters?: () => void;
  availableTypes?: string[];
  availableStatuses?: string[];
  availableTags?: string[];
  availableUsers?: Array<{ id: string; name: string; role?: string }>;
  showPresets?: boolean;
  compact?: boolean;
}

const defaultTypes = ['user', 'session', 'client', 'rbt', 'team'];
const defaultStatuses = ['active', 'inactive', 'pending', 'completed', 'cancelled'];

export const SearchFilter: React.FC<SearchFilterProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  availableTypes = defaultTypes,
  availableStatuses = defaultStatuses,
  availableTags = [],
  availableUsers = [],
  showPresets = true,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = () => {
    try {
      const stored = localStorage.getItem('searchFilterPresets');
      if (stored) {
        const presets = JSON.parse(stored).map((preset: any) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          lastUsed: new Date(preset.lastUsed),
        }));
        setSavedPresets(presets);
      }
    } catch (error) {
      console.error('Error loading filter presets:', error);
    }
  };

  const savePresets = (presets: FilterPreset[]) => {
    try {
      localStorage.setItem('searchFilterPresets', JSON.stringify(presets));
      setSavedPresets(presets);
    } catch (error) {
      console.error('Error saving filter presets:', error);
    }
  };

  const handleTypeChange = (types: string[]) => {
    onFiltersChange({
      ...filters,
      type: types.length > 0 ? types : undefined,
    });
  };

  const handleStatusChange = (statuses: string[]) => {
    onFiltersChange({
      ...filters,
      status: statuses.length > 0 ? statuses : undefined,
    });
  };

  const handleTagsChange = (tags: string[]) => {
    onFiltersChange({
      ...filters,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleDateRangeChange = (field: 'start' | 'end', date: Date | null) => {
    const currentRange = filters.dateRange || { start: new Date(), end: new Date() };
    const newRange = {
      ...currentRange,
      [field]: date || new Date(),
    };

    onFiltersChange({
      ...filters,
      dateRange: date ? newRange : undefined,
    });
  };

  const handleUserChange = (userId: string | null) => {
    onFiltersChange({
      ...filters,
      userId: userId || undefined,
    });
  };

  const handleClearAll = () => {
    onFiltersChange({});
    if (onClearFilters) {
      onClearFilters();
    }
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: presetName.trim(),
      filters: { ...filters },
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
    };

    const updatedPresets = [...savedPresets, newPreset];
    savePresets(updatedPresets);
    setShowPresetDialog(false);
    setPresetName('');
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    onFiltersChange(preset.filters);
    
    // Update usage stats
    const updatedPresets = savedPresets.map(p =>
      p.id === preset.id
        ? { ...p, lastUsed: new Date(), useCount: p.useCount + 1 }
        : p
    );
    savePresets(updatedPresets);

    if (onApplyFilters) {
      onApplyFilters();
    }
  };

  const handleDeletePreset = (presetId: string) => {
    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    savePresets(updatedPresets);
  };

  const hasActiveFilters = () => {
    return !!(
      filters.type?.length ||
      filters.status?.length ||
      filters.tags?.length ||
      filters.dateRange ||
      filters.userId
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.type?.length) count++;
    if (filters.status?.length) count++;
    if (filters.tags?.length) count++;
    if (filters.dateRange) count++;
    if (filters.userId) count++;
    return count;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper elevation={1} sx={{ p: 2 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <FilterIcon color="action" />
            <Typography variant="subtitle2" fontWeight="medium">
              Filters
            </Typography>
            {hasActiveFilters() && (
              <Chip
                label={getActiveFilterCount()}
                size="small"
                color="primary"
                sx={{ minWidth: 24, height: 20 }}
              />
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {hasActiveFilters() && (
              <Tooltip title="Clear all filters">
                <IconButton size="small" onClick={handleClearAll}>
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            )}
            {showPresets && (
              <Tooltip title="Save current filters">
                <IconButton
                  size="small"
                  onClick={() => setShowPresetDialog(true)}
                  disabled={!hasActiveFilters()}
                >
                  <SaveIcon />
                </IconButton>
              </Tooltip>
            )}
            {compact && (
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Box display="flex" flexDirection="column" gap={2}>
            {/* Type Filter */}
            <FormControl size="small">
              <Autocomplete
                multiple
                options={availableTypes}
                value={filters.type || []}
                onChange={(_, value) => handleTypeChange(value)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      size="small"
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Content Type"
                    placeholder="Select types..."
                  />
                )}
              />
            </FormControl>

            {/* Status Filter */}
            <FormControl size="small">
              <Autocomplete
                multiple
                options={availableStatuses}
                value={filters.status || []}
                onChange={(_, value) => handleStatusChange(value)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      size="small"
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Status"
                    placeholder="Select statuses..."
                  />
                )}
              />
            </FormControl>

            {/* Tags Filter */}
            <FormControl size="small">
              <Autocomplete
                multiple
                freeSolo
                options={availableTags}
                value={filters.tags || []}
                onChange={(_, value) => handleTagsChange(value)}
                inputValue={tagInput}
                onInputChange={(_, value) => setTagInput(value)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      size="small"
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder="Add tags..."
                  />
                )}
              />
            </FormControl>

            {/* Date Range Filter */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Date Range
              </Typography>
              <Box display="flex" gap={2}>
                <DatePicker
                  label="Start Date"
                  value={filters.dateRange?.start || null}
                  onChange={(date) => handleDateRangeChange('start', date)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                    },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={filters.dateRange?.end || null}
                  onChange={(date) => handleDateRangeChange('end', date)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* User Filter */}
            {availableUsers.length > 0 && (
              <FormControl size="small">
                <Autocomplete
                  options={availableUsers}
                  getOptionLabel={(option) => option.name}
                  value={availableUsers.find(u => u.id === filters.userId) || null}
                  onChange={(_, value) => handleUserChange(value?.id || null)}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2">{option.name}</Typography>
                        {option.role && (
                          <Typography variant="caption" color="text.secondary">
                            {option.role}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="User"
                      placeholder="Select user..."
                    />
                  )}
                />
              </FormControl>
            )}

            {/* Action Buttons */}
            <Box display="flex" gap={1} pt={1}>
              {onApplyFilters && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={onApplyFilters}
                  disabled={!hasActiveFilters()}
                >
                  Apply Filters
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearAll}
                disabled={!hasActiveFilters()}
              >
                Clear All
              </Button>
            </Box>
          </Box>
        </Collapse>

        {/* Saved Presets */}
        {showPresets && savedPresets.length > 0 && (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Saved Filter Presets
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {savedPresets
                .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
                .slice(0, 5)
                .map((preset) => (
                  <Chip
                    key={preset.id}
                    label={preset.name}
                    size="small"
                    icon={<BookmarkIcon />}
                    onClick={() => handleLoadPreset(preset)}
                    onDelete={() => handleDeletePreset(preset.id)}
                    deleteIcon={<DeleteIcon />}
                    clickable
                    variant="outlined"
                  />
                ))}
            </Box>
          </Box>
        )}

        {/* Save Preset Dialog */}
        <Dialog open={showPresetDialog} onClose={() => setShowPresetDialog(false)}>
          <DialogTitle>Save Filter Preset</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Preset Name"
              fullWidth
              variant="outlined"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter a name for this filter preset..."
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Current filters will be saved and can be quickly applied later.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPresetDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePreset} disabled={!presetName.trim()}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </LocalizationProvider>
  );
};