from django.test import TestCase
from rest_framework.test import APIClient
from apps.nbe_gateway.models import GatewayScenario, NbeSubmissionRecord

class NbeGatewayTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.scenario = GatewayScenario.get_current()
        self.scenario.mode = 'SUCCESS'
        self.scenario.save()

    def test_nbe_gateway_success_and_idempotency(self):
        headers = {
            'HTTP_IDEMPOTENCY_KEY': 'idemp_test_key_001',
            'HTTP_X_CORRELATION_ID': 'corr_test_001'
        }
        payload = {
            'ReturnKey': 'LOA_ADV_OUT_LA001',
            'InstCode': '0000013',
            'Values': {'100_00001': '500000'}
        }

        # 1. First submission
        resp1 = self.client.post('/api/nbe-simulator/submit', payload, format='json', **headers)
        self.assertEqual(resp1.status_code, 200)
        self.assertTrue(resp1.data['success'])
        submission_id = resp1.data['submissionId']

        # 2. Duplicate submission with same Idempotency-Key
        resp2 = self.client.post('/api/nbe-simulator/submit', payload, format='json', **headers)
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data['submissionId'], submission_id)

    def test_nbe_gateway_scenario_validation_error(self):
        self.scenario.mode = 'VALIDATION_ERROR'
        self.scenario.save()

        payload = {'ReturnKey': 'M_LCPLC001'}
        resp = self.client.post('/api/nbe-simulator/submit', payload, format='json')
        self.assertEqual(resp.status_code, 422)
        self.assertFalse(resp.data['success'])
