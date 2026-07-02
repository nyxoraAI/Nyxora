import os
from config import config

def get_llm():
    provider = config.get_llm_provider().lower()
    model_name = config.get_llm_model()
    creds = config.get_credentials()

    if provider == 'openai':
        from langchain_openai import ChatOpenAI
        api_key = creds.get('openai')
        if not api_key:
            api_key = os.environ.get('OPENAI_API_KEY', '')
        return ChatOpenAI(model=model_name, openai_api_key=api_key, temperature=0.2)
        
    elif provider == '9router' or provider == 'ollama':
        from langchain_openai import ChatOpenAI
        base_url = "http://localhost:20128/v1" if provider == '9router' else "http://localhost:11434/v1"
        return ChatOpenAI(model=model_name, openai_api_key="local", base_url=base_url, temperature=0.2)
        
    elif provider == 'gemini':
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = creds.get('gemini')
        if not api_key:
            api_key = os.environ.get('GEMINI_API_KEY', '')
        return ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key, temperature=0.2)
        
    elif provider == 'anthropic':
        from langchain_anthropic import ChatAnthropic
        api_key = creds.get('anthropic')
        if not api_key:
            api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        return ChatAnthropic(model_name=model_name, anthropic_api_key=api_key, temperature=0.2)
        
    else:
        # Fallback to OpenAI if unknown
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model='gpt-4o-mini', temperature=0.2)
