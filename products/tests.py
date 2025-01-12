# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from django.urls import reverse
from django.test import TestCase
from products.models import Product
from django.contrib.auth import get_user_model
from shopping_cart.models import Order
from accounts.models import Profile

# Create your tests here.
class ProductTestCase(TestCase):
    def setUp(self):
        self.producttest = Product.objects.create(name='book 1',price=10000)
        self.testuser = get_user_model().objects.create_user(username='testuser')
        self.profile = Profile.objects.get(user=self.testuser)
        self.user_order= Order.objects.get_or_create(owner=self.profile, is_ordered=False)

    def test_product_is_created(self):
        product = Product.objects.get(name='book 1')
        self.assertEqual(product.name, 'book 1')

    def test_function_get_name(self):
        name = Product.objects.get(name='book 1')
        self.assertEqual(str(name), 'book 1')

    def test_product_list_function_after_log_in(self):
        self.client.force_login(self.testuser)
        url = reverse("products:product-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

    def test_product_list_function_when_log_out(self):
        url = reverse("products:product-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, 302)
