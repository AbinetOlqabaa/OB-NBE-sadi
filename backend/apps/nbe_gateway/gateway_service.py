import os
import time
import uuid
import requests
from django.utils import timezone
from .models import GatewayScenario, NbeSubmissionRecord, GatewayAuditLog

class NbeGatewayService:
    """
    Client service for dispatching regulatory returns to the external NBE Gateway
    with retry backoff, mTLS simulation, idempotency headers, and audit logging.
    Falls back seamlessly to local engine when external microservice is offline.
    """

    SIMULATOR_BASE_URL = os.environ.get('NBE_SIMULATOR_URL', 'http://127.0.0.1:8001/api/v1/nbe-simulator')
    MAX_RETRIES = 3
    TIMEOUT_SECONDS = 2

    @classmethod
    def get_simulator_url(cls, path: str = 'submit') -> str:
        base = cls.SIMULATOR_BASE_URL.rstrip('/')
        clean_path = path.lstrip('/')
        return f"{base}/{clean_path}"

    @classmethod
    def transmit_submission(cls, submission, user) -> dict:
        """
        Transmits a validated & checker-approved regulatory submission to the NBE Gateway.
        Converts submission entity into standard NBE envelope format.
        """
        correlation_id = f"corr_{submission.id}_{int(time.time()*1000)}"
        idempotency_key = f"idemp_{submission.id}_v{submission.version}"

        # Construct canonical NBE payload
        return_items = [
            {'Code': str(k), 'Value': v}
            for k, v in (submission.values or {}).items()
        ]

        dynamic_areas = []
        for area_id, rows in (submission.dynamic_rows or {}).items():
            if isinstance(rows, list):
                row_values = [r.get('values', r) if isinstance(r, dict) else r for r in rows]
                try:
                    area_num = int(area_id)
                except ValueError:
                    area_num = 1
                dynamic_areas.append({'Area': area_num, 'Rows': row_values})

        payload = {
            'ReturnKey': submission.report_key,
            'InstCode': '0000013',
            'FinYear': submission.period_year,
            'StartDate': str(getattr(submission, 'period_start', None) or f"{submission.period_year}-01-01"),
            'EndDate': str(getattr(submission, 'period_end', None) or f"{submission.period_year}-12-31"),
            'ReturnItemsList': return_items,
            'DynamicItemsList': dynamic_areas,
            'Maker': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
            },
            'Checker': {
                'id': getattr(submission, 'checker_id', '') or '',
                'name': getattr(submission, 'checker_name', '') or '',
            },
        }

        headers = {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotency_key,
            'X-Correlation-ID': correlation_id,
            'X-Institution-Code': '0000013',
            'Authorization': 'Bearer NBE_MTLS_CERT_SIMULATED_2026',
        }

        status_code, response_body = cls.dispatch_http(
            endpoint=cls.get_simulator_url('submit'),
            payload=payload,
            headers=headers,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
            report_key=submission.report_key
        )

        return response_body

    @classmethod
    def dispatch_http(
        cls,
        endpoint: str,
        payload: dict,
        headers: dict,
        correlation_id: str,
        idempotency_key: str,
        report_key: str
    ) -> tuple[int, dict]:
        """
        Executes outbound HTTP POST with retry backoff for 500/504 errors.
        Falls back to local simulation engine if simulator daemon is not active.
        """
        url = endpoint
        for attempt in range(1, cls.MAX_RETRIES + 1):
            try:
                resp = requests.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=cls.TIMEOUT_SECONDS
                )
                status_code = resp.status_code
                try:
                    resp_json = resp.json()
                except Exception:
                    resp_json = {'raw': resp.text, 'statusCode': status_code}

                cls._log_gateway(
                    direction='OUTBOUND',
                    status_code=status_code,
                    correlation_id=correlation_id,
                    idempotency_key=idempotency_key,
                    message=f"[Attempt {attempt}] NBE Gateway returned HTTP {status_code} for return {report_key}"
                )

                if status_code in (500, 504) and attempt < cls.MAX_RETRIES:
                    time.sleep(0.05 * attempt)
                    continue

                return status_code, resp_json

            except requests.exceptions.RequestException:
                if attempt < cls.MAX_RETRIES:
                    time.sleep(0.05 * attempt)
                    continue

                # Local simulation engine fallback
                status_code, resp_body = cls._handle_local_simulation(
                    method='POST',
                    path='submit',
                    data=payload,
                    headers=headers
                )
                cls._log_gateway(
                    direction='OUTBOUND',
                    status_code=status_code,
                    correlation_id=correlation_id,
                    idempotency_key=idempotency_key,
                    message=f"[Local Simulation Fallback] Processed return {report_key} with status {status_code}"
                )
                return status_code, resp_body

        return cls._handle_local_simulation('POST', 'submit', payload, headers)

    @classmethod
    def proxy_to_simulator(cls, method: str, path: str, data: dict = None, headers: dict = None) -> tuple[int, dict]:
        """
        Reverse-proxy helper with local fallback if simulator daemon is not running.
        """
        url = cls.get_simulator_url(path)
        req_headers = {'Content-Type': 'application/json'}
        if headers:
            for k in ['Idempotency-Key', 'idempotency-key', 'X-Correlation-ID', 'x-correlation-id', 'X-Simulator-Force-Scenario', 'HTTP_IDEMPOTENCY_KEY', 'HTTP_X_CORRELATION_ID']:
                if k in headers:
                    req_headers[k] = headers[k]

        try:
            if method.upper() == 'GET':
                resp = requests.get(url, headers=req_headers, timeout=cls.TIMEOUT_SECONDS)
            elif method.upper() == 'POST':
                resp = requests.post(url, json=data, headers=req_headers, timeout=cls.TIMEOUT_SECONDS)
            elif method.upper() == 'DELETE':
                resp = requests.delete(url, headers=req_headers, timeout=cls.TIMEOUT_SECONDS)
            else:
                return 405, {'error': f"Method {method} not supported"}

            try:
                return resp.status_code, resp.json()
            except Exception:
                return resp.status_code, {'raw': resp.text}
        except requests.exceptions.RequestException:
            # Microservice is offline, execute via internal local simulation engine
            return cls._handle_local_simulation(method, path, data, headers)

    @classmethod
    def _handle_local_simulation(cls, method: str, path: str, data: dict = None, headers: dict = None) -> tuple[int, dict]:
        clean_path = path.lstrip('/')
        scenario = GatewayScenario.get_current()

        if clean_path == 'gateway-health':
            return 200, {
                'status': 'ONLINE',
                'service': 'NBE Regulatory Ingestion Gateway (Local Simulation)',
                'scenario': scenario.mode,
                'latencyMs': scenario.latency_ms
            }

        if clean_path == 'scenario':
            if method.upper() == 'GET':
                return 200, {
                    'mode': scenario.mode,
                    'latencyMs': scenario.latency_ms,
                    'failureMessage': scenario.failure_message,
                    'flakyFailureRate': scenario.flaky_failure_rate
                }
            elif method.upper() == 'POST':
                if data and 'mode' in data:
                    scenario.mode = data['mode']
                if data and 'latencyMs' in data:
                    scenario.latency_ms = data['latencyMs']
                if data and 'failureMessage' in data:
                    scenario.failure_message = data['failureMessage']
                scenario.save()
                return 200, {
                    'success': True,
                    'mode': scenario.mode,
                    'latencyMs': scenario.latency_ms
                }

        if clean_path == 'submissions':
            records = list(NbeSubmissionRecord.objects.all().values(
                'submission_id', 'report_key', 'institution_code', 'correlation_id', 'idempotency_key', 'status', 'received_at'
            ))
            return 200, {'submissions': records, 'total': len(records)}

        if clean_path == 'logs':
            if method.upper() == 'DELETE':
                GatewayAuditLog.objects.all().delete()
                return 200, {'success': True, 'message': 'Gateway logs cleared'}
            logs = list(GatewayAuditLog.objects.all().order_by('-timestamp').values()[:50])
            return 200, {'logs': logs, 'total': len(logs)}

        if clean_path == 'submit':
            payload = data or {}
            corr_id = None
            idemp_key = None
            if headers:
                corr_id = (
                    headers.get('X-Correlation-ID') or
                    headers.get('x-correlation-id') or
                    headers.get('HTTP_X_CORRELATION_ID') or
                    headers.get('Correlation-Id')
                )
                idemp_key = (
                    headers.get('Idempotency-Key') or
                    headers.get('idempotency-key') or
                    headers.get('HTTP_IDEMPOTENCY_KEY') or
                    headers.get('Idempotency_Key')
                )
            if not corr_id:
                corr_id = f"corr_sim_{int(time.time()*1000)}"
            if not idemp_key:
                idemp_key = f"idemp_{payload.get('ReturnKey', 'RET')}_{int(time.time()*1000)}"

            # Check idempotency
            if idemp_key:
                existing = NbeSubmissionRecord.objects.filter(idempotency_key=idemp_key).first()
                if existing:
                    return 200, existing.response_payload

            # Check scenario mode
            mode = scenario.mode
            if headers:
                override = headers.get('X-Simulator-Force-Scenario') or headers.get('x-simulator-force-scenario') or headers.get('HTTP_X_SIMULATOR_FORCE_SCENARIO')
                if override:
                    mode = override

            if mode == 'VALIDATION_ERROR':
                err_resp = {
                    'success': False,
                    'status': 'REJECTED',
                    'statusCode': 422,
                    'error': 'NBE Validation Failure',
                    'message': scenario.failure_message or 'Cross-item balance check failed per BSD/03/2020 validation rules.',
                    'correlationId': corr_id
                }
                return 422, err_resp
            elif mode == 'AUTH_FAILURE':
                return 401, {
                    'success': False,
                    'statusCode': 401,
                    'error': 'mTLS Certificate Expired',
                    'correlationId': corr_id
                }
            elif mode == 'TIMEOUT':
                return 504, {
                    'success': False,
                    'statusCode': 504,
                    'error': 'NBE Gateway Timeout',
                    'correlationId': corr_id
                }
            elif mode == 'SERVER_ERROR':
                return 500, {
                    'success': False,
                    'statusCode': 500,
                    'error': 'NBE Core Ingestion Server Error',
                    'correlationId': corr_id
                }

            # SUCCESS mode
            sub_id = f"NBE-BSD-{int(time.time()*1000)}-{uuid.uuid4().hex[:6].upper()}"
            receipt_no = f"NBE-REC-{int(time.time()*1000)}-{uuid.uuid4().hex[:4].upper()}"
            resp_body = {
                'success': True,
                'status': 'ACCEPTED',
                'statusCode': 200,
                'submissionId': sub_id,
                'receiptNumber': receipt_no,
                'correlationId': corr_id,
                'receivedAt': timezone.now().isoformat(),
                'returnKey': payload.get('ReturnKey', ''),
                'institutionCode': payload.get('InstCode', '0000013'),
                'validationMessage': 'All validation checks passed successfully.'
            }
            try:
                NbeSubmissionRecord.objects.create(
                    submission_id=sub_id,
                    report_key=payload.get('ReturnKey', ''),
                    institution_code=payload.get('InstCode', '0000013'),
                    correlation_id=corr_id,
                    idempotency_key=idemp_key,
                    status='ACCEPTED',
                    payload=payload,
                    response_payload=resp_body
                )
            except Exception:
                pass
            return 200, resp_body

        return 404, {'error': f"Unknown path {clean_path}"}

    @classmethod
    def _log_gateway(cls, direction, status_code, correlation_id, idempotency_key, message):
        try:
            GatewayAuditLog.objects.create(
                direction=direction,
                endpoint='/api/v2/regulatory/gateway',
                status_code=status_code,
                correlation_id=correlation_id,
                idempotency_key=idempotency_key,
                message=message
            )
        except Exception:
            pass
