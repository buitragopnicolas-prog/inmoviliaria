"""Create portable wordmark paths from the project's existing Source Sans 3 font.

Run from the repository root in PowerShell (fontTools and brotli are tooling only):
    $env:PYTHONPATH = '.local/brand-tools'
    & '<python executable>' scripts/outline-brand-wordmark.py <Source-Sans-3.woff2>

The input is the Latin WOFF2 subset already downloaded by next/font/google into
apps/web/.next/static/media. The output contains outlines for the two brand
strings and font provenance, never a copy of the complete font. The input file
name and SHA-256 identify the source even if a later Next build changes its path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps/web/lib/brand-wordmark.json"
WEIGHT = 600
LINES = (
    ("namePath", "Asesoría", 35, -0.6, 122, 49),
    ("descriptorPath", "Inmobiliaria JB", 24, 0.5, 122, 78),
)


def svg_number(value: float) -> str:
    rounded = round(value, 4)
    return "0" if rounded == 0 else f"{rounded:.4f}".rstrip("0").rstrip(".")


def outline_line(font: TTFont, text: str, size: int, tracking: float,
                 x: int, baseline: int) -> tuple[str, tuple[float, ...]]:
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    path_pen = SVGPathPen(glyphs, ntos=svg_number)
    bounds_pen = BoundsPen(glyphs)
    cursor = float(x)

    for character in text:
        glyph_name = cmap[ord(character)]
        transform = (scale, 0, 0, -scale, cursor, baseline)
        glyphs[glyph_name].draw(TransformPen(path_pen, transform))
        glyphs[glyph_name].draw(TransformPen(bounds_pen, transform))
        cursor += font["hmtx"].metrics[glyph_name][0] * scale + tracking

    if bounds_pen.bounds is None:
        raise ValueError(f"No visible outlines produced for {text!r}")
    return path_pen.getCommands(), bounds_pen.bounds


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font", type=Path, help="Source Sans 3 Latin WOFF2 from the Next build")
    args = parser.parse_args()
    source_path = args.font.resolve(strict=True)
    font = TTFont(source_path)
    names = font["name"]
    family = names.getDebugName(4) or names.getDebugName(16) or names.getDebugName(1)
    if family != "Source Sans 3":
        raise ValueError(f"Expected Source Sans 3; found {family!r}")

    required_characters = set("".join(line[1] for line in LINES))
    missing = sorted(character for character in required_characters
                     if ord(character) not in font.getBestCmap())
    if missing:
        raise ValueError(f"Font subset is missing brand characters: {missing!r}")

    try:
        source_file = source_path.relative_to(ROOT).as_posix()
    except ValueError:
        source_file = source_path.name
    provenance = {
        "family": family,
        "weight": WEIGHT,
        "fontFile": source_file,
        "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "postScriptName": names.getDebugName(6),
        "fontVersion": names.getDebugName(5),
        "copyright": names.getDebugName(0),
        "license": names.getDebugName(13),
        "licenseUrl": names.getDebugName(14),
        "origin": "Existing next/font/google Source Sans 3 Latin subset; only brand lettering exported.",
    }

    if "fvar" in font:
        axes = {axis.axisTag: axis for axis in font["fvar"].axes}
        if "wght" not in axes or not axes["wght"].minValue <= WEIGHT <= axes["wght"].maxValue:
            raise ValueError("Font does not provide the requested weight 600")
        font = instantiateVariableFont(font, {"wght": WEIGHT}, inplace=False)
    elif font["OS/2"].usWeightClass != WEIGHT:
        raise ValueError("Static input font must have weight 600")

    result = {}
    for key, text, size, tracking, x, baseline in LINES:
        path, bounds = outline_line(font, text, size, tracking, x, baseline)
        if not (0 <= bounds[0] < bounds[2] <= 350 and 0 <= bounds[1] < bounds[3] <= 110):
            raise ValueError(f"{key} extends outside the 350 × 110 logo: {bounds!r}")
        result[key] = path
        print(f"{key}: {len(path)} characters; bounds {tuple(round(v, 3) for v in bounds)}")

    result["source"] = {key: value for key, value in provenance.items() if value is not None}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT).as_posix()} from {source_file}")


if __name__ == "__main__":
    main()
