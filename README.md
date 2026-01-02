# Vagefisch

**Vagefisch** is an on-premises production weighing system that integrates Mettler Toledo industrial scales with OneBox CRM. Designed for manufacturing environments, it provides reliable offline-capable weighing operations, multi-scale support, label printing, and real-time monitoring — all managed through a web-based Admin Panel without requiring technical expertise.

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, components, data flow, and non-negotiables |
| [PROJECT_RULES.md](docs/PROJECT_RULES.md) | Development rules, Git workflow, and PR requirements |
| [ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md) | Checklist for accepting completed work |

---

## Key Features

- **Multi-Scale Support:** Connect and manage 1 to N Mettler Toledo scales (ICS/IND series)
- **Offline Operation:** Core weighing functions work without internet connectivity
- **Web Admin Panel:** Configure scales, printers, and settings through browser UI
- **Task Queue Management:** Per-scale queues with retry and re-routing capabilities
- **Label Printing:** Integrated network printer support with reprint functionality
- **Monitoring & Alerts:** Real-time status, metrics, and Telegram notifications

---

## Pull Request Process

All contributions must follow the process defined in [PROJECT_RULES.md](docs/PROJECT_RULES.md):

1. **One Task = One PR** — Each PR addresses a single task
2. **Required Sections** — Every PR must include: Description, Screenshots (for UI), How to Test
3. **Acceptance** — Work is accepted using [ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md)
4. **Review** — All PRs require Architect approval before merge

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer LAN                              │
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────┐ │
│  │   OneBox     │◄──►│    Vagefisch     │◄──►│  Scales   │ │
│  │   CRM VM     │    │   Connector VM   │    │  (1..N)   │ │
│  └──────────────┘    └──────────────────┘    └───────────┘ │
│                              │                              │
│                              ▼                              │
│                      ┌───────────┐                         │
│                      │ Printers  │                         │
│                      │  (1..N)   │                         │
│                      └───────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

For detailed architecture information, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## License

Proprietary. All rights reserved.
