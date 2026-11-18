"""Sphinx configuration for the Trebol documentation (Markdown via MyST)."""

import re
import sys
from pathlib import Path

from pygments.lexer import RegexLexer, bygroups, using
from pygments.lexers import RebolLexer
from pygments.token import Generic

project = "Trebol"

sys.path.insert(0, str(Path(__file__).parent / "_ext"))

# designer_docs copies the designer's pages in from trebol-dev, where they are written
extensions = ["myst_parser", "sphinx.ext.githubpages", "trebol_live", "designer_docs"]

# Documentation is authored in Markdown.
source_suffix = {".md": "markdown"}
root_doc = "index"

# design.md is the working design log, not part of the published documentation.
# _reference holds the notes tools/reference.ts writes the reference from (npm run reference).
exclude_patterns = ["_build", "design.md", "screenshots", "_reference"]

html_theme = "furo"  # modern, responsive, dark-mode; install via docs/requirements.txt
html_title = "Trebol"
html_static_path = ["_static"]
# the red four-leaf clover; the favicon draws its stem heavier, to show at 16 px
html_logo = "_static/trebol.svg"
html_favicon = "_static/favicon.svg"
html_css_files = ["trebol-docs.css"]

# Resolve in-page links like [text](#a-heading) to heading anchors (h1..h3).
myst_heading_anchors = 3


class TrebolConsoleLexer(RegexLexer):
    """A console session: `>>` lines are input, `==` the value, `**` an error."""

    name = "Trebol console"
    aliases = ["trebol-console"]
    flags = re.MULTILINE

    tokens = {
        "root": [
            (r"^(>> |\[    )(.*\n?)", bygroups(Generic.Prompt, using(RebolLexer))),
            (r"^(== )(.*\n?)", bygroups(Generic.Prompt, using(RebolLexer))),
            (r"^\*\*.*\n?", Generic.Error),
            # never an empty match: it would keep the lexer in place forever
            (r"^.+\n?", Generic.Output),
            (r"\n", Generic.Output),
        ],
    }


def setup(app):
    # Trebol is Rebol's language, so Rebol's highlighter reads it well.
    app.add_lexer("trebol", RebolLexer)
    app.add_lexer("trebol-console", TrebolConsoleLexer)
    app.add_lexer("trebol-test", RebolLexer)
