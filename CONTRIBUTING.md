# Contributing to TripSplit

Thank you for your interest in contributing to **TripSplit**! We welcome community contributions to make group travel planning and expense splitting simpler and more transparent.

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or later
- **MongoDB**: Local MongoDB instance or free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/tripsplit.git
   cd tripsplit
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy `.env.example` to `.env.local` and populate the required secrets:
   ```bash
   cp .env.example .env.local
   ```
   Generate `AUTH_SECRET` using:
   ```bash
   openssl rand -hex 32
   ```

4. **Run the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Code Quality & Verification

Before submitting a Pull Request, ensure that your changes pass all TypeScript and build checks:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Production build verification
npm run build
```

---

## 📋 Pull Request Guidelines

1. **Branch Naming**:
   - Features: `feature/short-description` (e.g. `feature/currency-ticker`)
   - Bug Fixes: `fix/short-description` (e.g. `fix/expense-calc`)
   - Documentation: `docs/short-description`
2. **Commit Messages**: Follow standard conventional commits format:
   - `feat: add export trip expenses to PDF`
   - `fix: resolve iOS Safari safe area bottom padding`
   - `docs: update setup instructions in README`
3. **Changelog**: If your PR introduces new features, bug fixes, or breaking changes, please update the `[Unreleased]` section of `CHANGELOG.md`.

---

## 🛡️ Code of Conduct
Please be polite, constructive, and respectful in all interactions across issues and discussions.
