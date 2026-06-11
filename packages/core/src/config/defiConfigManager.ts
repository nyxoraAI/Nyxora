import fs from 'fs';
import yaml from 'yaml';
import { getPath } from './paths';

export interface DefiKeys {
  zerion_key?: string;
  inch_key?: string;
  zero_x_key?: string;
  lifi_key?: string;
  relay_key?: string;
  openocean_key?: string;
  cmc_key?: string;
  [key: string]: string | undefined;
}

export function loadDefiKeys(): DefiKeys {
  const configPath = getPath('defi_keys.yaml');
  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const file = fs.readFileSync(configPath, 'utf8');
    return yaml.parse(file) as DefiKeys || {};
  } catch (e) {
    console.error('[DefiConfig] Failed to load defi_keys.yaml', e);
    return {};
  }
}

export function saveDefiKeys(newKeys: Partial<DefiKeys>): void {
  const configPath = getPath('defi_keys.yaml');
  try {
    const currentKeys = loadDefiKeys();
    const merged = { ...currentKeys, ...newKeys };
    const yamlStr = yaml.stringify(merged);
    fs.writeFileSync(configPath, yamlStr, 'utf8');
  } catch (e) {
    console.error('[DefiConfig] Failed to save defi_keys.yaml', e);
  }
}
