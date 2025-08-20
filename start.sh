#!/usr/bin/env bash
set -euo pipefail
# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Hyperstrike Development Environment${NC}"

# Function to handle cleanup on script exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all processes...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM




apt_install() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y "$@"
  fi
}

# Ensure curl + python3 exist
command -v curl >/dev/null 2>&1 || apt_install curl
command -v python3 >/dev/null 2>&1 || apt_install python3 python3-venv



# PNPM (bootstrap even if npm is missing)
if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  pnpm not found. Installing pnpm...${NC}"
  if command -v npm >/dev/null 2>&1; then
    npm install -g pnpm
  else
    # npm isn't available: use official pnpm installer
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
  fi
fi

# Poetry
if ! command -v poetry >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  poetry not found. Installing poetry...${NC}"
  curl -sSL https://install.python-poetry.org | python3 -
  export PATH="$HOME/.local/bin:$PATH"
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

# Start frontend in background
echo -e "${GREEN}🌐 Starting frontend (Next.js)...${NC}"
cd frontend
pnpm dev --port 3000 --hostname 0.0.0.0 &
FRONTEND_PID=$!
cd ..

# Start backend in background
echo -e "${GREEN}🔧 Starting backend (FastAPI)...${NC}"
cd backend
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}✅ Both services are starting up!${NC}"
echo -e "${BLUE}📱 Frontend: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Backend: http://localhost:8000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for both processes
wait $FRONTEND_PID $BACKEND_PID 