"""Live examples: a ```trebol-ui block shows its code and, under it, the app running.

Each block becomes a page of its own under _live/ (its code in a .trb file next
to it), shown in a frame. The frame loads Trebol's runtime from _trebol/, and the
pretend server the examples talk to (docs/_servers/workshop.ts), which
`node tools/site.ts` writes once the build has finished. The files in docs/_media
go next to the pages, so an example names them as a file: `backdrop %workshop.svg`.
_static/trebol-live.js fits each frame to its app and gives it the documentation's
light or dark.
"""

import html
import shutil
import subprocess
from pathlib import Path

from docutils import nodes
from sphinx.util.osutil import relative_uri

ROOT = Path(__file__).resolve().parents[2]

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live example</title>
<script>try {{ parent.trebolLiveScheme(document.documentElement); }} catch {{}}</script>
<script type="module" src="../_trebol/workshop.js"></script>
<script type="module" src="../_trebol/host/browser.js"></script>
<script type="text/trebol" src="{name}.trb"></script>
</head>
<body></body>
</html>
"""


def live(app, doctree, docname):
    if app.builder.format != "html":
        return
    out = Path(app.outdir) / "_live"
    blocks = [b for b in doctree.findall(nodes.literal_block) if b.get("language") == "trebol-ui"]
    if blocks:
        shutil.copytree(ROOT / "docs" / "_media", out, dirs_exist_ok=True)
    for n, block in enumerate(blocks, 1):
        name = f"{docname.replace('/', '-')}-{n}"
        (out / f"{name}.trb").write_text(block.astext() + "\n", encoding="utf-8")
        (out / f"{name}.html").write_text(PAGE.format(name=name), encoding="utf-8")
        src = html.escape(relative_uri(app.builder.get_target_uri(docname), f"_live/{name}.html"))
        block["language"] = "trebol"
        frame = (
            f'<div class="trebol-live">'
            f'<iframe class="trebol-live" src="{src}" title="Live example" loading="lazy"></iframe>'
            f'<a class="trebol-live-open" href="{src}" target="_blank" rel="noopener">Open on its own</a>'
            f"</div>"
        )
        block.parent.insert(block.parent.index(block) + 1, nodes.raw("", frame, format="html"))


def runtime(app, exception):
    if exception is None and app.builder.format == "html":
        subprocess.run(
            ["node", "--disable-warning=ExperimentalWarning", str(ROOT / "tools" / "site.ts"), str(Path(app.outdir) / "_trebol")],
            check=True,
        )


def setup(app):
    app.connect("doctree-resolved", live)
    app.connect("build-finished", runtime)
    app.add_js_file("trebol-live.js", defer="defer")
    app.add_css_file("trebol-live.css")
    return {"parallel_read_safe": True}
