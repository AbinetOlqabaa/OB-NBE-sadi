import time
import random
import uuid
from datetime import datetime
from django.utils import timezone
from .models import SimulatorScenario, SimulatorSubmission, SimulatorRequestLog
from .validator import NbePayloadValidator, SUPPORTED_NBE_REPORTS

class SimulatorEngine:
    """
    Core intake processing engine of the NBE Central Bank Simulator Microservice.
    Enforces validation, deterministic scenarios, idempotency deduplication,
    cryptographic receipt generation, and exhaustive request/response audit trails.
    """

    @classmethod
    def process_intake(
        cls,
        payload: dict,
        headers: dict,
        query_params: dict | None = None
    ) -> tuple[int, dict, dict]:
        """
        Processes an incoming statutory return submission.
        Returns: (http_status_code, response_body, response_headers)
        """
        start_time = time.time()
        scenario_model = SimulatorScenario.get_current()
        query_params = query_params or {}

        # 1. Header parsing & normalization
        headers_dict = {str(k): str(v) for k, v in dict(headers).items()} if headers else {}

        idempotency_key = (
            headers_dict.get('Idempotency-Key')
            or headers_dict.get('idempotency-key')
            or headers_dict.get('X-Idempotency-Key')
            or headers_dict.get('x-idempotency-key')
            or ''
        ).strip()

        correlation_id = (
            headers_dict.get('X-Correlation-ID')
            or headers_dict.get('x-correlation-id')
            or f"corr_nbe_{int(time.time()*1000)}"
        ).strip()

        inst_code = (
            payload.get('InstCode')
            or payload.get('institutionCode')
            or headers_dict.get('X-Institution-Code')
            or headers_dict.get('x-institution-code')
            or '0000013'
        )

        return_key = (
            payload.get('ReturnKey')
            or payload.get('returnKey')
            or 'UNKNOWN_RETURN'
        )

        # 2. Deterministic scenario override detection
        # Enables deterministic end-to-end testing without state changes
        forced_scenario = (
            headers_dict.get('X-Simulator-Force-Scenario')
            or headers_dict.get('x-simulator-force-scenario')
            or query_params.get('scenario')
            or payload.get('forceScenario')
        )

        active_mode = forced_scenario if forced_scenario else scenario_model.mode

        # Latency injection
        latency_ms = scenario_model.latency_ms
        if query_params.get('latencyMs'):
            try:
                latency_ms = int(query_params['latencyMs'])
            except ValueError:
                pass

        if latency_ms > 0 and active_mode != 'TIMEOUT':
            # Cap artificial sleep to 200ms in automated test runner for speed
            sleep_duration = min(latency_ms / 1000.0, 0.2)
            time.sleep(sleep_duration)

        # Base central bank response headers
        resp_headers = {
            'Content-Type': 'application/json',
            'Server': 'NBE-BSD-Intake-Gateway/4.2.0 (Debian-Enterprise)',
            'X-NBE-Cluster': 'nbe-bsd-node-03',
            'X-Correlation-ID': correlation_id,
            'X-Idempotency-Key': idempotency_key,
            'X-Directives-Enforced': 'NBE BSD/03/2020, SBR/2026',
        }

        tls_info = {
            'protocol': 'TLSv1.3',
            'cipherSuite': 'TLS_AES_256_GCM_SHA384',
            'clientCertValidated': active_mode != 'AUTH_FAILURE',
            'clientIssuer': 'CN=National Bank of Ethiopia Root CA, O=Central Bank, C=ET',
            'subjectCN': f"Oromia Bank Sc (ID: {inst_code})",
        }

        # Handle Random Flaky Mode
        if active_mode == 'RANDOM_FLAKY':
            if random.random() < scenario_model.flaky_failure_rate:
                active_mode = 'SERVER_ERROR'
            else:
                active_mode = 'ALWAYS_SUCCESS'

        # 3. Execution of Scenario: AUTH_FAILURE (401)
        if active_mode == 'AUTH_FAILURE':
            duration_ms = int((time.time() - start_time) * 1000)
            err_body = {
                'success': False,
                'statusCode': 401,
                'error': 'Unauthorized',
                'message': (
                    scenario_model.failure_message
                    or 'NBE Central Gateway: Mutual TLS client certificate invalid, expired, or untrusted.'
                ),
                'correlationId': correlation_id,
                'institutionCode': inst_code,
                'timestamp': timezone.now().isoformat(),
            }
            cls._record_log(
                method='POST',
                path='/api/v1/nbe-simulator/submit',
                status_code=401,
                status_text='401 Unauthorized',
                return_key=return_key,
                institution_code=inst_code,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
                message=f"Simulated mTLS Authentication Failure for institution {inst_code}",
                duration_ms=duration_ms,
                request_headers=headers_dict,
                request_body=payload,
                response_headers=resp_headers,
                response_body=err_body,
                tls_info=tls_info
            )
            return 401, err_body, resp_headers

        # 4. Execution of Scenario: TIMEOUT (504)
        if active_mode == 'TIMEOUT':
            duration_ms = int((time.time() - start_time) * 1000)
            err_body = {
                'success': False,
                'statusCode': 504,
                'error': 'Gateway Timeout',
                'message': (
                    scenario_model.failure_message
                    or 'NBE Gateway Timeout: Central Bank statutory ledger did not acknowledge ingestion within deadline (30000ms).'
                ),
                'correlationId': correlation_id,
                'institutionCode': inst_code,
                'timestamp': timezone.now().isoformat(),
            }
            cls._record_log(
                method='POST',
                path='/api/v1/nbe-simulator/submit',
                status_code=504,
                status_text='504 Gateway Timeout',
                return_key=return_key,
                institution_code=inst_code,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
                message=f"Simulated Gateway Timeout for statutory return {return_key}",
                duration_ms=duration_ms,
                request_headers=headers_dict,
                request_body=payload,
                response_headers=resp_headers,
                response_body=err_body,
                tls_info=tls_info
            )
            return 504, err_body, resp_headers

        # 5. Execution of Scenario: SERVER_ERROR (500)
        if active_mode == 'SERVER_ERROR':
            duration_ms = int((time.time() - start_time) * 1000)
            err_body = {
                'success': False,
                'statusCode': 500,
                'error': 'Internal Server Error',
                'message': (
                    scenario_model.failure_message
                    or 'NBE BSD Core Gateway 500: Database lock deadlock or statutory repository cluster failure.'
                ),
                'correlationId': correlation_id,
                'institutionCode': inst_code,
                'timestamp': timezone.now().isoformat(),
            }
            cls._record_log(
                method='POST',
                path='/api/v1/nbe-simulator/submit',
                status_code=500,
                status_text='500 Internal Server Error',
                return_key=return_key,
                institution_code=inst_code,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
                message=f"Simulated NBE BSD Core 500 internal error for {return_key}",
                duration_ms=duration_ms,
                request_headers=headers_dict,
                request_body=payload,
                response_headers=resp_headers,
                response_body=err_body,
                tls_info=tls_info
            )
            return 500, err_body, resp_headers

        # 6. Idempotency Deduplication Check
        if idempotency_key:
            existing = SimulatorSubmission.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                duration_ms = int((time.time() - start_time) * 1000)
                replayed_body = {
                    'success': True,
                    'statusCode': 200,
                    'status': 'SUCCESS_IDEMPOTENT_DUPLICATE',
                    'submissionId': existing.receipt_number,
                    'receiptNumber': existing.receipt_number,
                    'correlationId': correlation_id,
                    'message': f"[Idempotent Replay] Statutory return was previously received and acknowledged under receipt {existing.receipt_number}.",
                    'timestamp': existing.received_at.isoformat(),
                    'institutionCode': existing.institution_code,
                    'isIdempotentReplay': True,
                }
                cls._record_log(
                    method='POST',
                    path='/api/v1/nbe-simulator/submit',
                    status_code=200,
                    status_text='200 OK (Idempotent Duplicate)',
                    return_key=return_key,
                    institution_code=inst_code,
                    idempotency_key=idempotency_key,
                    correlation_id=correlation_id,
                    message=f"Idempotent replay: return {return_key} already recorded as receipt {existing.receipt_number}",
                    duration_ms=duration_ms,
                    request_headers=headers_dict,
                    request_body=payload,
                    response_headers=resp_headers,
                    response_body=replayed_body,
                    tls_info=tls_info
                )
                return 200, replayed_body, resp_headers

        # 7. Payload Validation (supporting 24 NBE report definitions)
        is_valid, validation_errors = NbePayloadValidator.validate(payload)

        # Force validation error scenario simulation
        if active_mode in ('VALIDATION_ERROR', 'VALIDATION_FAILURE'):
            if is_valid:
                validation_errors = [
                    f"Simulated NBE Cross-Schedule Discrepancy: Return {return_key} variance detected against Prudential Directive BSD/03/2020 capital limits."
                ]
            is_valid = False

        if not is_valid:
            duration_ms = int((time.time() - start_time) * 1000)
            err_body = {
                'success': False,
                'statusCode': 422,
                'error': 'Unprocessable Entity',
                'message': 'Statutory return rejected: schema or regulatory validation checks failed.',
                'validationErrors': validation_errors,
                'correlationId': correlation_id,
                'institutionCode': inst_code,
                'reportKey': return_key,
                'timestamp': timezone.now().isoformat(),
            }
            cls._record_log(
                method='POST',
                path='/api/v1/nbe-simulator/submit',
                status_code=422,
                status_text='422 Unprocessable Entity',
                return_key=return_key,
                institution_code=inst_code,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
                message=f"Statutory return {return_key} validation rejected: {'; '.join(validation_errors)}",
                duration_ms=duration_ms,
                request_headers=headers_dict,
                request_body=payload,
                response_headers=resp_headers,
                response_body=err_body,
                tls_info=tls_info
            )
            return 422, err_body, resp_headers

        # 8. Success Reception & Official Receipt Generation
        date_str = datetime.now().strftime('%Y%m%d')
        hex_suffix = uuid.uuid4().hex[:6].upper()
        receipt_number = f"NBE-REC-{date_str}-{hex_suffix}"

        fin_year = payload.get('FinYear') or payload.get('finYear') or 2026
        try:
            fin_year = int(fin_year)
        except (ValueError, TypeError):
            fin_year = 2026

        period_start = str(payload.get('StartDate') or payload.get('startDate') or '')
        period_end = str(payload.get('EndDate') or payload.get('endDate') or '')

        success_body = {
            'success': True,
            'statusCode': 200,
            'status': 'ACCEPTED',
            'submissionId': receipt_number,
            'receiptNumber': receipt_number,
            'correlationId': correlation_id,
            'reportKey': return_key,
            'institutionCode': inst_code,
            'message': f"Statutory return {return_key} officially received and verified by National Bank of Ethiopia BSD Gateway.",
            'timestamp': timezone.now().isoformat(),
            'directivesVerified': ['BSD/03/2020', 'SBR/2026'],
        }

        # Persist submission in simulator database
        SimulatorSubmission.objects.create(
            receipt_number=receipt_number,
            report_key=return_key,
            institution_code=inst_code,
            fin_year=fin_year,
            period_start=period_start,
            period_end=period_end,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            status='ACCEPTED',
            payload=payload,
            headers=headers_dict,
            response_payload=success_body,
            received_at=timezone.now()
        )

        duration_ms = int((time.time() - start_time) * 1000)
        cls._record_log(
            method='POST',
            path='/api/v1/nbe-simulator/submit',
            status_code=200,
            status_text='200 OK',
            return_key=return_key,
            institution_code=inst_code,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            message=f"Return {return_key} accepted into central repository. Issued receipt {receipt_number}",
            duration_ms=duration_ms,
            request_headers=headers_dict,
            request_body=payload,
            response_headers=resp_headers,
            response_body=success_body,
            tls_info=tls_info
        )

        return 200, success_body, resp_headers

    @classmethod
    def _record_log(
        cls,
        method: str,
        path: str,
        status_code: int,
        status_text: str,
        return_key: str,
        institution_code: str,
        idempotency_key: str,
        correlation_id: str,
        message: str,
        duration_ms: int,
        request_headers: dict,
        request_body: dict,
        response_headers: dict,
        response_body: dict,
        tls_info: dict
    ):
        try:
            SimulatorRequestLog.objects.create(
                method=method,
                path=path,
                status_code=status_code,
                status_text=status_text,
                return_key=return_key,
                institution_code=institution_code,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
                message=message,
                duration_ms=duration_ms,
                request_headers=request_headers,
                request_body=request_body,
                response_headers=response_headers,
                response_body=response_body,
                tls_info=tls_info,
                timestamp=timezone.now()
            )
        except Exception as e:
            # Fallback in case of logging persistence issue
            pass
