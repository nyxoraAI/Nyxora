import { writable } from 'svelte/store';

export type ViewType = 'chat' | 'overview' | 'market' | 'portfolio' | 'playbooks' | 'settings';

function createAppState() {
  const { subscribe, set, update } = writable({
    currentView: 'chat' as ViewType,
    activeSessionId: null as string | null,
    isSettingsOpen: false,
    isSearchOpen: false,
    isSidebarCollapsed: false,
    isSidebarOpen: true,
    theme: 'auto' as 'dark' | 'light' | 'auto',
    currentNetwork: 'Ethereum Mainnet',
    localWorkspaces: [] as string[],
    activeWorkspace: null as string | null,
  });

  return {
    subscribe,
    setView: (view: ViewType) => update(s => ({ ...s, currentView: view, isSearchOpen: false })),
    setActiveSession: (id: string | null) => update(s => ({ ...s, activeSessionId: id, currentView: 'chat', isSearchOpen: false })),
    toggleSettings: () => update(s => ({ ...s, isSettingsOpen: !s.isSettingsOpen })),
    toggleSearch: () => update(s => ({ ...s, isSearchOpen: !s.isSearchOpen, currentView: s.isSearchOpen ? s.currentView : 'chat' })),
    toggleSidebar: () => update(s => ({ ...s, isSidebarCollapsed: !s.isSidebarCollapsed })),
    toggleSidebarOpen: () => update(s => ({ ...s, isSidebarOpen: !s.isSidebarOpen })),
    setTheme: (theme: 'dark' | 'light' | 'auto') => update(s => ({ ...s, theme })),
    setNetwork: (network: string) => update(s => ({ ...s, currentNetwork: network })),
    addWorkspace: (path: string) => update(s => ({ 
      ...s, 
      localWorkspaces: s.localWorkspaces.includes(path) ? s.localWorkspaces : [...s.localWorkspaces, path],
      activeWorkspace: path
    })),
    removeWorkspace: (path: string) => update(s => {
      const newWorkspaces = s.localWorkspaces.filter(w => w !== path);
      return {
        ...s,
        localWorkspaces: newWorkspaces,
        activeWorkspace: s.activeWorkspace === path ? null : s.activeWorkspace
      };
    }),
    setActiveWorkspace: (path: string | null) => update(s => ({ ...s, activeWorkspace: path }))
  };
}

export const appState = createAppState();
