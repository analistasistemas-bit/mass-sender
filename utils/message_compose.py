from __future__ import annotations

GREETINGS = ('Ola', 'Oi', 'Bom dia')


def choose_greeting(contact_id: int) -> str:
    return GREETINGS[contact_id % len(GREETINGS)]


def compose_message_with_greeting_seed(base_template: str, contact_name: str | None, greeting_seed: int) -> str:
    safe_name = (contact_name or '').strip() or 'cliente'
    body = (base_template or '').replace('{{nome}}', safe_name).strip()
    greeting = choose_greeting(greeting_seed)
    return f'{greeting}, {safe_name}!\n\n{body}' if body else f'{greeting}, {safe_name}!'


def render_campaign_message(base_template: str, contact_name: str | None, contact_id: int) -> str:
    return compose_message_with_greeting_seed(base_template, contact_name, contact_id)


def render_test_run_message(
    base_template: str,
    contact_name: str | None,
    contact_id: int,
    attempt_index: int,
) -> str:
    return compose_message_with_greeting_seed(base_template, contact_name, contact_id + max(0, attempt_index))
