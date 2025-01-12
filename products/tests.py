# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.test import TestCase
from products.models import Product

# Create your tests here.
class ProductTestCase(TestCase):
    def setUp(self):
        Product.objects.create(name='book 1',price=10000)

    def test_product_is_created(self):
        product = Product.objects.get(name='book 1')
        self.assertEqual(product.name, 'book 1')