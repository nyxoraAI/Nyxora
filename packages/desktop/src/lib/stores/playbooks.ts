import { writable } from 'svelte/store';
import { apiFetch } from '$lib/utils/api';

export interface Playbook {
  filename: string;
  content: string;
}

function createPlaybooksStore() {
  const { subscribe, set, update } = writable({
    playbooks: [] as Playbook[],
    isLoading: false,
    error: '',
  });

  return {
    subscribe,
    fetchPlaybooks: async () => {
      update(s => ({ ...s, isLoading: true, error: '' }));
      try {
        const res = await apiFetch('/api/playbooks');
        if (res.ok) {
          const data = await res.json();
          update(s => ({ ...s, playbooks: data || [], isLoading: false }));
        } else {
          update(s => ({ ...s, error: 'Failed to fetch playbooks', isLoading: false }));
        }
      } catch (err: any) {
        update(s => ({ ...s, error: err.message, isLoading: false }));
      }
    }
  };
}

export const playbooksStore = createPlaybooksStore();
