import importlib
from pathlib import Path


def test_load_dotenv_file_populates_missing_env(monkeypatch, tmp_path):
    monkeypatch.delenv('WHATSAPP_PROVIDER', raising=False)
    monkeypatch.delenv('DB_PATH', raising=False)

    env_file = tmp_path / '.env'
    env_file.write_text('WHATSAPP_PROVIDER=bridge\nDB_PATH=custom.db\n', encoding='utf-8')

    config = importlib.import_module('utils.config')
    importlib.reload(config)
    config.load_app_env(env_file)

    assert config.os.getenv('WHATSAPP_PROVIDER') == 'bridge'
    assert config.os.getenv('DB_PATH') == 'custom.db'


def test_load_dotenv_does_not_override_existing_env(monkeypatch, tmp_path):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'evolution')
    env_file = tmp_path / '.env'
    env_file.write_text('WHATSAPP_PROVIDER=bridge\n', encoding='utf-8')

    config = importlib.import_module('utils.config')
    importlib.reload(config)
    config.load_app_env(env_file)

    assert config.os.getenv('WHATSAPP_PROVIDER') == 'evolution'
