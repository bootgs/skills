#!/usr/bin/env python3
"""fetch-review-requirements.py — fetches and structures the current Google
Workspace Marketplace app review checklist from the official docs, instead
of relying on a checklist copy-pasted into a skill file (Google revises this
page regularly; the page itself is dated at the bottom).

Usage: fetch-review-requirements.py [OPTIONS]

Options:
  --integration NAME   Only show criteria for one integration type.
                        One of: "Google Workspace add-on", "Editor add-on",
                        "Web app", "Drive app", "Google Chat app"
  --category NAME      Only show categories matching NAME (substring,
                        case-insensitive), e.g. "OAuth", "Graphics", "Name"
  --list-integrations  Print the available --integration values and exit
  --json               Emit structured JSON instead of a checklist
  -h, --help           Show this help and exit

Exit codes:
  0  success
  1  bad usage
  2  could not fetch or parse the docs page (including a robots.txt refusal)
  3  --integration or --category matched nothing
  4  the host told us to stop (403, 429, 503) — wait, do not retry

Fetching goes through fetch_policy.py next to this script: it identifies this
script and the repository in the User-Agent, reads robots.txt before the target,
never exceeds one request per second per host, and stops rather than retries on
403/429/503. There is no flag to turn any of that off.

Requires: Python 3 standard library only, plus the `curl` binary (used for
the actual HTTPS fetch — more reliably configured with a system CA bundle
across environments than Python's own SSL context, notably on macOS Python.org
installs that haven't run "Install Certificates.command").
"""

import argparse
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fetch_policy import FetchDisallowed, FetchStopped, PolicyFetcher  # noqa: E402

URL = "https://developers.google.com/workspace/marketplace/about-app-review"

SCRIPT_NAME = "fetch-review-requirements.py"


def fetch(url: str) -> str:
    """Fetches under the shared policy. Provenance goes to stderr, body returned."""
    fetcher = PolicyFetcher(SCRIPT_NAME)
    result = fetcher.fetch(url)
    print(result.provenance, file=sys.stderr)
    return result.body


def strip_tags(fragment: str) -> str:
    text = re.sub(r"<[^<]+?>", "", fragment)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def extract_criteria(cell_html: str):
    items = re.findall(r"<li[^>]*>(.*?)</li>", cell_html, re.S)
    result = []
    for item in items:
        recommended = bool(re.search(r"<em>\s*Recommended\s*</em>", item, re.I))
        text = strip_tags(item)
        text = re.sub(r"^\(\s*Recommended\s*\)\s*", "", text, flags=re.I)
        result.append({"text": text, "recommended": recommended})
    return result


def parse(source_html: str) -> dict:
    tables = re.findall(r"<table>(.*?)</table>", source_html, re.S)
    if len(tables) < 2:
        raise ValueError(f"expected 2 requirement tables, found {len(tables)} — the docs page structure may have changed")

    general = []
    for row in re.findall(r"<tr>(.*?)</tr>", tables[0], re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) != 2:
            continue
        general.append({"category": strip_tags(cells[0]), "criteria": extract_criteria(cells[1])})

    integrations: dict = {}
    for row in re.findall(r"<tr>(.*?)</tr>", tables[1], re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) != 3:
            continue
        integration = strip_tags(cells[0])
        integrations.setdefault(integration, []).append(
            {"category": strip_tags(cells[1]), "criteria": extract_criteria(cells[2])}
        )

    if not general or not integrations:
        raise ValueError("parsed 0 categories — the docs page structure may have changed")

    updated_match = re.search(r"Last updated (\d{4}-\d{2}-\d{2})", source_html)

    return {
        "source_url": URL,
        "last_updated": updated_match.group(1) if updated_match else None,
        "requirements_for_all_apps": general,
        "requirements_by_integration": integrations,
    }


def render_checklist(sections, title: str) -> str:
    lines = [f"## {title}"] if title else []
    for section in sections:
        lines.append(f"\n### {section['category']}")
        for item in section["criteria"]:
            tag = " (recommended)" if item["recommended"] else ""
            lines.append(f"- [ ] {item['text']}{tag}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch the current Google Workspace Marketplace app review checklist "
        f"from {URL} — not a hardcoded copy, always the live page.",
        epilog="Exit codes: 0 success, 1 bad usage, 2 fetch/parse failure, 3 --integration/--category matched nothing, 4 host said stop (403/429/503).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--integration", help='e.g. "Google Workspace add-on", "Editor add-on", "Web app", "Drive app", "Google Chat app"')
    parser.add_argument("--category", help='substring match, e.g. "OAuth", "Graphics"')
    parser.add_argument("--list-integrations", action="store_true", help="print available --integration values and exit")
    parser.add_argument("--json", action="store_true", help="emit structured JSON instead of a checklist")
    args = parser.parse_args()

    try:
        source_html = fetch(URL)
    except FetchStopped as stopped:
        # The host said no. Report it; a retry loop is how a polite tool gets blocked.
        print(f"Error: {stopped}", file=sys.stderr)
        return 4
    except FetchDisallowed as disallowed:
        print(f"Error: {disallowed}", file=sys.stderr)
        return 2

    try:
        data = parse(source_html)
    except Exception as error:  # noqa: BLE001 — surface any parse failure uniformly
        print(f"Error: could not parse {URL}: {error}", file=sys.stderr)
        return 2

    if args.list_integrations:
        for name in data["requirements_by_integration"]:
            print(name)
        return 0

    if args.integration:
        matches = [k for k in data["requirements_by_integration"] if k.lower() == args.integration.lower()]
        if not matches:
            available = ", ".join(data["requirements_by_integration"])
            print(f'No integration named "{args.integration}". Available: {available}', file=sys.stderr)
            return 3
        sections = data["requirements_by_integration"][matches[0]]
        title = matches[0]
    else:
        sections = data["requirements_for_all_apps"]
        title = "Requirements for all apps"

    if args.category:
        needle = args.category.lower()
        sections = [s for s in sections if needle in s["category"].lower()]
        if not sections:
            print(f'No category matching "{args.category}" in "{title}".', file=sys.stderr)
            return 3

    if args.json:
        print(json.dumps({"source_url": data["source_url"], "last_updated": data["last_updated"], "title": title, "sections": sections}, indent=2))
    else:
        print(f"Source: {data['source_url']} (last updated: {data['last_updated']})\n")
        print(render_checklist(sections, title))

    return 0


if __name__ == "__main__":
    sys.exit(main())
