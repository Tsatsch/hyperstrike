import aiohttp
import os

TELEGRAM_TOKEN = os.getenv("tgbot")

async def send_telegram(chat_id: str, message: str):
    print("inside send_telegram")
    chat_id = os.getenv("tgchat")
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    async with aiohttp.ClientSession() as session:
        await session.post(url, json={
            "chat_id": chat_id,
            "text": message
        })
