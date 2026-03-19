from services.campaign_service import render_message


def test_render_message_with_name():
    text = render_message('Oi, {{nome}}!', 'Marina')
    assert text == 'Oi, Marina!'


def test_render_message_fallback_name():
    text = render_message('Oi, {{nome}}!', '')
    assert text == 'Oi, cliente!'
