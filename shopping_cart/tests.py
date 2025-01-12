from django.test import TestCase
from django.urls import reverse
from products.models import Product
from django.contrib.auth import get_user_model
from shopping_cart.models import Order, OrderItem, Transaction
from accounts.models import Profile

from django.contrib.messages import get_messages
from shopping_cart.extras import generate_order_id
# Create your tests here.

class ShoppingCartTestCase(TestCase):
    def setUp(self):
        self.producttest = Product.objects.create(name='book 1',price=10000)
        self.testuser = get_user_model().objects.create_user(username='testuser',password='123')
        self.profile = Profile.objects.get(user=self.testuser)
        self.testorderitem = OrderItem.objects.create(product=self.producttest)
        self.user_order= Order.objects.create(owner=self.profile, is_ordered=False)
        self.ref_code = generate_order_id()
        self.user_order.ref_code=self.ref_code
        self.testtrans = Transaction.objects.create(profile= self.profile,order_id = self.user_order.id,
                                                    amount=1)
        self.client.force_login(self.testuser)

    def test_order_item_model_is_created(self):
        self.assertEqual(self.testorderitem.product.name,'book 1')

    def test_order_item_model_str(self):
        self.assertEqual(str(self.testorderitem),'book 1')

    def test_order_model_is_created(self):
        self.assertEqual(self.user_order.owner.user,self.testuser)

    def test_order_model_get_cart_items(self):
        self.assertEqual(self.user_order.get_cart_items().count(),0)

    def test_order_model_get_cart_total(self):
        self.assertEqual(self.user_order.get_cart_total(),0)

    def test_order_model_str(self):
        self.assertEqual(str(self.user_order),'{0} - {1}'.format(self.profile, self.ref_code))

    def test_transaction_model_str(self):
        self.assertEqual(str(self.testtrans), str(self.user_order.id))

    def test_add_to_cart(self):
        url = reverse("shopping_cart:add_to_cart", args=[self.producttest.id])
        response = self.client.get(url)
        messages = [msg.message for msg in get_messages(response.wsgi_request)]

        self.assertIn('item added to cart',messages)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.user_order.items.count(), 1)

    def test_add_to_cart_never_ordered(self):
        url = reverse("shopping_cart:add_to_cart", args=[self.producttest.id])
        self.user_order.delete()
        
        response = self.client.get(url)
        messages = [msg.message for msg in get_messages(response.wsgi_request)]

        self.assertIn('item added to cart',messages)
        self.assertEqual(response.status_code, 302)

    def test_add_to_cart_owned(self):
        url = reverse("shopping_cart:add_to_cart", args=[self.producttest.id])
        self.profile.ebooks.add(self.producttest)
        response = self.client.get(url)

        messages = [msg.message for msg in get_messages(response.wsgi_request)]
        self.assertEqual(response.status_code, 302)
        self.assertIn('You already own this ebook',messages)
        self.assertEqual(self.user_order.items.count(), 0)

    def test_delete_from_cart(self):
        url = reverse("shopping_cart:delete_item", args=[self.producttest.id])
        
        response = self.client.get(url)
        messages = [msg.message for msg in get_messages(response.wsgi_request)]
        self.assertEqual(response.status_code, 302)
        self.assertIn('Item has been deleted',messages)

    def test_order_details(self):
        url = reverse("shopping_cart:order_summary")

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_checkout(self):
        url = reverse("shopping_cart:checkout")

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_success(self):
        url = reverse("shopping_cart:purchase_success")

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_update_transaction_record(self):
        url = reverse("shopping_cart:update_records")

        response = self.client.get(url)
        messages = [msg.message for msg in get_messages(response.wsgi_request)]
        self.assertEqual(response.status_code, 302)
        self.assertIn('Thank you! Your purchase was successful!',messages)

    def test_get_user_pending_order_no_order(self):
        url = reverse("shopping_cart:order_summary")
        self.user_order.delete()
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)