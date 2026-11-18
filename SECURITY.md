# Security Policy

This document explains how to report a vulnerability in **Boot.gs Skills** — the skills, their scripts and the test
harness in this repository.

## Supported Versions

Only the latest state of the `main` branch receives fixes. Reinstall or update the skills to get them.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public issues, discussions or pull requests.**

1. **Preferred:** use GitHub private vulnerability reporting — open the repository's
   [**Security** tab → **Report a vulnerability**](https://github.com/bootgs/skills/security/advisories/new).
2. **Alternative:** email [security@maksymstoianov.com](mailto:security@maksymstoianov.com).

Please include:

- a short description and the type of issue (for example a script that runs untrusted input, a skill instruction that
  leads an agent to leak data, an unsafe download);
- steps to reproduce or a proof of concept;
- the impact as you understand it, and any suggested fix.

## Response Timeline

| Step                                       | Target                       |
| :----------------------------------------- | :--------------------------- |
| Acknowledgement of the report              | within 5 business days       |
| Initial assessment (validity and severity) | within 14 days               |
| Fix for critical or high severity          | within 30 days of assessment |
| Fix for medium or low severity             | in a regular update          |

Severity is rated with [CVSS v3.1](https://www.first.org/cvss/v3.1/specification-document).

## Coordinated Disclosure

- Please keep the details private until a fix is published or 90 days have passed since your report, whichever comes
  first, unless we agree on another date together.
- Confirmed vulnerabilities get a [GitHub Security Advisory](https://github.com/bootgs/skills/security/advisories).
- If a report is out of scope or not a vulnerability, we tell you why.
