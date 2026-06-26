'use strict';

const fs       = require('fs');
const path     = require('path');
const Order    = require('../models/Order');
const shopCtrl = require('../controllers/shopController');

const ordersFile = path.join(__dirname, '..', 'data', 'orders.json');
const backup     = path.join(__dirname, '..', 'data', 'orders.json.bak');

function mockRes() {
  const r = {};
  r.status   = jest.fn(() => r);
  r.send     = jest.fn(() => r);
  r.render   = jest.fn(() => r);
  r.redirect = jest.fn(() => r);
  return r;
}

beforeAll(() => { if (fs.existsSync(ordersFile)) fs.copyFileSync(ordersFile, backup); });
afterAll(() => { if (fs.existsSync(backup)) { fs.copyFileSync(backup, ordersFile); fs.unlinkSync(backup); } });
beforeEach(() => fs.writeFileSync(ordersFile, '[]'));
afterEach (() => fs.writeFileSync(ordersFile, '[]'));

describe('showShop', () => {
  test('renders shop with all products when no filters', () => {
    const req = { session: {}, query: {} };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    expect(res.render).toHaveBeenCalledWith('shop', expect.objectContaining({
      products:   expect.any(Array),
      categories: expect.any(Array),
      types:      expect.any(Array),
    }));
  });

  test('filters by category', () => {
    const req = { session: {}, query: { category: 'Apparel' } };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    const { products } = res.render.mock.calls[0][1];
    expect(products.every(p => p.category === 'Apparel')).toBe(true);
  });

  test('filters by type', () => {
    const req = { session: {}, query: { type: 'T-Shirt' } };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    const { products } = res.render.mock.calls[0][1];
    expect(products.every(p => p.type === 'T-Shirt')).toBe(true);
  });

  test('searches products by name', () => {
    const req = { session: {}, query: { q: 'backpack' } };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    const { products, searchQuery, noSearchResults } = res.render.mock.calls[0][1];
    expect(searchQuery).toBe('backpack');
    expect(noSearchResults).toBe(false);
    expect(products).toHaveLength(1);
    expect(products[0].name).toMatch(/backpack/i);
  });

  test('searches products by description', () => {
    const req = { session: {}, query: { q: 'wrinkle-free' } };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    const { products } = res.render.mock.calls[0][1];
    expect(products).toHaveLength(1);
    expect(products[0].desc).toMatch(/wrinkle-free/i);
  });

  test('marks empty search results', () => {
    const req = { session: {}, query: { q: 'not-a-real-product' } };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    const { products, noSearchResults } = res.render.mock.calls[0][1];
    expect(products).toHaveLength(0);
    expect(noSearchResults).toBe(true);
  });

  test('sorts by price ascending', () => {
    const req = { session: {}, query: { sort: 'price-asc' } };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    const prices = res.render.mock.calls[0][1].products.map(p => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('sorts by price descending', () => {
    const req = { session: {}, query: { sort: 'price-desc' } };
    const res = mockRes();
    shopCtrl.showShop(req, res);
    const prices = res.render.mock.calls[0][1].products.map(p => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });
});

describe('addToCart', () => {
  test('returns 404 for unknown product', () => {
    const req = { session: {}, body: { productId: 9999 }, headers: {} };
    const res = mockRes();
    shopCtrl.addToCart(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('adds product and redirects to referer', () => {
    const req = { session: {}, body: { productId: 1 }, headers: { referer: '/shop' } };
    const res = mockRes();
    shopCtrl.addToCart(req, res);
    expect(req.session.cart.items['1'].qty).toBe(1);
    expect(res.redirect).toHaveBeenCalledWith('/shop');
  });

  test('redirects to / when no referer', () => {
    const req = { session: {}, body: { productId: 1 }, headers: {} };
    const res = mockRes();
    shopCtrl.addToCart(req, res);
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});

describe('showCart', () => {
  test('renders cart with empty values', () => {
    const req = { session: {} };
    const res = mockRes();
    shopCtrl.showCart(req, res);
    expect(res.render).toHaveBeenCalledWith('cart', expect.objectContaining({
      lines: [], subtotal: 0, tax: 0, total: 0, cartCount: 0, empty: true,
    }));
  });

  test('shows correct data when cart has items', () => {
    const req = { session: { cart: { items: { '1': { product: { id:1, price:29.99 }, qty: 2 } } } } };
    const res = mockRes();
    shopCtrl.showCart(req, res);
    const args = res.render.mock.calls[0][1];
    expect(args.empty).toBe(false);
    expect(args.cartCount).toBe(2);
    expect(args.subtotal).toBeCloseTo(59.98, 2);
  });

  test('passes coupon variables to template when coupon is active', () => {
    const req = {
      session: {
        cart: {
          items: { '1': { product: { id:1, price:10.0 }, qty: 2 } },
          couponCode: 'SPRING20',
          discountPercent: 20
        }
      },
      query: { couponSuccess: '1' }
    };
    const res = mockRes();
    shopCtrl.showCart(req, res);
    const args = res.render.mock.calls[0][1];
    expect(args.couponCode).toBe('SPRING20');
    expect(args.discountPercent).toBe(20);
    expect(args.discountAmount).toBeCloseTo(4.00, 2);
    expect(args.discountedSubtotal).toBeCloseTo(16.00, 2);
    expect(args.couponMessage).toContain('applied successfully');
  });

  test('passes coupon error variable to template when coupon fails', () => {
    const req = {
      session: {
        cart: {
          items: { '1': { product: { id:1, price:10.0 }, qty: 2 } }
        }
      },
      query: { couponError: '1' }
    };
    const res = mockRes();
    shopCtrl.showCart(req, res);
    const args = res.render.mock.calls[0][1];
    expect(args.couponError).toBe('Invalid coupon code.');
  });
});

describe('updateCart / removeFromCart / clearCart', () => {
  test('updateCart changes qty and redirects', () => {
    const req = {
      session: { cart: { items: { '1': { product: { id:1, price:10 }, qty: 3 } } } },
      body: { productId: '1', qty: '1' },
    };
    shopCtrl.updateCart(req, mockRes());
    expect(req.session.cart.items['1'].qty).toBe(1);
  });

  test('removeFromCart deletes item', () => {
    const req = {
      session: { cart: { items: { '1': { product: { id:1, price:10 }, qty: 2 } } } },
      body: { productId: '1' },
    };
    shopCtrl.removeFromCart(req, mockRes());
    expect(req.session.cart.items['1']).toBeUndefined();
  });

  test('clearCart empties all items', () => {
    const req = {
      session: { cart: { items: { '1': { product: { id:1, price:10 }, qty: 2 } } } },
      body: {},
    };
    shopCtrl.clearCart(req, mockRes());
    expect(Object.keys(req.session.cart.items)).toHaveLength(0);
  });
});

describe('showCheckout', () => {
  test('redirects to /cart when cart is empty', () => {
    const res = mockRes();
    shopCtrl.showCheckout({ session: {} }, res);
    expect(res.redirect).toHaveBeenCalledWith('/cart');
  });

  test('pre-fills user data from session', () => {
    const req = {
      session: {
        user: { name: 'Alice', email: 'alice@x.com', address: '99 St' },
        cart: { items: { '1': { product: { id:1, price:10 }, qty: 1 } } },
      },
    };
    const res = mockRes();
    shopCtrl.showCheckout(req, res);
    expect(res.render).toHaveBeenCalledWith('checkout', expect.objectContaining({
      name: 'Alice', email: 'alice@x.com', address: '99 St',
    }));
  });

  test('passes coupon details to checkout template when coupon is active', () => {
    const req = {
      session: {
        user: { name: 'Alice', email: 'alice@x.com', address: '99 St' },
        cart: {
          items: { '1': { product: { id:1, price:10.0 }, qty: 2 } },
          couponCode: 'SPRING20',
          discountPercent: 20
        }
      }
    };
    const res = mockRes();
    shopCtrl.showCheckout(req, res);
    const args = res.render.mock.calls[0][1];
    expect(args.couponCode).toBe('SPRING20');
    expect(args.discountPercent).toBe(20);
    expect(args.discountAmount).toBeCloseTo(4.00, 2);
    expect(args.discountedSubtotal).toBeCloseTo(16.00, 2);
  });
});

describe('placeOrder', () => {
  test('redirects to /cart when cart is empty', () => {
    const res = mockRes();
    shopCtrl.placeOrder({ session: {}, body: {} }, res);
    expect(res.redirect).toHaveBeenCalledWith('/cart');
  });

  test('creates order, clears cart, renders success', () => {
    const req = {
      session: {
        user:    { id: 1, name: 'Bob', email: 'bob@x.com', address: '1 Main' },
        cart:    { items: { '1': { product: { id:1, price:10 }, qty: 1 } } },
      },
      body: { name: 'Bob', address: '1 Main' },
    };
    const res = mockRes();
    shopCtrl.placeOrder(req, res);
    expect(res.render).toHaveBeenCalledWith('order-complete', expect.objectContaining({
      order: expect.objectContaining({ id: expect.stringMatching(/^ORD-/) }),
      cartCount: 0,
    }));
    expect(Object.keys(req.session.cart.items)).toHaveLength(0);
    expect(Order.getAll()).toHaveLength(1);
  });
});

describe('showOrderHistory', () => {
  test('renders order-history with user orders', () => {
    const userId = 42;
    Order.add({ id: 'ORD-T', userId, email: 'x', items: [], total: 10, name: 'X', address: 'Y', placedAt: '' });
    const req = { session: { user: { id: userId } } };
    const res = mockRes();
    shopCtrl.showOrderHistory(req, res);
    expect(res.render).toHaveBeenCalledWith('order-history', expect.objectContaining({
      orders: expect.arrayContaining([expect.objectContaining({ id: 'ORD-T' })]),
    }));
  });
});

describe('applyCoupon', () => {
  test('applies valid coupon, saves to session, and redirects with success status', () => {
    const req = {
      session: { cart: { items: { '1': { product: { id:1, price:10.0 }, qty: 2 } } } },
      body: { couponCode: 'SPRING20' }
    };
    const res = mockRes();
    shopCtrl.applyCoupon(req, res);
    expect(req.session.cart.couponCode).toBe('SPRING20');
    expect(req.session.cart.discountPercent).toBe(20);
    expect(res.redirect).toHaveBeenCalledWith('/cart?couponSuccess=1');
  });

  test('rejects invalid coupon and redirects with error status', () => {
    const req = {
      session: { cart: { items: { '1': { product: { id:1, price:10.0 }, qty: 2 } } } },
      body: { couponCode: 'INVALID_CODE' }
    };
    const res = mockRes();
    shopCtrl.applyCoupon(req, res);
    expect(req.session.cart.couponCode).toBeNull();
    expect(req.session.cart.discountPercent).toBe(0);
    expect(res.redirect).toHaveBeenCalledWith('/cart?couponError=1');
  });
});
