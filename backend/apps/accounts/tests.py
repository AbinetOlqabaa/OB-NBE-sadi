from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import UserAccount, BiometricCredential, OtpVerification
from django.utils import timezone
from datetime import timedelta

class AccountsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.maker = UserAccount.objects.create_user(
            id='test_mkr',
            name='Test Maker',
            email='maker@test.com',
            password='password123',
            role='MAKER',
            status='ACTIVE',
            department='Credit Operations & Portfolio Management',
            employee_id='OB-TEST-001'
        )
        self.pending_user = UserAccount.objects.create_user(
            id='test_pending',
            name='Pending User',
            email='pending@test.com',
            password='password123',
            role='MAKER',
            status='PENDING_APPROVAL',
            department='Credit Operations & Portfolio Management',
            employee_id='OB-TEST-002'
        )

    def test_login_success(self):
        response = self.client.post('/api/auth/login', {'email': 'maker@test.com', 'password': 'password123'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['user']['email'], 'maker@test.com')

    def test_login_invalid_credentials(self):
        response = self.client.post('/api/auth/login', {'email': 'maker@test.com', 'password': 'wrongpassword'})
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data['success'])

    def test_login_pending_user_rejected(self):
        response = self.client.post('/api/auth/login', {'email': 'pending@test.com', 'password': 'password123'})
        self.assertEqual(response.status_code, 401)
        self.assertIn('pending', response.data['message'].lower())

    def test_otp_flow(self):
        # 1. Send OTP
        send_resp = self.client.post('/api/auth/otp/send', {'email': 'test_otp@test.com', 'purpose': 'REGISTRATION'})
        self.assertEqual(send_resp.status_code, 200)
        code = send_resp.data['debugCode']

        # 2. Verify with wrong code
        fail_resp = self.client.post('/api/auth/otp/verify', {'email': 'test_otp@test.com', 'code': '000000', 'purpose': 'REGISTRATION'})
        self.assertEqual(fail_resp.status_code, 400)

        # 3. Verify with valid code
        ok_resp = self.client.post('/api/auth/otp/verify', {'email': 'test_otp@test.com', 'code': code, 'purpose': 'REGISTRATION'})
        self.assertEqual(ok_resp.status_code, 200)
        self.assertTrue(ok_resp.data['success'])

    def test_biometrics_enrollment_and_verification(self):
        # 1. Enroll fingerprint
        reg_resp = self.client.post('/api/auth/biometrics/register', {
            'email': 'maker@test.com',
            'credential': {
                'type': 'FINGERPRINT',
                'credentialId': 'sensor_touch_id_999',
                'deviceLabel': 'MacBook TouchID'
            }
        }, format='json')
        self.assertEqual(reg_resp.status_code, 200)
        self.assertTrue(reg_resp.data['success'])

        # 2. Verify fingerprint
        verify_resp = self.client.post('/api/auth/biometrics/verify', {
            'email': 'maker@test.com',
            'type': 'FINGERPRINT',
            'credentialId': 'sensor_touch_id_999'
        }, format='json')
        self.assertEqual(verify_resp.status_code, 200)
        self.assertTrue(verify_resp.data['success'])
