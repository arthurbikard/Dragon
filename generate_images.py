import requests
import os
from datetime import datetime

def generate_dragon_images(num_images=4):
    """Generate dragon card images using Hugging Face free API"""
    
    os.makedirs('images', exist_ok=True)
    
    dragon_types = [
        {
            'name': 'fire_dragon',
            'prompt': 'A realistic majestic fire dragon with red and orange scales, breathing flames, fantasy art style, high quality'
        },
        {
            'name': 'water_dragon',
            'prompt': 'A realistic water dragon with blue scales, swimming through water, fantasy art style, high quality'
        },
        {
            'name': 'earth_dragon',
            'prompt': 'A realistic earth dragon with brown and green scales, standing on rocky ground, fantasy art style, high quality'
        },
        {
            'name': 'air_dragon',
            'prompt': 'A realistic air dragon with white and silver scales, flying in clouds, fantasy art style, high quality'
        }
    ]
    
    # Using Hugging Face free inference API (no authentication required)
    api_url = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5"
    
    for dragon in dragon_types[:num_images]:
        try:
            print(f"Generating {dragon['name']}...")
            
            payload = {"inputs": dragon['prompt']}
            headers = {"Content-Type": "application/json"}
            
            response = requests.post(api_url, headers=headers, json=payload, timeout=120)
            
            if response.status_code == 200:
                filename = f"images/{dragon['name']}.png"
                with open(filename, 'wb') as f:
                    f.write(response.content)
                print(f"✓ Generated: {filename}")
            else:
                print(f"✗ Error for {dragon['name']}: {response.status_code}")
                
        except Exception as e:
            print(f"✗ Exception generating {dragon['name']}: {str(e)}")

if __name__ == '__main__':
    print(f"Starting image generation at {datetime.now()}")
    generate_dragon_images(4)
    print("Image generation complete!")