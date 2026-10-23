# Security policy

The dashboard is an **unauthenticated localhost demonstration**. Only simulation mode is recommended for public use. Do not expose port 8765 on the Internet. The optional MQTT adapter should only connect to an authorized test broker and must not reuse workplace credentials in this repository.

No guarantees of secure handling of industrial safety or regulated information are made. Please privately report suspected vulnerabilities to the repository maintainer (once a secure contact is configured). Do not post credentials, exploitable details, or confidential data in a public issue.

Before a public release, review [docs/publication-checklist.md](docs/publication-checklist.md).
