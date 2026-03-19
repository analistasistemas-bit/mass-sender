from utils.phone import normalize_br_phone


def test_normalize_br_local_mobile_number():
    ok, e164, error = normalize_br_phone('(11) 98888-7777')
    assert ok is True
    assert e164 == '+5511988887777'
    assert error is None


def test_normalize_rejects_non_br_country():
    ok, e164, error = normalize_br_phone('+1 415 555 1212')
    assert ok is False
    assert e164 is None
    assert 'Brasil' in error
