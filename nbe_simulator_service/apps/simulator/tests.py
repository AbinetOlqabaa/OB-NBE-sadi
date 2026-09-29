from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from .models import SimulatorScenario, SimulatorSubmission, SimulatorRequestLog
from .validator import SUPPORTED_NBE_REPORTS

class NbeSimulatorMicroserviceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.scenario = SimulatorScenario.objects.create(
            mode='ALWAYS_SUCCESS',
            latency_ms=0,
            flaky_failure_rate=0.30
        )
        self.valid_payload = {
            'ReturnKey': 'POBEPE001',
            'InstCode': '0000013',
            'FinYear': 2026,
            'StartDate': '2026-01-01',
            'EndDate': '2026-01-31',
            'ReturnItemsList': [
                {'Code': 'R01_C01', 'Value': 15000000},
                {'Code': 'R02_C01', 'Value': 28000000},
            ],
            'DynamicItemsList': [],
        }

    def test_health_check_endpoint(self):
        resp = self.client.get('/api/v1/nbe-simulator/gateway-health')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data['status'], 'ONLINE')
        self.assertTrue(data['healthy'])
        self.assertEqual(data['institutionCode'], '0000013')
        self.assertIn('BSD/03/2020', data['directives'])
        self.assertEqual(data['supportedReportsCount'], 24)

    def test_always_success_submission_and_receipt(self):
        headers = {
            'HTTP_IDEMPOTENCY_KEY': 'idemp_test_success_001',
            'HTTP_X_CORRELATION_ID': 'corr_test_001',
        }
        resp = self.client.post(
            '/api/v1/nbe-simulator/submit',
            self.valid_payload,
            format='json',
            **headers
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['status'], 'ACCEPTED')
        self.assertTrue(data['receiptNumber'].startswith('NBE-REC-'))
        self.assertEqual(data['reportKey'], 'POBEPE001')

        # Verify recorded in simulator database
        sub = SimulatorSubmission.objects.filter(idempotency_key='idemp_test_success_001').first()
        self.assertIsNotNone(sub)
        self.assertEqual(sub.report_key, 'POBEPE001')
        self.assertEqual(sub.receipt_number, data['receiptNumber'])

        # Verify request log recorded
        log_entry = SimulatorRequestLog.objects.filter(idempotency_key='idemp_test_success_001').first()
        self.assertIsNotNone(log_entry)
        self.assertEqual(log_entry.status_code, 200)

    def test_idempotency_deduplication(self):
        headers = {
            'HTTP_IDEMPOTENCY_KEY': 'idemp_test_dedup_002',
            'HTTP_X_CORRELATION_ID': 'corr_test_002',
        }
        # First delivery
        resp1 = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json', **headers)
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        receipt1 = resp1.json()['receiptNumber']

        # Duplicate delivery with same idempotency key
        resp2 = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json', **headers)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        receipt2 = resp2.json()['receiptNumber']

        self.assertEqual(receipt1, receipt2)
        # Should NOT create duplicate submissions in DB
        count = SimulatorSubmission.objects.filter(idempotency_key='idemp_test_dedup_002').count()
        self.assertEqual(count, 1)

    def test_validation_error_invalid_institution_code(self):
        invalid_payload = dict(self.valid_payload)
        invalid_payload['InstCode'] = '9999999'

        resp = self.client.post('/api/v1/nbe-simulator/submit', invalid_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        data = resp.json()
        self.assertFalse(data['success'])
        self.assertTrue(any('0000013' in err for err in data['validationErrors']))

    def test_validation_error_unknown_return_key(self):
        invalid_payload = dict(self.valid_payload)
        invalid_payload['ReturnKey'] = 'NON_EXISTENT_RETURN'

        resp = self.client.post('/api/v1/nbe-simulator/submit', invalid_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        data = resp.json()
        self.assertFalse(data['success'])
        self.assertTrue(any('NON_EXISTENT_RETURN' in err for err in data['validationErrors']))

    def test_auth_failure_scenario(self):
        self.scenario.mode = 'AUTH_FAILURE'
        self.scenario.save()

        resp = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        data = resp.json()
        self.assertFalse(data['success'])
        self.assertIn('Mutual TLS', data['message'])

    def test_timeout_scenario(self):
        self.scenario.mode = 'TIMEOUT'
        self.scenario.save()

        resp = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        data = resp.json()
        self.assertFalse(data['success'])
        self.assertIn('Timeout', data['message'])

    def test_server_error_scenario(self):
        self.scenario.mode = 'SERVER_ERROR'
        self.scenario.save()

        resp = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        data = resp.json()
        self.assertFalse(data['success'])

    def test_deterministic_force_scenario_headers(self):
        # Force VALIDATION_ERROR via header while active scenario is ALWAYS_SUCCESS
        headers = {'HTTP_X_SIMULATOR_FORCE_SCENARIO': 'VALIDATION_ERROR'}
        resp = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json', **headers)
        self.assertEqual(resp.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Force TIMEOUT via header
        headers = {'HTTP_X_SIMULATOR_FORCE_SCENARIO': 'TIMEOUT'}
        resp = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json', **headers)
        self.assertEqual(resp.status_code, status.HTTP_504_GATEWAY_TIMEOUT)

        # Force SERVER_ERROR via header
        headers = {'HTTP_X_SIMULATOR_FORCE_SCENARIO': 'SERVER_ERROR'}
        resp = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json', **headers)
        self.assertEqual(resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Force AUTH_FAILURE via header
        headers = {'HTTP_X_SIMULATOR_FORCE_SCENARIO': 'AUTH_FAILURE'}
        resp = self.client.post('/api/v1/nbe-simulator/submit', self.valid_payload, format='json', **headers)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_all_24_nbe_reports_catalog_and_validation(self):
        resp = self.client.get('/api/v1/nbe-simulator/report-definitions')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data['count'], 24)

        # Submit each of the 24 statutory returns to ensure simulator accepts all 24
        for report_key in SUPPORTED_NBE_REPORTS.keys():
            payload = dict(self.valid_payload)
            payload['ReturnKey'] = report_key
            headers = {
                'HTTP_IDEMPOTENCY_KEY': f"idemp_test_report_{report_key}",
                'HTTP_X_SIMULATOR_FORCE_SCENARIO': 'ALWAYS_SUCCESS',
            }
            res = self.client.post('/api/v1/nbe-simulator/submit', payload, format='json', **headers)
            self.assertEqual(res.status_code, status.HTTP_200_OK, f"Failed for return {report_key}")
            self.assertEqual(res.json()['reportKey'], report_key)

    def test_scenario_update_and_persistence(self):
        post_data = {
            'mode': 'VALIDATION_ERROR',
            'latencyMs': 50,
            'failureMessage': 'Custom validation failure message',
        }
        resp = self.client.post('/api/v1/nbe-simulator/scenario', post_data, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data['mode'], 'VALIDATION_ERROR')
        self.assertEqual(data['latencyMs'], 50)
        self.assertEqual(data['failureMessage'], 'Custom validation failure message')

        # Verify GET returns updated scenario
        get_resp = self.client.get('/api/v1/nbe-simulator/scenario')
        self.assertEqual(get_resp.json()['mode'], 'VALIDATION_ERROR')
