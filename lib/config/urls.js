function normalizeRequiredUrl(name) {
  const value = String(process.env[name] || '').trim();

  if (!value) {
    throw new Error(`${name} is required. Set ${name} in the environment configuration.`);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL. Received: ${value}`);
  }

  return parsedUrl.toString().replace(/\/$/, '');
}

function buildUrl(baseUrl, path = '/') {
  const normalizedPath = String(path || '/').trim() || '/';
  return new URL(normalizedPath, `${baseUrl}/`).toString();
}

export const urls = {
  hq: normalizeRequiredUrl('HQ_URL'),
  commerce: normalizeRequiredUrl('COMMERCE_URL'),
};

export function getHQUrl(path = '/') {
  return buildUrl(urls.hq, path);
}

export function getCommerceUrl(path = '/') {
  return buildUrl(urls.commerce, path);
}
