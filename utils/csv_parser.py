from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Optional

from utils.phone import normalize_br_phone

REQUIRED_COLUMNS = {'nome', 'telefone', 'email'}
FIELD_ALIASES = {
    'nome': {'nome', 'nome_cliente', '_nome_cliente'},
    'telefone': {'telefone', '_telefone'},
    'email': {'email', 'e_mail', '_e_mail'},
}


@dataclass
class ParsedRow:
    nome: str
    telefone: str
    email: str
    phone_e164: Optional[str]
    valid: bool
    error: Optional[str]


@dataclass
class ParsedSummary:
    total: int
    valid: int
    invalid: int


@dataclass
class ParsedCSV:
    rows: list[ParsedRow]
    summary: ParsedSummary


def _normalize_header(header: str) -> str:
    normalized = (header or '').strip().strip('"').strip("'").lower()
    return normalized.replace(' ', '_')


def _resolve_field(raw: dict[str, str], canonical: str) -> str:
    aliases = FIELD_ALIASES[canonical]
    normalized_map = {_normalize_header(key): (value or '') for key, value in raw.items() if key is not None}
    for alias in aliases:
        if alias in normalized_map:
            return normalized_map[alias].strip()
    return ''


def _missing_required_headers(fieldnames: list[str]) -> set[str]:
    normalized_headers = {_normalize_header(name) for name in fieldnames}
    missing: set[str] = set()
    for canonical in REQUIRED_COLUMNS:
        aliases = FIELD_ALIASES[canonical]
        if not normalized_headers.intersection(aliases):
            missing.add(canonical)
    return missing


def _looks_like_wrapped_legacy_csv(text: str) -> bool:
    lowered = text.lower()
    return 'nome_cliente' in lowered and 'telefone' in lowered and 'e_mail' in lowered and '""' in text


def _normalize_wrapped_legacy_csv(text: str) -> str:
    normalized_lines: list[str] = []
    for raw_line in text.replace('\r\n', '\n').split('\n'):
        line = raw_line.strip()
        if not line:
            continue
        if len(line) >= 2 and line.startswith('"') and line.endswith('"'):
            line = line[1:-1]
        line = line.replace('""', '"')
        line = line.replace('"', '')

        lowered = line.lower().replace(' ', '')
        if 'nome_cliente' in lowered and 'telefone' in lowered and 'e_mail' in lowered:
            line = 'idx,NOME_CLIENTE,TELEFONE,E_MAIL'

        normalized_lines.append(line)

    if not normalized_lines:
        return ''
    return '\n'.join(normalized_lines) + '\n'


def _parse_text_as_csv(text: str) -> ParsedCSV:
    reader = csv.DictReader(io.StringIO(text))
    rows: list[ParsedRow] = []

    if reader.fieldnames is None:
        return ParsedCSV(
            rows=[ParsedRow('', '', '', None, False, 'CSV vazio ou sem cabeçalho')],
            summary=ParsedSummary(total=1, valid=0, invalid=1),
        )

    missing = _missing_required_headers(reader.fieldnames)

    for raw in reader:
        nome = _resolve_field(raw, 'nome')
        telefone = _resolve_field(raw, 'telefone')
        email = _resolve_field(raw, 'email')

        if missing:
            rows.append(ParsedRow(nome, telefone, email, None, False, f'CSV sem colunas obrigatórias: {", ".join(sorted(missing))}'))
            continue

        ok, phone_e164, error = normalize_br_phone(telefone)
        rows.append(ParsedRow(nome, telefone, email, phone_e164, ok, error))

    total = len(rows)
    valid = len([r for r in rows if r.valid])
    invalid = total - valid

    return ParsedCSV(rows=rows, summary=ParsedSummary(total=total, valid=valid, invalid=invalid))


def parse_csv_bytes(payload: bytes) -> ParsedCSV:
    try:
        text = payload.decode('utf-8', errors='strict')
    except UnicodeDecodeError:
        return ParsedCSV(
            rows=[ParsedRow('', '', '', None, False, 'CSV não está em UTF-8')],
            summary=ParsedSummary(total=1, valid=0, invalid=1),
        )

    parsed = _parse_text_as_csv(text)
    missing_headers_only = (
        parsed.summary.total > 0
        and parsed.summary.valid == 0
        and all((row.error or '').startswith('CSV sem colunas obrigatórias') for row in parsed.rows)
    )

    if parsed.summary.total > 0 and not missing_headers_only:
        return parsed

    if _looks_like_wrapped_legacy_csv(text):
        repaired = _normalize_wrapped_legacy_csv(text)
        if repaired:
            return _parse_text_as_csv(repaired)

    return parsed
