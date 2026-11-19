"""Convert Pencil's PDF export to one self-contained SVG per artboard."""

import argparse
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

try:
    import pymupdf
except ImportError:
    sys.exit("PyMuPDF is required. Install it in the Python environment running this script.")


SVG = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", XLINK)
ET.register_namespace("inkscape", "http://www.inkscape.org/namespaces/inkscape")


def file_stem(label):
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", label).strip(" .")[:120].rstrip(" .")
    if not stem:
        raise ValueError("A screen name cannot be empty.")
    if re.fullmatch(r"(?i:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])", stem.split(".")[0]):
        stem = f"_{stem}"
    return stem


def page_svg(page, allow_blank):
    if not allow_blank:
        zoom = min(1, 384 / max(page.rect.width, page.rect.height))
        sample = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), colorspace=pymupdf.csRGB)
        pixels = sample.samples
        if pixels == pixels[:3] * (len(pixels) // 3):
            raise ValueError(f"Page {page.number + 1} rendered as a single color. Check Pencil's export.")

    root = ET.fromstring(page.get_svg_image(text_as_path=True))
    defs = root.find(f"{{{SVG}}}defs")
    for parent in root.iter():
        for node in list(parent):
            if (
                node.tag == f"{{{SVG}}}use" and "data-text" in node.attrib
                and node.get("fill-opacity") == "0" and node.get("stroke") in (None, "none")
            ):
                # Pencil adds an invisible PDF text layer for copy/search.
                parent.remove(node)
    if defs is not None:
        # Keep definitions used outside the removed text layer, including
        # glyphs used by any visible PDF text.
        href_key = f"{{{XLINK}}}href"
        referenced = {node.get(href_key) or node.get("href") for node in root.iter()}
        for node in list(defs):
            ident = node.get("id", "")
            if ident.startswith("font_") and f"#{ident}" not in referenced:
                defs.remove(node)
    for image in root.iter(f"{{{SVG}}}image"):
        for key in (f"{{{XLINK}}}href", "href"):
            value = image.get(key, "")
            if value.startswith("data:"):
                image.set(key, re.sub(r"\s+", "", value))

    paths = sum(1 for _ in root.iter(f"{{{SVG}}}path"))
    images = sum(1 for _ in root.iter(f"{{{SVG}}}image"))
    return ET.tostring(root, encoding="utf-8", xml_declaration=True), paths, images


def convert(args):
    with pymupdf.open(args.pdf) as document:
        if not document.is_pdf or document.needs_pass or not document.page_count:
            raise ValueError("Expected a readable, non-empty PDF from Pencil.")
        if args.name and len(args.name) != document.page_count:
            raise ValueError(f"Expected {document.page_count} --name values, received {len(args.name)}.")
        labels = args.name or (
            [args.pdf.stem] if document.page_count == 1 else
            [f"{args.pdf.stem}-{i:02d}" for i in range(1, document.page_count + 1)]
        )
        targets = [args.output_dir / f"{file_stem(label)}.svg" for label in labels]
        if len({target.name.casefold() for target in targets}) != len(targets):
            raise ValueError("Two screen names resolve to the same SVG filename.")
        for target in targets:
            if not args.overwrite and target.exists():
                raise FileExistsError(f"Output already exists: {target}")
        converted = [page_svg(page, args.allow_blank) for page in document]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for target, (data, paths, images) in zip(targets, converted):
        with target.open("wb" if args.overwrite else "xb") as output:
            output.write(data)
        print(f"{target.resolve()}  [SVG paths: {paths}, image elements: {images}]")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Pencil export.pdf")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--name", action="append", help="One label per page, in PDF order")
    parser.add_argument("--allow-blank", action="store_true", help="Allow intentional solid-color pages")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing SVG files")
    args = parser.parse_args()
    try:
        convert(args)
    except (OSError, ValueError, RuntimeError, ET.ParseError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
