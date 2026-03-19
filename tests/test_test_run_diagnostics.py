from services.whatsapp import WhatsAppError

import main


def test_classify_test_run_failure_bridge_unreachable():
    code, detail = main.classify_test_run_failure(WhatsAppError('All connection attempts failed'))
    assert code == 'bridge_unreachable'
    assert 'wa-bridge' in detail


def test_classify_test_run_failure_number_resolution_failed():
    code, detail = main.classify_test_run_failure(WhatsAppError('No LID for user'))
    assert code == 'number_resolution_failed'
    assert 'No LID' in detail


def test_classify_test_run_failure_fallback():
    code, detail = main.classify_test_run_failure(RuntimeError('random boom'))
    assert code == 'send_failed'
    assert detail == 'random boom'
