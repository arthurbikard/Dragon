import requests
import os

# Hugging Face API URL for image generation
API_URL = 'https://api-inference.huggingface.co/models/<model_name>'

# Function to generate images
def generate_dragon_images(num_images=5):
    headers = { 'Authorization': 'Bearer <your_huggingface_token>' }
    os.makedirs('images', exist_ok=True)  # Create images folder if it doesn't exist

    for i in range(num_images):
        response = requests.post(API_URL, headers=headers)
        if response.status_code == 200:
            with open(f'images/dragon_image_{i + 1}.png', 'wb') as f:
                f.write(response.content)
            print(f'Dragon image {i + 1} generated.')
        else:
            print(f'Error generating image {i + 1}: {response.status_code} - {response.text}')

if __name__ == '__main__':
    generate_dragon_images()