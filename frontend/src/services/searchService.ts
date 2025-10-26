import { apiService } from './api';

// Search-related types
export interface SearchResult {
  id: string;
  type: 'user' | 'session' | 'client' | 'rbt' | 'team';
  title: string;
  subtitle?: string;
  description?: string;
  url?: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  categories: {
    [key: string]: SearchResult[];
  };
  suggestions?: string[];
  searchTime: number;
}

export interface SearchFilters {
  type?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: string[];
  tags?: string[];
  userId?: string;
}

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
}

export interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
}

class SearchService {
  private cache = new Map<string, { data: SearchResponse; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly DEBOUNCE_DELAY = 300; // 300ms
  private debounceTimer: NodeJS.Timeout | null = null;
  private searchHistory: SearchHistory[] = [];
  private savedSearches: SavedSearch[] = [];

  constructor() {
    this.loadSearchHistory();
    this.loadSavedSearches();
  }

  /**
   * Debounced search function
   */
  async debouncedSearch(
    query: SearchQuery,
    callback: (results: SearchResponse) => void
  ): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        const results = await this.search(query);
        callback(results);
      } catch (error) {
        console.error('Search error:', error);
        callback({
          results: [],
          total: 0,
          categories: {},
          searchTime: 0,
        });
      }
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Main search function with caching
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const cacheKey = this.generateCacheKey(query);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    const startTime = Date.now();

    try {
      const response = await apiService.post<SearchResponse>('/search', query);
      
      const searchTime = Date.now() - startTime;
      const enhancedResponse = {
        ...response,
        searchTime,
      };

      // Cache the results
      this.cache.set(cacheKey, {
        data: enhancedResponse,
        timestamp: Date.now(),
      });

      // Add to search history
      this.addToHistory(query.query, response.total);

      return enhancedResponse;
    } catch (error) {
      console.error('Search API error:', error);
      throw error;
    }
  }

  /**
   * Quick search for autocomplete/suggestions
   */
  async quickSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    try {
      const response = await this.search({
        query: query.trim(),
        limit,
        sortBy: 'relevance',
      });

      return response.results;
    } catch (error) {
      console.error('Quick search error:', error);
      return [];
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSuggestions(query: string): Promise<string[]> {
    if (!query.trim()) return [];

    try {
      const response = await apiService.get<{ suggestions: string[] }>(
        `/search/suggestions?q=${encodeURIComponent(query)}`
      );
      return response.suggestions;
    } catch (error) {
      console.error('Suggestions error:', error);
      return [];
    }
  }

  /**
   * Search within specific category
   */
  async searchByCategory(
    query: string,
    category: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    const searchQuery: SearchQuery = {
      query,
      filters: {
        ...filters,
        type: [category],
      },
    };

    const response = await this.search(searchQuery);
    return response.results;
  }

  /**
   * Advanced search with multiple filters
   */
  async advancedSearch(query: SearchQuery): Promise<SearchResponse> {
    return this.search(query);
  }

  /**
   * Save a search query for later use
   */
  async saveSearch(name: string, query: SearchQuery): Promise<SavedSearch> {
    const savedSearch: SavedSearch = {
      id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      query,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
    };

    this.savedSearches.push(savedSearch);
    this.persistSavedSearches();

    return savedSearch;
  }

  /**
   * Get all saved searches
   */
  getSavedSearches(): SavedSearch[] {
    return [...this.savedSearches].sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  }

  /**
   * Execute a saved search
   */
  async executeSavedSearch(savedSearchId: string): Promise<SearchResponse> {
    const savedSearch = this.savedSearches.find(s => s.id === savedSearchId);
    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    // Update usage stats
    savedSearch.lastUsed = new Date();
    savedSearch.useCount++;
    this.persistSavedSearches();

    return this.search(savedSearch.query);
  }

  /**
   * Delete a saved search
   */
  deleteSavedSearch(savedSearchId: string): void {
    this.savedSearches = this.savedSearches.filter(s => s.id !== savedSearchId);
    this.persistSavedSearches();
  }

  /**
   * Get search history
   */
  getSearchHistory(): SearchHistory[] {
    return [...this.searchHistory].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
    localStorage.removeItem('searchHistory');
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get popular searches
   */
  getPopularSearches(limit: number = 10): string[] {
    const searchCounts = new Map<string, number>();
    
    this.searchHistory.forEach(item => {
      const count = searchCounts.get(item.query) || 0;
      searchCounts.set(item.query, count + 1);
    });

    return Array.from(searchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query]) => query);
  }

  // Private helper methods

  private generateCacheKey(query: SearchQuery): string {
    return JSON.stringify(query);
  }

  private addToHistory(query: string, resultCount: number): void {
    const historyItem: SearchHistory = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query: query.trim(),
      timestamp: new Date(),
      resultCount,
    };

    // Remove duplicate queries
    this.searchHistory = this.searchHistory.filter(item => item.query !== query);
    
    // Add new item to beginning
    this.searchHistory.unshift(historyItem);
    
    // Keep only last 50 searches
    this.searchHistory = this.searchHistory.slice(0, 50);
    
    this.persistSearchHistory();
  }

  private loadSearchHistory(): void {
    try {
      const stored = localStorage.getItem('searchHistory');
      if (stored) {
        this.searchHistory = JSON.parse(stored).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
      this.searchHistory = [];
    }
  }

  private persistSearchHistory(): void {
    try {
      localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    } catch (error) {
      console.error('Error persisting search history:', error);
    }
  }

  private loadSavedSearches(): void {
    try {
      const stored = localStorage.getItem('savedSearches');
      if (stored) {
        this.savedSearches = JSON.parse(stored).map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          lastUsed: new Date(item.lastUsed),
        }));
      }
    } catch (error) {
      console.error('Error loading saved searches:', error);
      this.savedSearches = [];
    }
  }

  private persistSavedSearches(): void {
    try {
      localStorage.setItem('savedSearches', JSON.stringify(this.savedSearches));
    } catch (error) {
      console.error('Error persisting saved searches:', error);
    }
  }
}

export const searchService = new SearchService();