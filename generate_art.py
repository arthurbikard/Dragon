#!/usr/bin/env python3
"""Generate dragon card art using Hugging Face Inference API.

Usage:
  python generate_art.py                  # Generate all missing images
  python generate_art.py --all            # Force regenerate everything
  python generate_art.py file1 file2 ...  # Regenerate specific files (deletes first)
  python generate_art.py --prompt file1 "custom prompt"  # Regenerate with custom prompt
"""

import requests
import os
import time
import sys
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
API_URL = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0"

# Load .env file if present
env_path = os.path.join(SCRIPT_DIR, ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

HF_TOKEN = os.environ.get("HF_TOKEN", "")
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}

OUTPUT_DIR = os.path.join(SCRIPT_DIR, "images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Shared style suffix for consistency across all images
STYLE = (
    "single scene, one image, filling entire frame, "
    "digital painting, realistic fantasy art, dramatic lighting, "
    "detailed, 4k, artstation, concept art, sharp focus"
)
NEG = (
    "grid, collage, multiple images, split screen, panels, tiled, montage, "
    "frame, picture frame, border, white border, matting, white space, margins, "
    "vignette, black corners, "
    "cartoon, chibi, anime, abstract, 3d render, plastic, figurine, "
    "low quality, blurry, text, watermark, signature, deformed"
)

# === IMAGE DEFINITIONS ===
# Each entry: { "file": filename, "prompt": generation prompt }

IMAGES = {
    # --- Dragon portraits (battle screen) ---
    "dragon_fire.png": (
        f"A majestic fire dragon with crimson and orange scales, breathing flames, "
        f"surrounded by embers and lava, fierce expression, dark volcanic background, portrait view, {STYLE}"
    ),
    "dragon_water.png": (
        f"A powerful water dragon with deep blue and turquoise scales, "
        f"ocean waves crashing around it, bioluminescent markings, stormy sea background, portrait view, {STYLE}"
    ),
    "dragon_earth.png": (
        f"A massive earth dragon with moss-covered brown and green stone-like scales, "
        f"emerging from a mountain, crystals growing on its back, forest background, portrait view, {STYLE}"
    ),
    "dragon_air.png": (
        f"An ethereal air dragon with iridescent purple and cyan translucent scales, "
        f"soaring through storm clouds, lightning crackling around it, sky background, portrait view, {STYLE}"
    ),

    # --- Enemy portraits ---
    "enemy_young_drake.png": (
        f"A young fiery drake, small but fierce red dragon with glowing orange eyes, "
        f"flames licking around its body, dark cavern background, portrait view, {STYLE}"
    ),
    "enemy_storm_wyrm.png": (
        f"A storm wyrm dragon crackling with lightning, purple and cyan scales, "
        f"electric storm swirling around it, dark thundercloud background, menacing, portrait view, {STYLE}"
    ),
    "enemy_ancient_dragon.png": (
        f"An ancient colossal dragon covered in moss and crystals, "
        f"wise and terrifying, mountain peaks behind it, glowing green eyes, portrait view, {STYLE}"
    ),

    # --- Fire cards ---
    "card_fire_strike.png": (
        f"Close-up of a dragon claw wreathed in flames slashing through dark air, "
        f"fire sparks flying, intense action, dark background, {STYLE}"
    ),
    "card_fire_blast.png": (
        f"A massive fireball explosion erupting from a dragon's mouth, "
        f"intense heat waves, fire filling the scene, dark background, {STYLE}"
    ),
    "card_ember.png": (
        f"Glowing dragon embers and floating fire wisps in a dark cavern, "
        f"smoldering coals on the ground, warm orange glow, mystical atmosphere, {STYLE}"
    ),
    "card_flame_shield.png": (
        f"A dragon crouching behind a magical shield of swirling fire and lava, "
        f"the shield glows bright orange and red, dark cavern background, "
        f"protective fire magic spell, {STYLE}"
    ),
    "card_inferno.png": (
        f"A towering inferno pillar erupting from the ground, "
        f"dragon silhouette within the flames, apocalyptic fire scene, {STYLE}"
    ),

    # --- Water cards ---
    "card_water_bolt.png": (
        f"A bolt of concentrated water energy shooting forward through a dark ocean scene, "
        f"frozen water crystals trailing behind, aquatic magic projectile, {STYLE}"
    ),
    "card_tidal_wave.png": (
        f"A giant ocean tidal wave crashing with immense power, "
        f"sea dragon silhouette in the wave, stormy sky above, {STYLE}"
    ),
    "card_ice_barrier.png": (
        f"A towering crystalline ice barrier wall rising from frozen ground, "
        f"frost patterns, blue magical glow emanating from within, snowy scene, {STYLE}"
    ),
    "card_healing_rain.png": (
        f"Magical glowing rain falling through a dark enchanted forest, "
        f"golden sparkles in the raindrops, restorative healing water, mystical atmosphere, {STYLE}"
    ),
    "card_cleanse.png": (
        f"A waterfall of glowing pure blue water cascading down through a dark cave, "
        f"washing away dark corruption and shadow, golden light shining through the water, "
        f"purification magic, {STYLE}"
    ),

    # --- Earth cards ---
    "card_rock_throw.png": (
        f"Massive rocks and boulders exploding upward from cracking earth, "
        f"green magical energy between the rocks, dust clouds, dramatic scene, {STYLE}"
    ),
    "card_earthquake.png": (
        f"The ground cracking open with seismic green energy, earthquake devastation, "
        f"rocks splitting apart, earth dragon power, dramatic landscape, {STYLE}"
    ),
    "card_stone_wall.png": (
        f"A towering magical stone fortress wall rising from the ground, "
        f"glowing green earth runes carved into ancient stone blocks, dark sky behind, {STYLE}"
    ),
    "card_fortify.png": (
        f"A dragon warrior encased in layers of glowing magical stone armor, "
        f"earth fortification magic, stone plates assembling, dark cavern background, {STYLE}"
    ),
    "card_thorns.png": (
        f"Sharp thorny vines erupting from dark forest ground, "
        f"glowing green magical tips, dangerous brambles, earth magic, dark atmosphere, {STYLE}"
    ),

    # --- Air cards ---
    "card_gust.png": (
        f"A powerful gust of wind with visible swirling air currents, "
        f"leaves and debris caught in the wind, wind slash cutting through a stormy sky, {STYLE}"
    ),
    "card_lightning.png": (
        f"A massive lightning bolt striking down from dark storm clouds, "
        f"electric energy crackling, thunder dragon power, dramatic dark sky, {STYLE}"
    ),
    "card_wind_shield.png": (
        f"A warrior standing inside a swirling protective cyclone of wind and glowing cyan energy, "
        f"debris and leaves caught in the vortex, dark stormy sky background, {STYLE}"
    ),
    "card_tailwind.png": (
        f"Swirling tailwind currents carrying glowing leaves and light particles, "
        f"speed magic, flowing air streams through a mystical forest, {STYLE}"
    ),
    "card_second_wind.png": (
        f"A dragon warrior surrounded by a burst of renewed cyan wind energy, "
        f"rejuvenation magic, glowing air swirl, second breath of power, dark background, {STYLE}"
    ),

    # --- Neutral cards ---
    "card_dragon_claw.png": (
        f"A fearsome dragon claw close-up with razor sharp talons, "
        f"detailed scales visible, powerful grip, dark atmospheric background, {STYLE}"
    ),
    "card_dragon_scales.png": (
        f"A dragon curling its body defensively showing its heavily armored scaled hide, "
        f"light reflecting off metallic green and gold scales, dark cave background, "
        f"protective stance, {STYLE}"
    ),
    "card_dragon_breath.png": (
        f"A dragon breathing multicolored magical fire, rainbow dragon breath, "
        f"powerful elemental breath attack, dark cavern background, {STYLE}"
    ),

    # --- Menu / UI art ---
    "menu_bg.png": (
        f"A dark throne room inside a mountain with four dragon statues lining the walls, "
        f"glowing lava cracks in the floor, ancient stone pillars, "
        f"dim torchlight, fog rolling across the ground, wide angle view, {STYLE}"
    ),
    "menu_fire.png": (
        f"Close-up portrait of a fierce fire dragon emerging from darkness, "
        f"crimson and orange scales, glowing yellow eyes, flames and embers around its face, "
        f"completely dark background, looking straight at the viewer, {STYLE}"
    ),
    "menu_water.png": (
        f"Close-up portrait of a powerful water dragon emerging from darkness, "
        f"deep blue and turquoise scales, glowing cyan eyes, water mist and droplets around its face, "
        f"completely dark background, looking straight at the viewer, {STYLE}"
    ),
    "menu_earth.png": (
        f"Close-up portrait of a massive earth dragon emerging from darkness, "
        f"brown and green stone-like scales with moss, glowing green eyes, crystals on its horns, "
        f"completely dark background, looking straight at the viewer, {STYLE}"
    ),
    "menu_air.png": (
        f"Close-up portrait of an ethereal air dragon emerging from darkness, "
        f"purple and cyan translucent scales, glowing white eyes, electric sparks around its face, "
        f"completely dark background, looking straight at the viewer, {STYLE}"
    ),
    "victory.png": (
        f"A triumphant dragon warrior standing atop a mountain of defeated foes, "
        f"golden light breaking through storm clouds, epic victory moment, {STYLE}"
    ),
    "defeat.png": (
        f"A fallen warrior's sword stuck in the ground before a massive dragon silhouette, "
        f"dark moody atmosphere, embers floating, somber defeat scene, {STYLE}"
    ),

    # --- Map background ---
    "map_bg.png": (
        f"A top-down fantasy parchment map of volcanic islands, "
        f"hand-drawn cartography style with aged paper texture, "
        f"mountains, forests, rivers, coastlines, ocean waves, "
        f"warm sepia and brown tones, compass rose in corner, "
        f"old world exploration map, highly detailed, {STYLE}"
    ),

    # --- New enemy portraits ---
    "enemy_forest_wyrm.png": (
        f"A forest wyrm dragon covered in moss and vines, green and brown scales, "
        f"glowing yellow-green eyes, coiled around a twisted ancient tree, "
        f"dark misty forest background, menacing, portrait view, {STYLE}"
    ),
    "enemy_ember_titan.png": (
        f"A massive ember titan dragon made of cooling lava and obsidian rock, "
        f"cracks of glowing magma across its body, towering and powerful, "
        f"volcanic eruption background, portrait view, {STYLE}"
    ),

    # --- NPC portraits ---
    "npc_elder.png": (
        f"A wise old village elder with a long white beard, wearing humble brown robes, "
        f"kind weathered face, holding a wooden staff, warm firelight, "
        f"dark background, portrait view, {STYLE}"
    ),
    "npc_merchant.png": (
        f"A rugged fantasy merchant with a thick dark beard, leather apron, "
        f"various potions and trinkets hanging from his belt, shrewd eyes, "
        f"market stall lantern light, dark background, portrait view, {STYLE}"
    ),
    "npc_priestess.png": (
        f"A mystical temple priestess in flowing white and gold robes, "
        f"glowing arcane markings on her hands, serene expression, "
        f"sacred blue flame behind her, dark background, portrait view, {STYLE}"
    ),
    "npc_wanderer.png": (
        f"A mysterious hooded wanderer sitting by a campfire, "
        f"scarred face partially visible, shuffling strange glowing cards, "
        f"smoke and embers rising, dark forest background, portrait view, {STYLE}"
    ),

    # --- Location icons (small vignettes) ---
    "loc_misty_shore.png": (
        f"A foggy rocky coastline with crashing waves, a dragon silhouette in the mist, "
        f"atmospheric moody coastal scene, dark and mysterious, {STYLE}"
    ),
    "loc_village.png": (
        f"A small fantasy village with thatched roof cottages, warm lantern light, "
        f"cobblestone path, cozy and inviting, evening scene, {STYLE}"
    ),
    "loc_dark_forest.png": (
        f"A dark twisted forest with gnarled trees, eerie green bioluminescent mushrooms, "
        f"thick fog between the trees, ominous and foreboding, {STYLE}"
    ),
    "loc_ancient_temple.png": (
        f"Ancient stone temple ruins with crumbling pillars, mystical blue flame on an altar, "
        f"overgrown with vines, moonlight streaming through, {STYLE}"
    ),
    "loc_lava_bridge.png": (
        f"An ancient crumbling bridge stretching across a chasm filled with glowing lava, "
        f"volcanic rocks and magma below, dark smoky atmosphere, "
        f"wide cinematic view, {STYLE}"
    ),
    "loc_crystal_cave.png": (
        f"A cave interior filled with massive prismatic crystals, "
        f"rainbow light refracting through gems, a healing spring at center, {STYLE}"
    ),
    "loc_volcano_peak.png": (
        f"A volcanic mountain peak with lava flows and ash clouds, "
        f"dragon silhouette against the eruption, dramatic and dangerous, {STYLE}"
    ),
    "loc_dragons_lair.png": (
        f"A massive dark cavern entrance carved like a dragon skull, "
        f"glowing red eyes in the carved stone, treasure gold visible inside, {STYLE}"
    ),
    "loc_wanderers_camp.png": (
        f"A lonely campfire in a forest clearing at night, "
        f"a tent and bedroll beside it, stars visible through tree canopy, {STYLE}"
    ),

    # --- WHISPERING COAST BIOME ---
    # Coast locations
    "coast_starting_village.png": (
        f"A small coastal fishing village at dusk, thatched roof cottages on rocky cliffs, "
        f"fishing boats moored in a small harbor, warm lantern light, "
        f"fog rolling in from the sea, peaceful but ominous atmosphere, {STYLE}"
    ),
    "coast_fishermans_cove.png": (
        f"A rocky cove with torn fishing nets draped over boulders, "
        f"dark tide pools, scattered fish bones, claw marks on the rocks, "
        f"foggy coastal scene, something lurking in shallow water, {STYLE}"
    ),
    "coast_sea_cave.png": (
        f"The entrance to a dark sea cave carved into a cliff face, "
        f"bioluminescent blue algae glowing on the walls inside, "
        f"waves crashing at the entrance, mysterious and inviting, {STYLE}"
    ),
    "coast_shore_market.png": (
        f"An open-air market on a coastal pier with canvas awnings, "
        f"merchant stalls with potions and scrolls, lanterns hanging from ropes, "
        f"a few travelers browsing wares, evening coastal atmosphere, {STYLE}"
    ),
    "coast_lighthouse.png": (
        f"A tall stone lighthouse on a rocky promontory, its light extinguished, "
        f"dark storm clouds behind it, waves crashing against the base, "
        f"an ominous creature silhouette perched at the top, {STYLE}"
    ),
    "coast_tide_pools.png": (
        f"Warm steaming tide pools among coastal rocks at sunset, "
        f"a small campfire nearby, a bedroll under a rocky overhang, "
        f"peaceful resting spot with golden light, sea in the background, {STYLE}"
    ),
    "coast_driftwood_camp.png": (
        f"A chaotic pile of shipwreck driftwood on a beach, "
        f"broken masts and torn sails, dark nests built from wreckage, "
        f"something dangerous hiding among the debris, stormy sky, {STYLE}"
    ),
    "coast_storm_bluff.png": (
        f"A dramatic windswept cliff at the edge of the coast, "
        f"lightning crackling in the sky, a powerful drake silhouette against storm clouds, "
        f"the path forward leads to a dark forest visible in the distance, {STYLE}"
    ),

    # Coast enemies
    "enemy_coastal_serpent.png": (
        f"A massive sea serpent with iridescent blue and silver scales, "
        f"coiled around rocks in the ocean, glowing cyan eyes, "
        f"water dripping from its fangs, stormy sea background, portrait view, {STYLE}"
    ),
    "enemy_storm_drake.png": (
        f"A powerful storm drake with dark blue and electric purple scales, "
        f"lightning crackling between its horns and wings, "
        f"hovering above a cliff edge in a thunderstorm, portrait view, {STYLE}"
    ),

    # Coast map background (wide panoramic for scrollable map)
    "coast_map_bg.png": (
        f"A wide panoramic view of a misty coastline from above, "
        f"rocky shores, a small village, a lighthouse on a cliff, "
        f"foggy ocean stretching to the horizon, blue-grey color palette, "
        f"painted in the style of a fantasy game world map, atmospheric, {STYLE}"
    ),
}


def generate_image(prompt, filename, force=False, retries=3):
    """Call HF inference API and save the resulting image."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath) and not force:
        print(f"  [skip] {filename} already exists")
        return True

    if os.path.exists(filepath):
        os.remove(filepath)

    payload = {
        "inputs": prompt,
        "parameters": {
            "negative_prompt": NEG,
            "width": 512,
            "height": 512,
            "num_inference_steps": 30,
        },
    }

    for attempt in range(retries):
        try:
            print(f"  Generating {filename} (attempt {attempt + 1})...")
            resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=120)

            if resp.status_code == 503:
                wait = resp.json().get("estimated_time", 30)
                print(f"  Model loading, waiting {wait:.0f}s...")
                time.sleep(min(wait, 60))
                continue

            if resp.status_code == 429:
                print("  Rate limited, waiting 30s...")
                time.sleep(30)
                continue

            if resp.status_code != 200:
                print(f"  Error {resp.status_code}: {resp.text[:200]}")
                if attempt < retries - 1:
                    time.sleep(10)
                continue

            with open(filepath, "wb") as f:
                f.write(resp.content)
            print(f"  [done] {filename} ({len(resp.content) // 1024}KB)")
            return True

        except Exception as e:
            print(f"  Error: {e}")
            if attempt < retries - 1:
                time.sleep(10)

    print(f"  [FAIL] Could not generate {filename}")
    return False


def main():
    args = sys.argv[1:]

    if not HF_TOKEN:
        print("No HF_TOKEN set. Add it to .env or set the environment variable.")
        print("Get a free token at https://huggingface.co/settings/tokens")
        sys.exit(1)

    # Parse arguments
    force_all = "--all" in args
    if force_all:
        args.remove("--all")

    # Custom prompt mode: --prompt filename "prompt text"
    if "--prompt" in args:
        idx = args.index("--prompt")
        if len(args) < idx + 3:
            print("Usage: --prompt <filename> <prompt>")
            sys.exit(1)
        filename = args[idx + 1]
        prompt = args[idx + 2]
        print(f"Generating {filename} with custom prompt...")
        generate_image(prompt, filename, force=True)
        return

    # Specific files mode
    if args:
        targets = args
        print(f"Regenerating {len(targets)} specific image(s)...")
    else:
        targets = list(IMAGES.keys())
        print(f"Generating {len(targets)} images (skipping existing unless --all)...")

    print(f"Output: {OUTPUT_DIR}\n")

    success = 0
    for i, filename in enumerate(targets):
        if filename not in IMAGES:
            print(f"[{i + 1}/{len(targets)}] Unknown image: {filename}, skipping")
            continue
        print(f"[{i + 1}/{len(targets)}] {filename}")
        if generate_image(IMAGES[filename], filename, force=(force_all or filename in args)):
            success += 1
        time.sleep(2)

    print(f"\nDone: {success}/{len(targets)} images generated")


if __name__ == "__main__":
    main()
