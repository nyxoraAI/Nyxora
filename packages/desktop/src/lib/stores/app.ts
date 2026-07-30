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
    setActiveSession: (id: string | null) => update(s => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('nyxora_last_active_session', JSON.stringify(id));
      }
      return { ...s, activeSessionId: id, currentView: 'chat', isSearchOpen: false };
    }),
    toggleSettings: () => update(s => ({ ...s, isSettingsOpen: !s.isSettingsOpen })),
    toggleSearch: () => update(s => ({ ...s, isSearchOpen: !s.isSearchOpen, currentView: s.isSearchOpen ? s.currentView : 'chat' })),
    toggleSidebar: () => update(s => ({ ...s, isSidebarCollapsed: !s.isSidebarCollapsed })),
    toggleSidebarOpen: () => update(s => ({ ...s, isSidebarOpen: !s.isSidebarOpen })),
    setTheme: (theme: 'dark' | 'light' | 'auto') => update(s => ({ ...s, theme })),
    setNetwork: (network: string) => update(s => ({ ...s, currentNetwork: network })),
    addWorkspace: (path: string, select = true) => update(s => {
      const newWs = s.localWorkspaces.includes(path) ? s.localWorkspaces : [...s.localWorkspaces, path];
      const newActive = select ? path : s.activeWorkspace;
      if (select && typeof localStorage !== 'undefined') {
        localStorage.setItem('nyxora_last_active_workspace', JSON.stringify(newActive));
      }
      return { 
        ...s, 
        localWorkspaces: newWs,
        activeWorkspace: newActive
      };
    }),
    removeWorkspace: (path: string) => update(s => {
      const newWorkspaces = s.localWorkspaces.filter(w => w !== path);
      const newActive = s.activeWorkspace === path ? null : s.activeWorkspace;
      if (typeof localStorage !== 'undefined' && s.activeWorkspace === path) {
        localStorage.setItem('nyxora_last_active_workspace', JSON.stringify(newActive));
      }
      return {
        ...s,
        localWorkspaces: newWorkspaces,
        activeWorkspace: newActive
      };
    }),
    setActiveWorkspace: (path: string | null) => update(s => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('nyxora_last_active_workspace', JSON.stringify(path));
      }
      return { ...s, activeWorkspace: path };
    })
  };
}

export const appState = createAppState();
