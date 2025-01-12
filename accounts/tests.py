from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from accounts.models import Profile
from products.models import Product

# Create your tests here.
class ProfileTestCase(TestCase):
    def setUp(self):
        self.testuser = get_user_model().objects.create_user(username='testuser')
        self.client.force_login(self.testuser)

    def test_profile_is_created(self):
        testprofile = Profile.objects.get(user=self.testuser)
        self.assertEqual(testprofile.user.username,"testuser")

    def test_profile_function_get_name(self):
        testprofile = Profile.objects.get(user=self.testuser)
        self.assertEqual(str(testprofile), 'testuser')

    def test_my_profile_function(self):
        url = reverse("accounts:my_profile")
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
