import httpx

from services.whatsapp import classify_http_error, classify_exception


def test_classify_http_transient():
    assert classify_http_error(429) == 'temporary'
    assert classify_http_error(503) == 'temporary'


def test_classify_http_permanent():
    assert classify_http_error(400) == 'permanent'


def test_classify_timeout_exception_temporary():
    err = httpx.ReadTimeout('timeout')
    assert classify_exception(err) == 'temporary'
