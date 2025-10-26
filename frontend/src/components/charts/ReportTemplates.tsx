import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Menu,
  MenuItem,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as FileCopyIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

interface ReportTemplatesProps {
  templates: ReportTemplate[];
  onCreateTemplate: (template: Omit<ReportTemplate, 'id' | 'createdAt'>) => void;
  onUpdateTemplate: (id: string, template: Partial<ReportTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  onDuplicateTemplate: (id: string) => void;
  onUseTemplate: (template: ReportTemplate) => void;
  onExportTemplate: (id: string) => void;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'operational' | 'financial' | 'quality' | 'custom';
  config: {
    type: string;
    metrics: string[];
    filters: any[];
    format: string;
  };
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  tags: string[];
}

const TEMPLATE_CATEGORIES = [
  { id: 'operational', label: 'Operational', color: '#2563eb' },
  { id: 'financial', label: 'Financial', color: '#059669' },
  { id: 'quality', label: 'Quality', color: '#d97706' },
  { id: 'custom', label: 'Custom', color: '#7c3aed' },
];

export const ReportTemplates: React.FC<ReportTemplatesProps> = ({
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onUseTemplate,
  onExportTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; templateId: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'operational' as const,
    isPublic: false,
    tags: [] as string[],
  });

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleOpenDialog = (template?: ReportTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description,
        category: template.category,
        isPublic: template.isPublic,
        tags: template.tags,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        category: 'operational',
        isPublic: false,
        tags: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleSave = () => {
    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, formData);
    } else {
      const newTemplate = {
        ...formData,
        config: {
          type: formData.category,
          metrics: [],
          filters: [],
          format: 'pdf',
        },
        createdBy: 'Current User',
        usageCount: 0,
      };
      onCreateTemplate(newTemplate);
    }
    handleCloseDialog();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, templateId: string) => {
    setMenuAnchor({ element: event.currentTarget, templateId });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleMenuAction = (action: string, templateId: string) => {
    handleMenuClose();
    switch (action) {
      case 'edit':
        const template = templates.find(t => t.id === templateId);
        if (template) handleOpenDialog(template);
        break;
      case 'duplicate':
        onDuplicateTemplate(templateId);
        break;
      case 'delete':
        onDeleteTemplate(templateId);
        break;
      case 'export':
        onExportTemplate(templateId);
        break;
    }
  };

  const getCategoryColor = (category: string) => {
    return TEMPLATE_CATEGORIES.find(c => c.id === category)?.color || '#6b7280';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData({ ...formData, tags });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Report Templates</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Template
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="All"
                onClick={() => setSelectedCategory('all')}
                color={selectedCategory === 'all' ? 'primary' : 'default'}
                variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
              />
              {TEMPLATE_CATEGORIES.map((category) => (
                <Chip
                  key={category.id}
                  label={category.label}
                  onClick={() => setSelectedCategory(category.id)}
                  color={selectedCategory === category.id ? 'primary' : 'default'}
                  variant={selectedCategory === category.id ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm || selectedCategory !== 'all' ? 'No templates found' : 'No templates available'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Create your first report template to get started.'
            }
          </Typography>
          {!searchTerm && selectedCategory === 'all' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Create Your First Template
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredTemplates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {template.name}
                      </Typography>
                      <Chip
                        label={TEMPLATE_CATEGORIES.find(c => c.id === template.category)?.label}
                        size="small"
                        sx={{
                          backgroundColor: getCategoryColor(template.category),
                          color: 'white',
                          mb: 1,
                        }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, template.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {template.description}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {template.config.metrics.length} metrics • {template.config.format.toUpperCase()}
                    </Typography>
                  </Box>

                  {template.tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                      {template.tags.slice(0, 3).map((tag, index) => (
                        <Chip key={index} label={tag} size="small" variant="outlined" />
                      ))}
                      {template.tags.length > 3 && (
                        <Chip label={`+${template.tags.length - 3}`} size="small" variant="outlined" />
                      )}
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Created {formatDate(template.createdAt)}
                    </Typography>
                    {template.isPublic && (
                      <Chip label="Public" size="small" color="info" variant="outlined" />
                    )}
                  </Box>

                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Used {template.usageCount} times
                      {template.lastUsed && ` • Last used ${formatDate(template.lastUsed)}`}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={() => onUseTemplate(template)}
                  >
                    Use Template
                  </Button>
                  <Button
                    size="small"
                    startIcon={<FileCopyIcon />}
                    onClick={() => onDuplicateTemplate(template.id)}
                  >
                    Duplicate
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuAction('edit', menuAnchor!.templateId)}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('duplicate', menuAnchor!.templateId)}>
          <FileCopyIcon sx={{ mr: 1 }} fontSize="small" />
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('export', menuAnchor!.templateId)}>
          <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
          Export
        </MenuItem>
        <MenuItem 
          onClick={() => handleMenuAction('delete', menuAnchor!.templateId)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create New Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tags (comma-separated)"
                value={formData.tags.join(', ')}
                onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="e.g., monthly, operations, kpi"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  />
                }
                label="Make this template public (visible to all users)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name}
          >
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};