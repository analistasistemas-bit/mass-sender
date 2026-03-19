from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Union

def load_app_env(env_path: Optional[Union[str, Path]] = None) -> None:
    path = Path(env_path) if env_path is not None else Path(__file__).resolve().parent.parent / '.env'
    if not path.exists():
        return

    for line in path.read_text(encoding='utf-8').splitlines():
        entry = line.strip()
        if not entry or entry.startswith('#') or '=' not in entry:
            continue
        key, value = entry.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip())
