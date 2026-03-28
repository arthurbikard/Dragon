# Art Audit & Regeneration

Audit all image assets in the `images/` directory, regenerate any that fail, and re-audit until all pass or a max of 3 regeneration rounds is reached.

## Phase 1: Audit

1. Use Glob to find all `.png` and `.jpg` files in the `images/` directory
2. Launch an Agent to read and visually inspect EVERY image file
3. For each image, evaluate against ALL criteria below:

### Quality criteria

1. **Grid/Collage**: Multiple images tiled together (2x2, 2x3, 3x3 grids, etc.) instead of a single scene
2. **Frames/Borders**: Image shown inside a picture frame, white matting, border, or as if mounted on a wall
3. **White space**: Visible white, gray, or blank margins around the actual artwork
4. **Split/Duplicate**: Same image mirrored or duplicated (top/bottom or left/right)
5. **Style mismatch**: Cartoon/chibi/anime/abstract/3D-render style when it should be realistic fantasy digital painting
6. **Low quality**: Very blurry, distorted faces/features, or incomprehensible composition
7. **Vignette artifacts**: Dark/black corners that look like lens vignetting rather than intentional darkness
8. **Off-topic**: The image doesn't match what the card/portrait is supposed to depict

### Report format

For each image, output one line:
- `PASS filename.png — brief note`
- `FAIL filename.png — [ISSUE TYPE] description`

## Phase 2: Regeneration loop (max 3 rounds)

For each round:

1. Collect all FAIL filenames from the audit
2. If none failed, stop — all images pass
3. Delete each failed image and regenerate by running:
   ```bash
   python3 generate_art.py failed1.png failed2.png ...
   ```
4. After generation completes, re-read and visually inspect ONLY the regenerated images against the same criteria
5. If any still fail, repeat from step 1 (up to 3 total rounds)

After 3 rounds, if images still fail, report them as needing manual prompt tuning in `generate_art.py`.

## Phase 3: Final report

Produce a final summary:
```
## Final Art Audit Report
- Total images: X
- Passed: Y
- Failed after 3 rounds: Z (list filenames and issues)
- Rounds needed: N
```

$ARGUMENTS
