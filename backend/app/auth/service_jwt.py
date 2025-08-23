import jwt, os, datetime
from jwt import encode
import dotenv
dotenv.load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET")
print(JWT_SECRET)

def generate_service_jwt():
    payload = {
        "sub": "system_worker",
        "role": "internal",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

print(generate_service_jwt())