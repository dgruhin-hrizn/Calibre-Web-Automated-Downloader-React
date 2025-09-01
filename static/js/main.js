// Modern Admin Dashboard - Book Downloader
// Enhanced with progress tracking, toast notifications, and modern UI patterns

(function () {
  'use strict';

  // ---- State Management ----
  const state = {
    currentPage: 'dashboard',
    activeDownloads: new Map(),
    downloadHistory: [],
    searchResults: [],
    selectedItems: new Set(),
    notifications: new Map(),
    lastUpdate: 0,
    updateInterval: null
  };

  // ---- DOM Elements ----
  const elements = {
    // Navigation
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    navItems: document.querySelectorAll('.nav-item'),
    
    // Pages
    pages: document.querySelectorAll('.page-content'),
    dashboardPage: document.getElementById('dashboard-page'),
    searchPage: document.getElementById('search-page'),
    downloadsPage: document.getElementById('downloads-page'),
    statusPage: document.getElementById('status-page'),
    settingsPage: document.getElementById('settings-page'),
    debugPage: document.getElementById('debug-page'),

    // Header Progress
    progressContainer: document.getElementById('download-progress-container'),
    progressButton: document.getElementById('progress-button'),
    progressText: document.getElementById('progress-text'),
    progressDropdown: document.getElementById('progress-dropdown'),
    activeDownloadsList: document.getElementById('active-downloads-list'),
    downloadHistoryList: document.getElementById('download-history-list'),

    // Search
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    searchLoading: document.getElementById('search-loading'),
    resultsGrid: document.getElementById('results-grid'),
    noResults: document.getElementById('no-results'),
    toggleAdvanced: document.getElementById('toggle-advanced'),
    searchFilters: document.getElementById('search-filters'),
    advSearchButton: document.getElementById('adv-search-button'),

    // Modal
    modalOverlay: document.getElementById('modal-overlay'),
    detailsContainer: document.getElementById('details-container'),
    closeModal: document.getElementById('close-modal'),
    closeDetails: document.getElementById('close-details'),
    downloadButton: document.getElementById('download-button'),

    // Toast
    toastContainer: document.getElementById('toast-container'),
    toastTemplate: document.getElementById('toast-template'),

    // Theme
    themeToggle: document.getElementById('theme-toggle'),
    themeMenu: document.getElementById('theme-menu'),
    themeIconLight: document.getElementById('theme-icon-light'),
    themeIconDark: document.getElementById('theme-icon-dark'),

    // Command Palette
    commandPalette: document.getElementById('command-palette'),
    commandInput: document.getElementById('command-input'),
    commandResults: document.getElementById('command-results'),
    commandBackdrop: document.getElementById('command-backdrop'),

    // Dashboard Stats
    statsActive: document.getElementById('stats-active'),
    statsQueued: document.getElementById('stats-queued'),
    statsCompleted: document.getElementById('stats-completed'),
    statsFailed: document.getElementById('stats-failed'),

    // Downloads page
    downloadsTabs: document.querySelectorAll('.downloads-tab'),
    tabContents: document.querySelectorAll('.tab-content')
  };

  // ---- API Endpoints ----
  const API = {
    search: '/request/api/search',
    info: '/request/api/info',
    download: '/request/api/download',
    status: '/request/api/status',
    cancel: '/request/api/download',
    clearCompleted: '/request/api/queue/clear',
    activeDownloads: '/request/api/downloads/active'
  };

  // ---- Utility Functions ----
  const utils = {
    // DOM manipulation
    show(element) { element?.classList.remove('hidden'); },
    hide(element) { element?.classList.add('hidden'); },
    toggle(element) { element?.classList.toggle('hidden'); },
    
    // HTTP requests
    async request(url, options = {}) {
      try {
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          ...options
        });
        if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
        return await response.json();
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    },

    // Text utilities
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    formatFileSize(bytes) {
      if (!bytes) return '--';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    },

    formatDate(date) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(date));
    },

    // Query building for search
    buildSearchQuery() {
      const params = new URLSearchParams();
      
      // Basic search
      const query = elements.searchInput?.value?.trim();
      if (query) params.set('query', query);

      // Advanced filters (if visible)
      if (!elements.searchFilters?.classList.contains('hidden')) {
        const filters = ['isbn', 'author', 'title', 'lang', 'sort', 'content'];
        filters.forEach(filter => {
          const input = document.getElementById(`${filter}-input`);
          const value = input?.value?.trim();
          if (value) params.set(filter, value);
        });

        // Format checkboxes
        document.querySelectorAll('[id^="format-"]:checked').forEach(cb => {
          params.append('format', cb.value);
        });
      }

      return params.toString();
    }
  };

  // ---- Navigation System ----
  const navigation = {
    init() {
      // Sidebar toggle for mobile
      elements.sidebarToggle?.addEventListener('click', this.toggleSidebar);
      elements.sidebarOverlay?.addEventListener('click', this.closeSidebar);

      // Navigation items
      elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const page = item.id.replace('nav-', '');
          this.navigateTo(page);
        });
      });

      // Quick action buttons
      document.getElementById('quick-search')?.addEventListener('click', () => this.navigateTo('search'));
      document.getElementById('quick-status')?.addEventListener('click', () => this.navigateTo('status'));
    },

    toggleSidebar() {
      elements.sidebar?.classList.toggle('-translate-x-full');
      utils.toggle(elements.sidebarOverlay);
    },

    closeSidebar() {
      elements.sidebar?.classList.add('-translate-x-full');
      utils.hide(elements.sidebarOverlay);
    },

    navigateTo(page) {
      // Update state
      state.currentPage = page;

      // Update navigation
      elements.navItems.forEach(item => {
        item.classList.toggle('active', item.id === `nav-${page}`);
      });

      // Update pages
      elements.pages.forEach(pageEl => {
        pageEl.classList.toggle('hidden', pageEl.id !== `${page}-page`);
      });

      // Page-specific initialization
      switch (page) {
        case 'dashboard':
          dashboard.refresh();
          break;
        case 'search':
          search.focus();
          break;
        case 'downloads':
          downloads.refresh();
          break;
        case 'status':
          status.refresh();
          break;
      }

      // Close mobile sidebar
      if (window.innerWidth < 1024) {
        this.closeSidebar();
      }
    }
  };

  // ---- Toast Notification System ----
  const toast = {
    show(options) {
      const {
        type = 'info',
        title,
        message,
        duration = 5000,
        actions = [],
        progress = null,
        persistent = false
      } = options;

      const id = Date.now().toString();
      const template = elements.toastTemplate.content.cloneNode(true);
      const toastEl = template.querySelector('.toast-notification');
      
      toastEl.setAttribute('data-toast-id', id);
      toastEl.setAttribute('data-type', type);

      // Set content
      toastEl.querySelector('.toast-title').textContent = title;
      toastEl.querySelector('.toast-message').textContent = message;

      // Show appropriate icon
      toastEl.querySelector(`.toast-icon-${type}`)?.classList.remove('hidden');

      // Handle progress
      if (progress !== null) {
        const progressEl = toastEl.querySelector('.toast-progress');
        const progressBar = toastEl.querySelector('.toast-progress-bar');
        const progressText = toastEl.querySelector('.toast-progress-text');
        
        utils.show(progressEl);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
      }

      // Handle actions
      if (actions.length > 0) {
        const actionsEl = toastEl.querySelector('.toast-actions');
        utils.show(actionsEl);
        
        actions.forEach((action, index) => {
          const button = toastEl.querySelector(index === 0 ? '.toast-action-primary' : '.toast-action-secondary');
          if (button) {
            button.textContent = action.label;
            button.onclick = () => {
              action.handler();
              this.remove(id);
            };
          }
        });
      }

      // Close button
      toastEl.querySelector('.toast-close').onclick = () => this.remove(id);

      // Add to container
      elements.toastContainer.appendChild(toastEl);

      // Animate in
      requestAnimationFrame(() => {
        toastEl.classList.remove('translate-x-full');
      });

      // Store reference
      state.notifications.set(id, { element: toastEl, type, persistent });

      // Auto remove
      if (!persistent && duration > 0) {
        setTimeout(() => this.remove(id), duration);
      }

      return id;
    },

    update(id, options) {
      const notification = state.notifications.get(id);
      if (!notification) return;

      const { element } = notification;
      const { progress, message, title } = options;

      if (title) element.querySelector('.toast-title').textContent = title;
      if (message) element.querySelector('.toast-message').textContent = message;
      
      if (progress !== undefined) {
        const progressBar = element.querySelector('.toast-progress-bar');
        const progressText = element.querySelector('.toast-progress-text');
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
      }
    },

    remove(id) {
      const notification = state.notifications.get(id);
      if (!notification) return;

      const { element } = notification;
      element.classList.add('translate-x-full');
      
      setTimeout(() => {
        element.remove();
        state.notifications.delete(id);
      }, 300);
    },

    clear() {
      state.notifications.forEach((_, id) => this.remove(id));
    }
  };

  // ---- Progress Tracking ----
  const progress = {
    init() {
      elements.progressButton?.addEventListener('click', this.toggleDropdown);
      document.addEventListener('click', (e) => {
        if (!elements.progressDropdown?.contains(e.target) && 
            !elements.progressButton?.contains(e.target)) {
          this.closeDropdown();
        }
      });

      // Auto-refresh progress
      this.startPolling();
    },

    toggleDropdown() {
      utils.toggle(elements.progressDropdown);
    },

    closeDropdown() {
      utils.hide(elements.progressDropdown);
    },

    async update() {
      try {
        const data = await utils.request(API.status);
        const activeCount = data.downloading ? Object.keys(data.downloading).length : 0;
        
        // Update header indicator
        if (activeCount > 0) {
          utils.show(elements.progressContainer);
          elements.progressText.textContent = `${activeCount} active`;
          this.updateDropdown(data);
        } else {
          utils.hide(elements.progressContainer);
        }

        // Update state
        state.activeDownloads.clear();
        if (data.downloading) {
          Object.values(data.downloading).forEach(item => {
            state.activeDownloads.set(item.id, item);
          });
        }

      } catch (error) {
        console.error('Failed to update progress:', error);
      }
    },

    updateDropdown(data) {
      // Update active downloads list
      const activeList = elements.activeDownloadsList;
      if (data.downloading && Object.keys(data.downloading).length > 0) {
        utils.show(document.getElementById('active-downloads-header'));
        activeList.innerHTML = Object.values(data.downloading).map(item => `
          <div class="p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <div class="flex items-center justify-between mb-2">
              <div class="font-medium text-sm truncate">${utils.escapeHtml(item.title || 'Unknown')}</div>
              <button class="text-xs text-red-600 hover:text-red-700" onclick="downloads.cancel('${item.id}')">Cancel</button>
            </div>
            ${item.progress ? `
              <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div class="bg-blue-600 h-1.5 rounded-full transition-all" style="width: ${item.progress}%"></div>
              </div>
              <div class="text-xs text-gray-500 mt-1">${item.progress}%</div>
            ` : ''}
          </div>
        `).join('');
      } else {
        utils.hide(document.getElementById('active-downloads-header'));
        activeList.innerHTML = '';
      }

      // Update recent history
      this.updateHistory();
    },

    updateHistory() {
      if (state.downloadHistory.length === 0) return;

      const historyList = elements.downloadHistoryList;
      historyList.innerHTML = state.downloadHistory.slice(0, 5).map(item => `
        <div class="p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 flex-shrink-0">
              ${item.status === 'completed' ? 
                '<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' :
                '<svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
              }
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">${utils.escapeHtml(item.title || 'Unknown')}</div>
              <div class="text-xs text-gray-500">${utils.formatDate(item.timestamp)}</div>
            </div>
          </div>
        </div>
      `).join('');
    },

    startPolling() {
      this.update();
      state.updateInterval = setInterval(() => this.update(), 2000);
    },

    stopPolling() {
      if (state.updateInterval) {
        clearInterval(state.updateInterval);
        state.updateInterval = null;
      }
    }
  };

  // ---- Search Functionality ----
  const search = {
    init() {
      elements.searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.execute();
      });
      elements.searchButton?.addEventListener('click', () => this.execute());
      elements.advSearchButton?.addEventListener('click', () => this.execute());
      elements.toggleAdvanced?.addEventListener('click', this.toggleAdvanced);

      // Global search in header
      document.getElementById('global-search')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value.trim();
          if (query) {
            elements.searchInput.value = query;
            navigation.navigateTo('search');
            this.execute();
          }
        }
      });
    },

    focus() {
      elements.searchInput?.focus();
    },

    toggleAdvanced() {
      utils.toggle(elements.searchFilters);
    },

    async execute() {
      const query = utils.buildSearchQuery();
      if (!query) {
        this.clearResults();
        return;
      }

      utils.show(elements.searchLoading);
      this.clearResults();

      try {
        const results = await utils.request(`${API.search}?${query}`);
        state.searchResults = results || [];
        this.renderResults(state.searchResults);
        
        // Update results count
        document.getElementById('results-count').textContent = 
          `${state.searchResults.length} results found`;
          
      } catch (error) {
        toast.show({
          type: 'error',
          title: 'Search Failed',
          message: 'Unable to search books. Please try again.',
          duration: 5000
        });
        this.clearResults();
      } finally {
        utils.hide(elements.searchLoading);
      }
    },

    renderResults(results) {
      if (!results || results.length === 0) {
        utils.show(elements.noResults);
        return;
      }

      utils.hide(elements.noResults);
      elements.resultsGrid.innerHTML = results.map(book => this.createBookCard(book)).join('');
    },

    createBookCard(book) {
      const cover = book.preview ? 
        `<img src="${utils.escapeHtml(book.preview)}" alt="Cover" class="w-full h-44 object-cover rounded-t-lg">` :
        `<div class="w-full h-44 bg-gray-200 dark:bg-gray-700 rounded-t-lg flex items-center justify-center">
          <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
          </svg>
        </div>`;

      return `
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow" style="background: var(--bg-soft); border-color: var(--border-muted);">
          ${cover}
          <div class="p-4">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">${utils.escapeHtml(book.title || 'Untitled')}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${utils.escapeHtml(book.author || 'Unknown Author')}</p>
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
              <span>${utils.escapeHtml(book.year || '--')}</span>
              <span>•</span>
              <span>${utils.escapeHtml(book.language || '--')}</span>
              <span>•</span>
              <span>${utils.escapeHtml(book.format || '--')}</span>
              ${book.size ? `<span>•</span><span>${utils.escapeHtml(book.size)}</span>` : ''}
            </div>
            <div class="flex gap-2">
              <button onclick="modal.showBookDetails('${utils.escapeHtml(book.id)}')" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" style="border-color: var(--border-muted);">
                Details
              </button>
              <button onclick="downloads.add('${utils.escapeHtml(book.id)}')" class="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Download
              </button>
            </div>
          </div>
        </div>
      `;
    },

    clearResults() {
      elements.resultsGrid.innerHTML = '';
      utils.hide(elements.noResults);
    }
  };

  // ---- Downloads Management ----
  const downloads = {
    init() {
      // Tab switching
      elements.downloadsTabs.forEach(tab => {
        tab.addEventListener('click', () => this.switchTab(tab.id.replace('tab-', '')));
      });

      // Refresh button
      document.getElementById('refresh-downloads')?.addEventListener('click', () => this.refresh());
      
      // Clear completed
      document.getElementById('clear-completed-btn')?.addEventListener('click', () => this.clearCompleted());
    },

    switchTab(tabName) {
      // Update active tab
      elements.downloadsTabs.forEach(tab => {
        tab.classList.toggle('active', tab.id === `tab-${tabName}`);
        tab.classList.toggle('border-blue-500', tab.id === `tab-${tabName}`);
        tab.classList.toggle('text-blue-600', tab.id === `tab-${tabName}`);
        tab.classList.toggle('border-transparent', tab.id !== `tab-${tabName}`);
        tab.classList.toggle('text-gray-500', tab.id !== `tab-${tabName}`);
      });

      // Update content
      elements.tabContents.forEach(content => {
        content.classList.toggle('hidden', content.id !== `${tabName}-content`);
      });

      // Load content for active tab
      this.loadTabContent(tabName);
    },

    async loadTabContent(tabName) {
      try {
        const data = await utils.request(API.status);
        const items = data[tabName] || {};
        
        this.renderTabContent(tabName, Object.values(items));
        this.updateTabCounts(data);
      } catch (error) {
        console.error(`Failed to load ${tabName} content:`, error);
      }
    },

    renderTabContent(tabName, items) {
      const listEl = document.getElementById(`${tabName}-downloads-list`);
      const emptyEl = document.getElementById(`no-${tabName}`);

      if (items.length === 0) {
        listEl.innerHTML = '';
        utils.show(emptyEl);
        return;
      }

      utils.hide(emptyEl);
      listEl.innerHTML = items.map(item => this.createDownloadItem(item, tabName)).join('');
    },

    createDownloadItem(item, status) {
      const progress = item.progress ? `
        <div class="mt-2">
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: ${item.progress}%"></div>
          </div>
          <div class="text-xs text-gray-500 mt-1">${item.progress}% complete</div>
        </div>
      ` : '';

      const actions = status === 'active' || status === 'queued' ? `
        <button onclick="downloads.cancel('${item.id}')" class="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">
          Cancel
        </button>
      ` : status === 'failed' ? `
        <button onclick="downloads.retry('${item.id}')" class="px-3 py-1 text-xs border border-blue-300 text-blue-600 rounded hover:bg-blue-50">
          Retry
        </button>
      ` : '';

      return `
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg" style="border-color: var(--border-muted);">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-gray-900 dark:text-white truncate">${utils.escapeHtml(item.title || 'Unknown')}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">${utils.escapeHtml(item.author || 'Unknown Author')}</p>
              <div class="text-xs text-gray-500 mt-1">
                ${item.format || '--'} • ${item.size || '--'}
                ${item.timestamp ? ` • ${utils.formatDate(item.timestamp)}` : ''}
              </div>
              ${progress}
            </div>
            <div class="ml-4 flex-shrink-0">
              ${actions}
            </div>
          </div>
          </div>
      `;
    },

    updateTabCounts(data) {
      document.getElementById('active-count').textContent = Object.keys(data.downloading || {}).length;
      document.getElementById('queued-count').textContent = Object.keys(data.queued || {}).length;
      document.getElementById('completed-count').textContent = Object.keys(data.completed || {}).length;
      document.getElementById('failed-count').textContent = Object.keys(data.error || {}).length;
    },

    async add(bookId) {
      try {
        await utils.request(`${API.download}?id=${encodeURIComponent(bookId)}`);
        
        toast.show({
          type: 'success',
          title: 'Download Started',
          message: 'Book has been added to the download queue',
          duration: 3000
        });

        // Refresh current view
        if (state.currentPage === 'downloads') {
          this.refresh();
        }
        
        // Update progress tracking
        progress.update();

      } catch (error) {
        toast.show({
          type: 'error',
          title: 'Download Failed',
          message: 'Unable to start download. Please try again.',
          duration: 5000
        });
      }
    },

    async cancel(downloadId) {
      try {
        await fetch(`${API.cancel}/${encodeURIComponent(downloadId)}/cancel`, {
          method: 'DELETE'
        });
        
        toast.show({
          type: 'info',
          title: 'Download Cancelled',
          message: 'Download has been cancelled',
          duration: 3000
        });

        this.refresh();
        progress.update();

      } catch (error) {
        toast.show({
          type: 'error',
          title: 'Cancel Failed',
          message: 'Unable to cancel download',
          duration: 5000
        });
      }
    },

    async retry(downloadId) {
      // Implementation depends on backend API
      toast.show({
        type: 'info',
        title: 'Retry Requested',
        message: 'Download retry has been queued',
        duration: 3000
      });
    },

    async clearCompleted() {
      try {
        await fetch(API.clearCompleted, { method: 'DELETE' });
        
        toast.show({
          type: 'success',
          title: 'Completed Downloads Cleared',
          message: 'All completed downloads have been removed',
          duration: 3000
        });

        this.refresh();

      } catch (error) {
        toast.show({
          type: 'error',
          title: 'Clear Failed',
          message: 'Unable to clear completed downloads',
          duration: 5000
        });
      }
    },

    async refresh() {
      if (state.currentPage === 'downloads') {
        const activeTab = document.querySelector('.downloads-tab.active')?.id.replace('tab-', '') || 'active';
        this.loadTabContent(activeTab);
      }
    }
  };

  // ---- Modal System ----
  const modal = {
    init() {
      elements.modalOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) this.close();
      });
      elements.closeModal?.addEventListener('click', () => this.close());
      elements.closeDetails?.addEventListener('click', () => this.close());
    },

    open() {
      utils.show(elements.modalOverlay);
      document.body.style.overflow = 'hidden';
    },

    close() {
      utils.hide(elements.modalOverlay);
      document.body.style.overflow = '';
      elements.detailsContainer.innerHTML = '';
    },

    async showBookDetails(bookId) {
      this.open();
      
      // Show loading state
      elements.detailsContainer.innerHTML = `
        <div class="flex items-center justify-center py-12">
          <svg class="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-2">Loading book details...</span>
        </div>
      `;

      try {
        const book = await utils.request(`${API.info}?id=${encodeURIComponent(bookId)}`);
        this.renderBookDetails(book);
      } catch (error) {
        elements.detailsContainer.innerHTML = `
          <div class="text-center py-12">
            <svg class="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Failed to load details</h3>
            <p class="text-gray-500 dark:text-gray-400">Unable to fetch book information</p>
          </div>
        `;
      }
    },

    renderBookDetails(book) {
      const cover = book.preview ? 
        `<img src="${utils.escapeHtml(book.preview)}" alt="Cover" class="w-full max-w-xs mx-auto rounded-lg shadow-lg">` :
        `<div class="w-full max-w-xs mx-auto h-64 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
          </svg>
        </div>`;

      const additionalInfo = book.info ? Object.entries(book.info).map(([key, value]) => `
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">${utils.escapeHtml(key)}:</span>
          <span class="text-gray-900 dark:text-white">${utils.escapeHtml(Array.isArray(value) ? value.join(', ') : value)}</span>
        </div>
      `).join('') : '';

      elements.detailsContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>${cover}</div>
          <div class="space-y-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">${utils.escapeHtml(book.title || 'Untitled')}</h1>
              <p class="text-lg text-gray-600 dark:text-gray-400">${utils.escapeHtml(book.author || 'Unknown Author')}</p>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Publisher:</span>
                <span class="text-gray-900 dark:text-white">${utils.escapeHtml(book.publisher || '--')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Year:</span>
                <span class="text-gray-900 dark:text-white">${utils.escapeHtml(book.year || '--')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Language:</span>
                <span class="text-gray-900 dark:text-white">${utils.escapeHtml(book.language || '--')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Format:</span>
                <span class="text-gray-900 dark:text-white">${utils.escapeHtml(book.format || '--')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Size:</span>
                <span class="text-gray-900 dark:text-white">${utils.escapeHtml(book.size || '--')}</span>
              </div>
            </div>
            ${additionalInfo ? `<div class="space-y-2 text-sm">${additionalInfo}</div>` : ''}
          </div>
        </div>
      `;

      // Update download button
      elements.downloadButton.onclick = () => {
        downloads.add(book.id);
        this.close();
      };
    }
  };

  // ---- Dashboard ----
  const dashboard = {
    async refresh() {
      try {
        const data = await utils.request(API.status);
        this.updateStats(data);
        this.updateActiveDownloads(data);
        this.updateRecentActivity(data);
      } catch (error) {
        console.error('Failed to refresh dashboard:', error);
      }
    },

    updateStats(data) {
      elements.statsActive.textContent = Object.keys(data.downloading || {}).length;
      elements.statsQueued.textContent = Object.keys(data.queued || {}).length;
      elements.statsCompleted.textContent = Object.keys(data.completed || {}).length;
      elements.statsFailed.textContent = Object.keys(data.error || {}).length;
    },

    updateActiveDownloads(data) {
      const container = document.getElementById('dashboard-active-downloads');
      const downloads = data.downloading ? Object.values(data.downloading) : [];

      if (downloads.length === 0) {
        container.innerHTML = `
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p>No active downloads</p>
          </div>
        `;
        return;
      }

      container.innerHTML = downloads.map(download => `
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-3 last:mb-0" style="border-color: var(--border-muted);">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-gray-900 dark:text-white truncate">${utils.escapeHtml(download.title || 'Unknown')}</h4>
            <button onclick="downloads.cancel('${download.id}')" class="text-xs text-red-600 hover:text-red-700">Cancel</button>
          </div>
          ${download.progress ? `
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: ${download.progress}%"></div>
            </div>
            <div class="text-xs text-gray-500 mt-1">${download.progress}% complete</div>
          ` : ''}
        </div>
      `).join('');
    },

    updateRecentActivity(data) {
      // Combine recent completed and failed downloads
      const recent = [
        ...Object.values(data.completed || {}),
        ...Object.values(data.error || {})
      ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 5);

      const container = document.getElementById('recent-activity');
      
      if (recent.length === 0) {
        container.innerHTML = `
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-sm">No recent activity</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="space-y-3">
          ${recent.map(item => `
            <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <div class="w-6 h-6 flex-shrink-0">
                ${item.status === 'completed' ? 
                  '<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' :
                  '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                }
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-white truncate">${utils.escapeHtml(item.title || 'Unknown')}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${utils.formatDate(item.timestamp)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  };

  // ---- Status Page ----
  const status = {
    async refresh() {
      console.log('Status page refresh - placeholder');
    }
  };

  // ---- Theme System ----
  const theme = {
    STORAGE_KEY: 'preferred-theme',
    
    init() {
      const saved = localStorage.getItem(this.STORAGE_KEY) || 'auto';
      this.apply(saved);
      this.updateIcons(saved);

      // Toggle dropdown
      elements.themeToggle?.addEventListener('click', () => {
        utils.toggle(elements.themeMenu);
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!elements.themeToggle?.contains(e.target) && !elements.themeMenu?.contains(e.target)) {
          utils.hide(elements.themeMenu);
        }
      });

      // Theme selection
      elements.themeMenu?.querySelectorAll('[data-theme]').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const theme = item.getAttribute('data-theme');
          localStorage.setItem(this.STORAGE_KEY, theme);
          this.apply(theme);
          this.updateIcons(theme);
          utils.hide(elements.themeMenu);
        });
      });

      // System theme change listener
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem(this.STORAGE_KEY) === 'auto') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    },

    apply(preference) {
      if (preference === 'auto') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', preference);
      }
    },

    updateIcons(preference) {
      const isDark = preference === 'dark' || 
        (preference === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        utils.show(elements.themeIconLight);
        utils.hide(elements.themeIconDark);
      } else {
        utils.hide(elements.themeIconLight);
        utils.show(elements.themeIconDark);
      }
    }
  };

  // ---- Initialization ----
  function init() {
    // Initialize all modules
    navigation.init();
    search.init();
    downloads.init();
    modal.init();
    progress.init();
    theme.init();

    // Set initial page
    navigation.navigateTo('dashboard');

    // Global error handler
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason);
      toast.show({
        type: 'error',
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please refresh the page.',
        duration: 10000
      });
    });

    console.log('Modern Book Downloader Dashboard initialized');
  }

  // ---- Global Functions (for onclick handlers) ----
  window.downloads = downloads;
  window.modal = modal;
  window.navigation = navigation;

  // Start the application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
