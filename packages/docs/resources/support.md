# Support

## Getting Help

### GitHub Issues

The primary channel for bug reports and feature requests:

[**github.com/Martins-O/ArbiLink/issues**](https://github.com/Martins-O/ArbiLink/issues)

When opening an issue, please include:
- SDK version
- Node.js version
- Full error message and stack trace
- Minimal reproducible code snippet
- Chain IDs and network conditions

### GitHub Discussions

For questions, ideas, and general conversation:

[**github.com/Martins-O/ArbiLink/discussions**](https://github.com/Martins-O/ArbiLink/discussions)

---

## Contributing

ArbiLink is open source and welcomes contributions.

### Setup

```bash
git clone https://github.com/Martins-O/ArbiLink
cd ArbiLink
pnpm install
```

### Repository Structure

```
ArbiLink/
├── contracts/receiver/   # ArbiLinkReceiver (Solidity + Foundry)
├── message-hub/          # MessageHub (Rust / Stylus)
├── packages/
│   ├── sdk/              # @arbilink/sdk (TypeScript)
│   ├── demo/             # Demo frontend (React + Vite)
│   └── docs/             # This documentation (VitePress)
├── scripts/              # deploy.sh, verify.sh
└── .env.example
```

### Running Tests

```bash
# Solidity tests (Foundry)
cd contracts/receiver && forge test -vvv

# SDK type check
cd packages/sdk && pnpm type-check

# Demo build
cd packages/demo && pnpm build
```

### Submitting a PR

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with clear messages
4. Open a PR against `indev`

All PRs must:
- Pass existing tests
- Add tests for new functionality
- Follow the existing code style
- Include a clear description

---

## Reporting Security Issues

::: danger Security Vulnerabilities
**Do not open public GitHub issues for security vulnerabilities.**

Email security reports to: **security@arbilink.dev**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to respond within 48 hours and will credit responsible disclosures.
:::

---

## Built With

| Technology | Purpose |
|-----------|---------|
| [Arbitrum Stylus](https://docs.arbitrum.io/stylus/stylus-gentle-introduction) | Rust smart contracts |
| [Foundry](https://book.getfoundry.sh) | Solidity testing & deployment |
| [ethers v6](https://docs.ethers.org/v6/) | TypeScript SDK |
| [Vite + React](https://vitejs.dev) | Demo frontend |
| [VitePress](https://vitepress.dev) | This documentation |
| [wagmi v2](https://wagmi.sh) | React wallet hooks |

---

*ArbiLink — Built for Arbitrum Open House NYC · MIT License*
