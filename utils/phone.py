from __future__ import annotations

import re
from typing import Optional, Tuple

DIGITS_RE = re.compile(r'\D+')


def normalize_br_phone(raw: str) -> Tuple[bool, Optional[str], Optional[str]]:
    if not raw:
        return False, None, 'Telefone ausente'

    stripped = raw.strip()
    digits = DIGITS_RE.sub('', raw)

    if digits.startswith('00'):
        digits = digits[2:]

    if stripped.startswith('+') and not digits.startswith('55'):
        return False, None, 'Apenas telefones do Brasil (+55) são aceitos'

    if digits.startswith('55'):
        national = digits[2:]
    elif len(digits) in (10, 11):
        national = digits
    else:
        return False, None, 'Formato inválido para Brasil (+55)'

    if len(national) not in (10, 11):
        return False, None, 'Telefone Brasil deve ter DDD + número'

    ddd = national[:2]
    if not ddd.isdigit() or int(ddd) < 11 or int(ddd) > 99:
        return False, None, 'DDD inválido'

    subscriber = national[2:]
    if len(subscriber) == 9 and not subscriber.startswith('9'):
        return False, None, 'Celular de 9 dígitos deve iniciar com 9'

    if len(subscriber) not in (8, 9):
        return False, None, 'Número do assinante inválido'

    return True, f'+55{national}', None
