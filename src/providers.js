const { parse } = require('node-html-parser');

const { errorStockCheckResult, outOfStockCheckResult, inStockCheckResult } = require('./utils');

const parseRetailProduct = (html, selectors, providerName) => {
  const root = parse(html);
  const structuredData = root.querySelectorAll('script[type="application/ld+json"]');

  for (const script of structuredData) {
    try {
      const data = JSON.parse(script.textContent);
      const offers = Array.isArray(data) ? data.flatMap((item) => item.offers || []) : data.offers;
      const availability = (Array.isArray(offers) ? offers : [offers])
        .map((offer) => offer && offer.availability)
        .find((value) => value !== undefined);

      if (availability !== undefined) {
        return /InStock|LimitedAvailability|PreOrder/i.test(availability)
          ? inStockCheckResult()
          : outOfStockCheckResult();
      }
    } catch (e) {
      // Ignore malformed JSON-LD and continue with the page selectors.
    }
  }

  const available = selectors.available.flatMap((selector) => root.querySelectorAll(selector));
  if (available.length > 0) {
    return inStockCheckResult();
  }

  const unavailable = selectors.unavailable.flatMap((selector) => root.querySelectorAll(selector));
  if (unavailable.length > 0) {
    return outOfStockCheckResult();
  }

  return errorStockCheckResult(`Could not determine stock status for ${providerName}`);
};

const parseAmazonProduct = (html) => {
  const root = parse(html);
  const availability = root.querySelector('#availability');
  const availabilityText = availability ? availability.textContent : '';
  const purchaseButton = root.querySelector('#buy-now-button');
  const isPreorder = /pre-order|preorder/i.test(availabilityText);
  const hasEnabledPurchaseButton =
    purchaseButton && purchaseButton.getAttribute('disabled') === undefined;

  if (/currently unavailable|not available|unavailable/i.test(availabilityText)) {
    return outOfStockCheckResult();
  }
  if (isPreorder && hasEnabledPurchaseButton) {
    return inStockCheckResult();
  }

  const addToCart = root.querySelector('#add-to-cart-button');
  return addToCart && addToCart.getAttribute('disabled') === undefined
    ? inStockCheckResult()
    : errorStockCheckResult('Amazon purchase button missing');
};

const parseTargetProduct = (html) => {
  const root = parse(html);
  if (
    root.querySelectorAll(
      '[class*="notActiveAndUnavailableFulfillmentCell"], [data-test="soldOut"], [data-test="outOfStock"]'
    ).length > 0
  ) {
    return outOfStockCheckResult();
  }
  if (
    root.querySelectorAll(
      'button[data-test="shippingButton"]:not([disabled]), button[data-test="addToCartButton"]:not([disabled])'
    ).length > 0
  ) {
    return inStockCheckResult();
  }
  return errorStockCheckResult('Could not determine stock status for Target');
};

const parseBestBuyProduct = (html) => {
  if (/["']buttonState["']\s*:\s*["'](?:SOLD_OUT|COMING_SOON|UNAVAILABLE)["']/i.test(html)) {
    return outOfStockCheckResult();
  }
  if (/["']buttonState["']\s*:\s*["'](?:ADD_TO_CART|PREORDER|PRE_ORDER)["']/i.test(html)) {
    return inStockCheckResult();
  }
  return errorStockCheckResult('Could not determine stock status for Best Buy');
};

const parseNintendoProduct = (html) => {
  if (/schema\.org\/(?:OutOfStock|SoldOut)/i.test(html)) {
    return outOfStockCheckResult();
  }
  if (/schema\.org\/(?:InStock|LimitedAvailability|PreOrder)/i.test(html)) {
    return inStockCheckResult();
  }
  return errorStockCheckResult('Could not determine stock status for Nintendo Store');
};

const PROVIDERS = {
  AMAZON: {
    name: 'Amazon',
    baseUrl: 'https://www.amazon.com/',
    parse: parseAmazonProduct,
  },
  TARGET: {
    name: 'Target',
    baseUrl: 'https://www.target.com/',
    parse: parseTargetProduct,
  },
  BEST_BUY: {
    name: 'Best Buy',
    baseUrl: 'https://www.bestbuy.com/',
    parse: parseBestBuyProduct,
  },
  NINTENDO_STORE: {
    name: 'Nintendo Store',
    baseUrl: 'https://www.nintendo.com/',
    parse: parseNintendoProduct,
  },
};

const getProductUrl = (product) =>
  PROVIDERS[product.provider].baseUrl.replace(/\/+$/, '') + '/' + product.url.replace(/^\/+/, '');

exports.PROVIDERS = PROVIDERS;
exports.getProductUrl = getProductUrl;
