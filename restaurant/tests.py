from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User


class AuthViewsTests(TestCase):
	def test_login_page_get(self):
		resp = self.client.get(reverse('login'))
		self.assertEqual(resp.status_code, 200)
		self.assertContains(resp, 'เข้าสู่ระบบ')

	def test_register_and_login_flow(self):
		# Register
		data = {
			'registerUsername': 'alice',
			'registerEmail': 'alice@example.com',
			'registerPhone': '0812345678',
			'registerPassword': 'secret123',
			'registerConfirmPassword': 'secret123',
			'loginRole': 'customer',
			'registerFirstName': 'Alice',
			'registerLastName': 'W',
		}
		resp = self.client.post(reverse('register'), data)
		# Should redirect to role page
		self.assertEqual(resp.status_code, 302)
		self.assertIn('/customer/', resp['Location'])
		# Session should be authenticated
		resp2 = self.client.get('/customer/')
		self.assertEqual(resp2.status_code, 200)

	def test_login_with_username(self):
		User.objects.create_user(username='bob', password='pass12345', email='bob@example.com')
		resp = self.client.post(reverse('login'), {
			'loginEmail': 'bob',
			'loginPassword': 'pass12345',
			'loginRole': 'staff',
		})
		# Redirect to staff (profile created on first login)
		self.assertEqual(resp.status_code, 302)
		self.assertIn('/staff/', resp['Location'])

	def test_login_invalid_credentials(self):
		resp = self.client.post(reverse('login'), {
			'loginEmail': 'nobody',
			'loginPassword': 'wrong',
		})
		self.assertEqual(resp.status_code, 200)
		self.assertContains(resp, 'ไม่ถูกต้อง', status_code=200)

	def test_demo_login_customer(self):
		resp = self.client.get(reverse('login_demo', args=['customer']))
		self.assertEqual(resp.status_code, 302)
		self.assertIn('/customer/', resp['Location'])
		# After redirect, user is authenticated
		resp2 = self.client.get('/customer/')
		self.assertEqual(resp2.status_code, 200)
