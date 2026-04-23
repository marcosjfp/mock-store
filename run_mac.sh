#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

install_deps=true
run_apps=true

for arg in "$@"; do
  case "$arg" in
    --deps-only|-d)
      install_deps=true
      run_apps=false
      ;;
    --run-only|-r)
      install_deps=false
      run_apps=true
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./run_mac.sh [--deps-only|-d] [--run-only|-r]"
      exit 1
      ;;
  esac
done

assert_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command '$1' was not found in PATH."
    exit 1
  fi
}

resolve_python() {
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi
  if command -v python >/dev/null 2>&1; then
    echo "python"
    return
  fi
  echo "Python 3.10+ is required but was not found." >&2
  exit 1
}

assert_command npm
PYTHON_CMD="$(resolve_python)"

VENV_DIR="$ROOT_DIR/backend/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "[setup] Creating backend virtual environment..."
  "$PYTHON_CMD" -m venv "$VENV_DIR"
fi

if [[ "$install_deps" == true ]]; then
  echo "[setup] Installing backend dependencies..."
  "$VENV_PIP" install --upgrade pip
  "$VENV_PIP" install -r "$ROOT_DIR/backend/requirements.txt"

  echo "[setup] Installing frontend dependencies..."
  (
    cd "$ROOT_DIR/frontend"
    npm install
  )
fi

BACKEND_ENV_FILE="$ROOT_DIR/backend/.env"
if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  echo "[setup] Creating backend .env for local macOS run..."
  cat > "$BACKEND_ENV_FILE" << 'EOF'
DATABASE_URL=sqlite+aiosqlite:///./dev.db
REDIS_ENABLED=false
RABBITMQ_ENABLED=false
SECRET_KEY=dev-secret-key-change-me
CORS_ORIGINS=["http://localhost:5173"]
EOF
fi

if [[ "$run_apps" == true ]]; then
  if [[ ! -x "$VENV_PYTHON" ]]; then
    echo "Missing backend virtual environment. Run ./run_mac.sh --deps-only first."
    exit 1
  fi

  echo "[setup] Applying backend migrations..."
  (
    cd "$ROOT_DIR/backend"
    "$VENV_PYTHON" -m alembic upgrade head
  )

  echo "[run] Starting backend..."
  (
    cd "$ROOT_DIR/backend"
    "$VENV_PYTHON" -m uvicorn app.main:app --reload
  ) &
  BACKEND_PID=$!

  cleanup() {
    if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
      echo
      echo "[cleanup] Stopping backend (PID: $BACKEND_PID)..."
      kill "$BACKEND_PID" >/dev/null 2>&1 || true
    fi
  }

  trap cleanup EXIT INT TERM

  echo "[run] Starting frontend (press Ctrl+C to stop)..."
  (
    cd "$ROOT_DIR/frontend"
    npm run dev
  )
fi

echo "Done."
