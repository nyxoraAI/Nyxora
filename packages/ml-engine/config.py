import os
import yaml
from pathlib import Path
from typing import Dict, Any

def get_app_dir() -> Path:
    """Returns the base Nyxora app directory (~/.nyxora)"""
    home = Path.home()
    app_dir = home / '.nyxora'
    return app_dir

def get_config_dir() -> Path:
    """Returns the Nyxora config directory (~/.nyxora/config)"""
    return get_app_dir() / 'config'

def load_yaml(file_name: str) -> Dict[str, Any]:
    """Safely load a YAML file from the config directory"""
    file_path = get_config_dir() / file_name
    if not file_path.exists():
        return {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            parsed = yaml.safe_load(f)
            return parsed if parsed is not None else {}
    except Exception as e:
        print(f"[Config] Error loading {file_name}: {e}")
        return {}

class NyxoraConfig:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(NyxoraConfig, cls).__new__(cls)
            cls._instance.refresh()
        return cls._instance

    def refresh(self):
        """Reload all configuration files"""
        self.core = load_yaml('config.yaml')
        self.market_keys = load_yaml('market_keys.yaml')
        self.policy = load_yaml('policy.yaml')
        self.rpc_keys = load_yaml('rpc_key.yaml')
        
    def get_llm_provider(self) -> str:
        return self.core.get('llm', {}).get('provider', 'openai')
        
    def get_llm_model(self) -> str:
        return self.core.get('llm', {}).get('model', 'gpt-4o-mini')
        
    def get_credentials(self) -> Dict[str, str]:
        return self.core.get('credentials', {})
        
    def get_market_key(self, service: str) -> str:
        """Get a market key, e.g. 'coingecko_pro'"""
        return self.market_keys.get(service, '')
        
config = NyxoraConfig()
