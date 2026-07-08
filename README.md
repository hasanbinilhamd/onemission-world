# ONEMISSION HQ

## URL Configuration

The HQ backend requires application-specific URLs so customer and staff flows always generate links for the correct surface.

### Required environment variables

```env
HQ_URL="http://localhost:3000"
COMMERCE_URL="http://localhost:5173"
```

These variables are validated during startup. If either value is missing or invalid, the server will fail fast with a clear error.

## URL Helpers

Use the shared URL helper instead of string concatenation:

```js
import { getCommerceUrl, getHQUrl, urls } from '@/lib/config/urls';

const customerResetLink = getCommerceUrl('/reset-password?token=example-token');
const hqLoginLink = getHQUrl('/login');

console.log(urls.commerce);
console.log(urls.hq);
```

### Output examples

- `getCommerceUrl('/login')` → `http://localhost:5173/login`
- `getHQUrl('/login')` → `http://localhost:3000/login`

## Production readiness

To move to production, update only the environment values:

```env
HQ_URL="https://hq.onemission.id"
COMMERCE_URL="https://onemission.id"
```

All generated customer links will use `COMMERCE_URL`, while HQ and staff links will use `HQ_URL`.
