import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdvancedSearch } from '../../components/common/AdvancedSearch';
import { SearchResult } from '../../services/searchService';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();

  const handleResultSelect = (result: SearchResult) => {
    if (result.url) {
      navigate(result.url);
    }
  };

  return (
    <AdvancedSearch
      onResultSelect={handleResultSelect}
      showExport={true}
    />
  );
};