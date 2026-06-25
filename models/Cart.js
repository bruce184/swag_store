'use strict';

class Cart {
  constructor(sessionCart = {}) {
    this.items = sessionCart.items || {};
    this.couponCode = sessionCart.couponCode || null;
    this.discountPercent = sessionCart.discountPercent || 0;
  }

  add(product, qty = 1) {
    const id = String(product.id);
    if (this.items[id]) {
      this.items[id].qty += qty;
    } else {
      this.items[id] = { product, qty };
    }
  }

  remove(productId) {
    delete this.items[String(productId)];
  }

  updateQty(productId, qty) {
    const id = String(productId);
    if (qty <= 0) {
      this.remove(productId);
    } else if (this.items[id]) {
      this.items[id].qty = qty;
    }
  }

  clear() {
    this.items = {};
    this.couponCode = null;
    this.discountPercent = 0;
  }

  applyCoupon(code) {
    const validCoupons = {
      'WINTER10': 10,
      'SPRING20': 20,
      'SUMMER30': 30
    };
    if (!code) {
      this.couponCode = null;
      this.discountPercent = 0;
      return false;
    }
    const upperCode = String(code).toUpperCase().trim();
    if (validCoupons[upperCode]) {
      this.couponCode = upperCode;
      this.discountPercent = validCoupons[upperCode];
      return true;
    }
    this.couponCode = null;
    this.discountPercent = 0;
    return false;
  }

  get discountAmount() {
    return +(this.subtotal * (this.discountPercent / 100)).toFixed(2);
  }

  get discountedSubtotal() {
    return +(this.subtotal - this.discountAmount).toFixed(2);
  }

  get lines() {
    return Object.values(this.items).map(({ product, qty }) => ({
      product,
      qty,
      subtotal: +(product.price * qty).toFixed(2),
    }));
  }

  get count() {
    return Object.values(this.items).reduce((s, i) => s + i.qty, 0);
  }

  get subtotal() {
    return +this.lines.reduce((s, l) => s + l.subtotal, 0).toFixed(2);
  }

  get tax() {
    return +(this.discountedSubtotal * 0.08).toFixed(2);
  }

  get total() {
    return +(this.discountedSubtotal + this.tax).toFixed(2);
  }

  toJSON() {
    return {
      items: this.items,
      couponCode: this.couponCode,
      discountPercent: this.discountPercent
    };
  }
}

module.exports = Cart;
