import requests

response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "llama3",
        "prompt": "Explain chest pain",
        "stream": False   # ✅ IMPORTANT FIX
    }
)

data = response.json()
print(data["response"])