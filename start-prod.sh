#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Hyperstrike Production Environment${NC}"

# Function to handle cleanup on script exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all processes...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  pnpm is not installed. Installing pnpm...${NC}"
    npm install -g pnpm
fi

# Check if poetry is installed
if ! command -v poetry &> /dev/null; then
    echo -e "${YELLOW}⚠️  poetry is not installed. Please install poetry first:${NC}"
    echo "curl -sSL https://install.python-poetry.org | python3 -"
    exit 1
fi

# Install frontend dependencies
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd frontend
pnpm install
cd ..

# Install backend dependencies
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
cd backend
poetry install
cd ..

# Build frontend for production
echo -e "${BLUE}🔨 Building frontend for production...${NC}"
cd frontend
if pnpm build; then
    echo -e "${GREEN}✅ Frontend build successful!${NC}"
else
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi
cd ..

# Start frontend in production mode (background)
echo -e "${GREEN}🌐 Starting frontend (Next.js production)...${NC}"
cd frontend
pnpm start &
FRONTEND_PID=$!
cd ..

# Start backend in production mode (background)
echo -e "${GREEN}🔧 Starting backend (FastAPI production)...${NC}"
cd backend
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}✅ Both services are starting up in production mode!${NC}"
echo -e "${BLUE}📱 Frontend: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Backend: http://localhost:8000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for both processes
wait $FRONTEND_PID $BACKEND_PID
