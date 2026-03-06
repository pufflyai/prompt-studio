#!/usr/bin/env sh
set -e

REPO="pufflyai/prompt-studio"
BIN_NAME="pstdio"

is_musl() {
  if command -v ldd >/dev/null 2>&1; then
    ldd /bin/sh 2>/dev/null | grep -qi musl && return 0
  fi
  return 1
}

detect_platform() {
  OS=$(uname -s)
  ARCH=$(uname -m)

  case "$OS" in
    Darwin)
      case "$ARCH" in
        arm64)  echo "darwin-arm64" ;;
        x86_64) echo "darwin-x64" ;;
        *)      echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
      esac
      ;;
    Linux)
      SUFFIX=""
      if is_musl; then
        SUFFIX="-musl"
      fi
      case "$ARCH" in
        x86_64)        echo "linux-x64${SUFFIX}" ;;
        aarch64|arm64) echo "linux-arm64${SUFFIX}" ;;
        *)             echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
      esac
      ;;
    *)
      echo "Unsupported OS: $OS" >&2
      exit 1
      ;;
  esac
}

download() {
  URL="$1"
  DEST="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$DEST"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$DEST" "$URL"
  else
    echo "Error: curl or wget is required to download pstdio." >&2
    exit 1
  fi
}

verify_checksum() {
  ASSET="$1"
  DEST="$2"
  CHECKSUMS_URL="https://github.com/${REPO}/releases/latest/download/checksums.sha256"
  CHECKSUMS_FILE=$(mktemp)

  download "$CHECKSUMS_URL" "$CHECKSUMS_FILE" 2>/dev/null || {
    echo "Warning: Could not download checksums file, skipping verification." >&2
    rm -f "$CHECKSUMS_FILE"
    return 0
  }

  EXPECTED=$(grep "$ASSET" "$CHECKSUMS_FILE" | awk '{print $1}')
  rm -f "$CHECKSUMS_FILE"

  if [ -z "$EXPECTED" ]; then
    echo "Warning: No checksum found for $ASSET, skipping verification." >&2
    return 0
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL=$(sha256sum "$DEST" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL=$(shasum -a 256 "$DEST" | awk '{print $1}')
  else
    echo "Warning: sha256sum/shasum not found, skipping checksum verification." >&2
    return 0
  fi

  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "Error: Checksum mismatch for $ASSET" >&2
    echo "  Expected: $EXPECTED" >&2
    echo "  Actual:   $ACTUAL" >&2
    rm -f "$DEST"
    exit 1
  fi

  echo "Checksum verified."
}

PLATFORM=$(detect_platform)
ASSET="${BIN_NAME}-${PLATFORM}"
URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

# Prefer /usr/local/bin if writable, otherwise ~/.local/bin
if [ -w /usr/local/bin ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="${HOME}/.local/bin"
  mkdir -p "$INSTALL_DIR"
fi

DEST="${INSTALL_DIR}/${BIN_NAME}"

echo "Downloading pstdio for ${PLATFORM}..."
download "$URL" "$DEST"
verify_checksum "$ASSET" "$DEST"
chmod +x "$DEST"

echo "Installed pstdio to ${DEST}"

# Verify the binary works
if "$DEST" --version >/dev/null 2>&1; then
  echo "pstdio $("$DEST" --version) is ready."
else
  echo "Warning: pstdio installed but --version check failed." >&2
fi

# Remind about PATH if using ~/.local/bin
if [ "$INSTALL_DIR" = "${HOME}/.local/bin" ]; then
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *) echo "Add ${INSTALL_DIR} to your PATH to use pstdio globally." ;;
  esac
fi
