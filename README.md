# URL Shortener

A production-grade URL shortener built with NestJS and MongoDB.

## Stack

- **Framework:** NestJS (TypeScript)
- **Database:** MongoDB (Mongoose)
- **Runtime:** Node.js 20
- **Container:** Docker + Docker Compose

## Getting Started

**Prerequisites:** Docker, Node.js 20+, pnpm

```bash
# Clone the repo
git clone <repo-url>
cd url-shortener

# Set up environment
cp .env.example .env

# Run with Docker (app + MongoDB)
docker compose up --build

# Or run locally (requires MongoDB running)
pnpm install
pnpm start:dev
```

## API

### Shorten a URL
```http
POST /urls
Content-Type: application/json

{ "url": "https://www.example.com" }
```

```json
{
  "shortCode": "abc1234",
  "shortUrl": "http://localhost:3000/abc1234"
}
```

### Redirect
```http
GET /:code
→ 301 redirect to original URL
```

## Environment Variables

| Variable      | Description                        | Default                              |
|---------------|------------------------------------|--------------------------------------|
| `PORT`        | Port the app listens on            | `3000`                               |
| `MONGODB_URI` | MongoDB connection string          | `mongodb://localhost:27017/url-shortener` |
| `APP_URL`     | Base URL used to construct short URLs | `http://localhost:3000`           |

## Roadmap

- [ ] **Redis caching** — cache redirects to avoid DB hit on every request
- [ ] **Click analytics** — track total clicks, referrers, and countries per short URL
- [ ] **Custom slugs** — let users define their own short code (e.g. `/my-link`)
- [ ] **TTL / expiry** — auto-expire links after a set duration
- [ ] **Rate limiting** — protect the shorten endpoint from abuse
- [ ] **Duplicate detection** — return existing short code if URL was already shortened
- [ ] **QR code generation** — generate a QR code for any short URL
- [ ] **API key auth** — restrict access to authenticated users
- [ ] **Dashboard** — view and manage all your shortened URLs

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feat/your-feature`)
5. Open a Pull Request
