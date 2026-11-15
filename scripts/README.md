# Dreamese project import

The homepage catalog and 14 project pages come from `dreamese/dreamesestudio` at commit `27017426bbf0453e33b4cceb0aa8f8550c1b4ad7`.

All 965 project/process/logo images and 17 fonts are stored in Chapter_Web. The import preserves source image resolution and folder structure, and encodes raster images as WebP at quality 88. Pages use local relative paths and do not request their project or service resources from the source repository.

The four `Qtr_*.html` pages were built specifically for Chapter_Web. They retain the source service step order: 7 design-build steps, 7 project management steps, 7 architecture steps, and 6 interior steps. Their timeline scrolls horizontally above 820px and vertically on smaller screens.

## Verification

```sh
python scripts/verify-site.py
node scripts/verify-config.cjs
node --check js/service-journey.js
```

The static verifier checks every imported asset, the project/service routes, step counts, and HTML/CSS file references. The configuration check covers migration of old manager drafts without discarding unrelated edits.

## Recreating assets

Requires Python 3.12 and Pillow 12.0.0:

```sh
python scripts/import-dreamese-assets.py
```

The manifest pins every source file and its Git blob SHA. The importer verifies source checksums before encoding, retries temporary failures, writes atomically, and fails if any file cannot be copied. Existing files are preserved. The workflow on the import branch runs this process and saves the resulting assets in this repository.

Six nonexistent source image filenames were removed from their project albums; the TVT `BottomUp.jpg` typo was corrected to the existing `Bottom_Up.webp`. No existing source image was omitted from the import manifest.
