"""
Render the submission documents to print-ready HTML.

Markdown in the repo is the source of truth; this only produces a printable
face for it, so the two can never drift — re-run it after editing any document.
`scripts/docs-to-pdf.mjs` then drives headless Chromium to turn each HTML file
into a PDF.

Requires: pip install markdown   (a local tool, deliberately not a project
dependency — nothing here ships with the app.)
"""
import io
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "submission"
OUT = ROOT / "docs" / "submission" / ".pdf-build"

# Cover metadata per document, so each PDF opens with a title page rather than
# a bare H1 the reader has to interpret.
DOCS = {
    "01-product-spec.md": ("Product Specification", "The problem, the users, and what the product is for"),
    "02-technical-design.md": ("Technical Design", "Architecture, data model, business logic, and how it is built"),
    "03-test-spec.md": ("Test Specification", "What is tested, why, and what is not"),
    "04-scale.md": ("Scale", "Heavy queries, indexes, caching, measured results, and limits"),
    "05-security.md": ("Security", "Authentication, authorization, secrets, and remaining risks"),
}

CSS = """
@page {
  size: A4;
  margin: 20mm 18mm 18mm;
}

:root {
  --ink: #201d1a;
  --muted: #5c5751;
  --accent: #2e7d5e;
  --hairline: #e2ddd4;
  --rail: #f2efe8;
  --paper: #ffffff;
}

* { box-sizing: border-box; }

body {
  font-family: "IBM Plex Sans", -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--ink);
  background: var(--paper);
  font-size: 10.5pt;
  line-height: 1.55;
  margin: 0;
}

/* ---- cover ------------------------------------------------------------ */
.cover {
  page-break-after: always;
  height: 245mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.cover .project {
  font-family: "Bricolage Grotesque", "Trebuchet MS", sans-serif;
  font-size: 46pt;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0 0 6mm;
}
.cover .doctitle {
  font-family: "Bricolage Grotesque", "Trebuchet MS", sans-serif;
  font-size: 22pt;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--accent);
  margin: 0 0 3mm;
}
.cover .sub { font-size: 12pt; color: var(--muted); max-width: 120mm; margin: 0 0 14mm; }
.cover .rule { border: 0; border-top: 2px solid var(--accent); width: 26mm; margin: 0 0 14mm; }
.cover .meta { font-size: 9.5pt; color: var(--muted); line-height: 1.9; }
.cover .meta strong { color: var(--ink); font-weight: 600; }

/* ---- headings --------------------------------------------------------- */
h1, h2, h3, h4 {
  font-family: "Bricolage Grotesque", "Trebuchet MS", sans-serif;
  letter-spacing: -0.015em;
  line-height: 1.18;
  page-break-after: avoid;
}
/* The document's own H1 duplicates the cover, so it is dropped. */
body > h1:first-of-type { display: none; }
h2 {
  font-size: 16pt;
  font-weight: 600;
  margin: 11mm 0 3mm;
  padding-bottom: 2mm;
  border-bottom: 1px solid var(--hairline);
}
h3 { font-size: 12pt; font-weight: 600; margin: 7mm 0 2mm; }
h4 { font-size: 10.5pt; font-weight: 600; margin: 5mm 0 1.5mm; color: var(--muted); }

p { margin: 0 0 3.2mm; orphans: 3; widows: 3; }
strong { font-weight: 600; }
em { font-style: italic; }

ul, ol { margin: 0 0 3.2mm; padding-left: 6mm; }
li { margin-bottom: 1.4mm; }

a { color: var(--accent); text-decoration: none; }

blockquote {
  margin: 4mm 0;
  padding: 2mm 0 2mm 5mm;
  border-left: 2px solid var(--accent);
  color: var(--muted);
}
blockquote p:last-child { margin-bottom: 0; }

hr { border: 0; border-top: 1px solid var(--hairline); margin: 8mm 0; }

/* ---- code ------------------------------------------------------------- */
code {
  font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace;
  font-size: 0.87em;
  background: var(--rail);
  padding: 0.1em 0.35em;
  border-radius: 2pt;
}
pre {
  background: var(--rail);
  border: 1px solid var(--hairline);
  border-radius: 3pt;
  padding: 3mm 4mm;
  overflow-x: auto;
  page-break-inside: avoid;
  font-size: 8.5pt;
  line-height: 1.45;
}
pre code { background: none; padding: 0; font-size: inherit; }

/* ---- tables ----------------------------------------------------------- */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 4mm 0 5mm;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
thead { display: table-header-group; }
th {
  text-align: left;
  font-family: "IBM Plex Mono", monospace;
  font-size: 8pt;
  font-weight: 500;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1.5px solid var(--hairline);
  padding: 2mm 3mm 2mm 0;
}
td {
  border-bottom: 1px solid var(--hairline);
  padding: 2mm 3mm 2mm 0;
  vertical-align: top;
}
tr { page-break-inside: avoid; }

/* Keep a heading with the block that follows it. */
h2 + p, h2 + table, h3 + p, h3 + ul, h3 + table { page-break-before: avoid; }
"""

HEAD = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>{css}</style></head><body>
<section class="cover">
  <p class="doctitle">{title}</p>
  <h1 class="project">NestUp</h1>
  <hr class="rule">
  <p class="sub">{sub}</p>
  <div class="meta">
    <strong>Internet Technologies — Become a Full-Stack Engineer</strong><br>
    RUNI CS 2026 · Final project<br><br>
    Live product &nbsp;<strong>nestup-kappa.vercel.app</strong><br>
    Repository &nbsp;<strong>github.com/nestupweb/nestup</strong>
  </div>
</section>
"""


def normalise_lists(text: str) -> str:
    """
    Insert the blank line python-markdown needs before a list.

    GitHub Flavored Markdown happily starts a list on the line straight after a
    paragraph; python-markdown does not, and silently renders it as running
    text with literal "-" characters in the middle of a sentence. That is not a
    theoretical difference — it mangled four lists in the scale document before
    this existed. Normalising here rather than editing the sources keeps the
    markdown natural for the GitHub reader, who is the primary audience.
    """
    item = re.compile(r"^\s*([-*+]|\d+\.)\s+")
    out: list[str] = []
    for line in text.splitlines():
        if (
            item.match(line)
            and out
            and out[-1].strip()
            and not item.match(out[-1])
            and not out[-1].lstrip().startswith(("#", "|", ">"))
        ):
            out.append("")
        out.append(line)
    return "\n".join(out)


def convert(name: str) -> Path:
    title, sub = DOCS[name]
    text = (SRC / name).read_text(encoding="utf-8")

    # The cross-links at the foot of each document point at .md files, which
    # mean nothing in a PDF. Drop that line rather than print a dead link.
    text = re.sub(r"^\*Companion documents:.*$", "", text, flags=re.MULTILINE)

    text = normalise_lists(text)

    html = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "sane_lists", "attr_list"],
    )

    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / (name.replace(".md", ".html"))
    dest.write_text(
        HEAD.format(title=title, sub=sub, css=CSS) + html + "\n</body></html>",
        encoding="utf-8",
    )
    return dest


if __name__ == "__main__":
    for name in DOCS:
        print("built", convert(name).name)
