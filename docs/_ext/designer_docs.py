"""The designer's pages: their source lives in trebol-dev, next to the designer.

Before Sphinx reads the sources, docs/designer/ is made a copy of docs/designer/ of a trebol-dev checkout,
$TREBOL_DEV or ../trebol-dev (as tools/web.ts finds the designer's app). With no checkout the section is left
out, and the toctree that names it says so as a warning.
"""

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source():
    dev = Path(os.environ.get("TREBOL_DEV") or ROOT.parent / "trebol-dev")
    if not dev.is_absolute():
        dev = ROOT / dev
    return dev / "docs" / "designer"


def copy(app, config):
    src = source()
    dst = Path(app.srcdir) / "designer"
    shutil.rmtree(dst, ignore_errors=True)
    if src.is_dir():
        shutil.copytree(src, dst)


def setup(app):
    app.connect("config-inited", copy)
    return {"parallel_read_safe": True}
