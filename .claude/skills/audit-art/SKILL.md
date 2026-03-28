---
name: audit-art
description: Audit all game art images for quality issues — grids, frames, borders, style inconsistencies, or low quality. Use when new images are generated or existing ones need review.
---

# Art Audit Skill

Audit all image assets in the `images/` directory of this project for quality issues.

## What to check

For each image, look for ALL of the following problems:

1. **Grid/Collage**: Multiple images tiled together (2x2, 2x3, 3x3 grids, etc.) instead of a single scene
2. **Frames/Borders**: Image shown inside a picture frame, white matting, border, or as if mounted on a wall
3. **White space**: Visible white, gray, or blank margins around the actual artwork
4. **Split/Duplicate**: Same image mirrored or duplicated (top/bottom or left/right)
5. **Style mismatch**: Cartoon/chibi/anime style when it should be realistic fantasy art, or vice versa
6. **Low quality**: Very blurry, distorted faces/features, or incomprehensible composition
7. **Vignette artifacts**: Dark/black corners that look like lens vignetting rather than intentional darkness

## How to audit

1. Use Glob to find all `.png` and `.jpg` files in the `images/` directory
2. Read EVERY image file to visually inspect it
3. For each image, evaluate against all 7 criteria above
4. Produce a report with the following format:

## Report format

```
## Art Audit Report

### PASS (X images)
- filename.png — brief positive note

### FAIL (X images)
- filename.png — [ISSUE TYPE] description of the problem

### Summary
X/Y images passed. Z need regeneration.
```

Group FAIL images by issue type when possible. Be specific about what's wrong so the issues can be fixed in the regeneration prompts.

$ARGUMENTS
