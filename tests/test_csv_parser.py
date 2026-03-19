from utils.csv_parser import parse_csv_bytes


def test_parse_csv_valid_rows():
    payload = 'nome,telefone,email\nAna,(11)98888-7777,ana@x.com\n'.encode('utf-8')
    parsed = parse_csv_bytes(payload)
    assert parsed.summary.total == 1
    assert parsed.summary.valid == 1
    assert parsed.summary.invalid == 0
    assert parsed.rows[0].phone_e164 == '+5511988887777'


def test_parse_csv_missing_column():
    payload = 'nome,telefone\nAna,11988887777\n'.encode('utf-8')
    parsed = parse_csv_bytes(payload)
    assert parsed.summary.total == 1
    assert parsed.summary.invalid == 1
    assert 'colunas' in parsed.rows[0].error.lower()


def test_parse_csv_with_uppercase_legacy_headers_and_extra_first_column():
    payload = (
        ',"NOME_CLIENTE","TELEFONE","E_MAIL"\n'
        '1,"EMMET DOUGLAS DOS SANTOS FEIT","5581992049923",""\n'
        '2,"RWC WERI CONFECCAO","5581984299667",""\n'
        '3,"A M MACEDO DA SILVA","5581999504113","vestgraf@hotmail.com"\n'
    ).encode('utf-8')

    parsed = parse_csv_bytes(payload)

    assert parsed.summary.total == 3
    assert parsed.summary.valid == 3
    assert parsed.summary.invalid == 0
    assert parsed.rows[0].nome == 'EMMET DOUGLAS DOS SANTOS FEIT'
    assert parsed.rows[0].phone_e164 == '+5581992049923'
    assert parsed.rows[0].email == ''


def test_parse_csv_with_broken_wrapped_quotes_layout():
    payload = (
        '"   ,""NOME_CLIENTE,""TELEFONE"",""E_MAIL"""\r\n'
        '"1,""MARCELO WOLLENWEBER"",""5581996441716"",""MARCELO.WOLLENWEBER@GMAIL.COM                               """\r\n'
        '"2,""MARIA ALICE2,""5581995577882"",""ALICE.TI@GRUPOAVIL.COM.BR                                   """\r\n'
        '"3,""SAMUEL TAVARES3,""5581997093699"",""                                                            """\r\n'
    ).encode('utf-8')

    parsed = parse_csv_bytes(payload)

    assert parsed.summary.total == 3
    assert parsed.summary.valid == 3
    assert parsed.summary.invalid == 0
    assert parsed.rows[0].phone_e164 == '+5581996441716'
