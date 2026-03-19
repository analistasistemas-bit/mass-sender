from __future__ import annotations

import os
from typing import Optional

import httpx


class WhatsAppError(Exception):
    def __init__(self, message: str, http_status: Optional[int] = None, error_class: str = 'temporary'):
        super().__init__(message)
        self.http_status = http_status
        self.error_class = error_class


def classify_http_error(status_code: int) -> str:
    if status_code == 429 or 500 <= status_code <= 599:
        return 'temporary'
    if 400 <= status_code <= 499:
        return 'permanent'
    return 'temporary'


def classify_exception(exc: Exception) -> str:
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError)):
        return 'temporary'
    return 'temporary'


class WhatsAppClient:
    def __init__(self, transport: Optional[httpx.AsyncBaseTransport] = None) -> None:
        explicit_provider = os.getenv('WHATSAPP_PROVIDER', '').strip().lower()
        bridge_base_url = os.getenv('WA_BRIDGE_BASE_URL', '').rstrip('/')

        if explicit_provider:
            self.provider = explicit_provider
        elif bridge_base_url:
            self.provider = 'bridge'
        else:
            self.provider = 'evolution'

        self._transport = transport
        self.base_url = os.getenv('EVOLUTION_BASE_URL', '').rstrip('/')
        self.instance = os.getenv('EVOLUTION_INSTANCE', '')
        self.api_key = os.getenv('EVOLUTION_API_KEY', '')
        self.bridge_base_url = bridge_base_url
        self.bridge_api_key = os.getenv('WA_BRIDGE_API_KEY', '')

    @property
    def configured(self) -> bool:
        if self.provider == 'bridge':
            return bool(self.bridge_base_url)
        return bool(self.base_url and self.instance and self.api_key)

    def _headers(self) -> dict[str, str]:
        if self.provider == 'bridge':
            headers = {}
            if self.bridge_api_key:
                headers['x-api-key'] = self.bridge_api_key
            return headers
        return {'apikey': self.api_key}

    def _client(self, timeout: int) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=timeout, transport=self._transport)

    def _send_url(self) -> str:
        if self.provider == 'bridge':
            return f'{self.bridge_base_url}/messages/send-text'
        return f'{self.base_url}/message/sendText/{self.instance}'

    async def _bridge_request(self, method: str, path: str) -> dict:
        if self.provider != 'bridge':
            raise WhatsAppError('Operação disponível apenas para provider bridge', error_class='permanent')
        if not self.configured:
            raise WhatsAppError('Bridge não configurado', error_class='temporary')

        url = f'{self.bridge_base_url}{path}'
        try:
            async with self._client(timeout=15) as client:
                response = await client.request(method, url, headers=self._headers())
        except Exception as exc:
            raise WhatsAppError(str(exc), error_class=classify_exception(exc)) from exc

        if response.status_code >= 400:
            err_class = classify_http_error(response.status_code)
            raise WhatsAppError(response.text[:500], http_status=response.status_code, error_class=err_class)

        try:
            return response.json()
        except Exception as exc:
            raise WhatsAppError(f'Resposta inválida do bridge: {exc}', error_class='temporary') from exc

    async def send_text(self, phone_e164: str, text: str) -> None:
        if not self.configured:
            raise WhatsAppError('Backend WhatsApp não configurado', error_class='temporary')

        if self.provider == 'bridge':
            payload = {'phone': phone_e164, 'text': text}
        else:
            payload = {'number': phone_e164, 'textMessage': {'text': text}}

        try:
            async with self._client(timeout=25) as client:
                response = await client.post(self._send_url(), json=payload, headers=self._headers())
        except Exception as exc:  # network/timeouts
            raise WhatsAppError(str(exc), error_class=classify_exception(exc)) from exc

        if response.status_code >= 400:
            err_class = classify_http_error(response.status_code)
            raise WhatsAppError(response.text[:500], http_status=response.status_code, error_class=err_class)

    async def bridge_session(self) -> dict:
        return await self._bridge_request('GET', '/session')

    async def bridge_qr(self) -> dict:
        return await self._bridge_request('GET', '/session/qr')

    async def bridge_restart(self) -> dict:
        return await self._bridge_request('POST', '/session/restart')

    async def bridge_reset(self) -> dict:
        return await self._bridge_request('POST', '/session/reset')

    async def healthcheck(self) -> tuple[bool, str]:
        if not self.configured:
            return False, 'Credenciais ausentes'

        try:
            async with self._client(timeout=10) as client:
                if self.provider == 'bridge':
                    response = await client.get(f'{self.bridge_base_url}/health', headers=self._headers())
                    if response.status_code < 500:
                        payload = response.json()
                        connected = payload.get('connected')
                        state = payload.get('state', 'unknown')
                        if connected:
                            return True, f'Bridge acessível ({state})'
                        return True, f'Bridge acessível, sessão {state}'
                    return False, f'Bridge indisponível ({response.status_code})'

                response = await client.get(self.base_url, headers=self._headers())
            if response.status_code < 500:
                return True, 'Evolution acessível'
            return False, f'Evolution indisponível ({response.status_code})'
        except Exception as exc:
            return False, f'Falha de conexão: {exc}'
