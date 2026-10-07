#!/usr/bin/env bash

set -euo pipefail

IDENTITY_NAME="OpenVocaly Local Signing"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

log() {
  echo "[openvocaly] $*"
}

fail() {
  echo "[openvocaly] Error: $*" >&2
  exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<EOF
Create a self-signed code signing certificate named "$IDENTITY_NAME" in your
login keychain, once per Mac. build-and-install-macos.sh signs with it
automatically, so macOS keeps Microphone and Accessibility permissions across
rebuilds. No Apple Developer account is involved; the certificate never leaves
this Mac.

macOS asks for your password once, to trust the certificate for code signing.

Remove it later with:
  security delete-identity -c "$IDENTITY_NAME" "$KEYCHAIN"
EOF
  exit 0
fi

allow_codesign_without_prompts() {
  log "Letting codesign use the key without a prompt per file (enter your login password)..."
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -l "$IDENTITY_NAME" -t private "$KEYCHAIN" >/dev/null ||
    log "Could not pre-approve codesign. On the first build, enter your login password and click Always Allow (not Allow)."
}

if security find-identity -v -p codesigning | grep -q "\"$IDENTITY_NAME\""; then
  log "\"$IDENTITY_NAME\" already exists and is valid for code signing."
  allow_codesign_without_prompts
  exit 0
fi

if security find-certificate -c "$IDENTITY_NAME" "$KEYCHAIN" >/dev/null 2>&1; then
  fail "A certificate named \"$IDENTITY_NAME\" exists but is not trusted for code signing.
Delete it and rerun this script:
  security delete-identity -c \"$IDENTITY_NAME\" \"$KEYCHAIN\""
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
p12_password="$(uuidgen)"

cat >"$work_dir/cert.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $IDENTITY_NAME
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
EOF

log "Creating the certificate..."
/usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 7300 \
  -config "$work_dir/cert.cnf" -keyout "$work_dir/key.pem" -out "$work_dir/cert.pem" 2>/dev/null
/usr/bin/openssl pkcs12 -export -inkey "$work_dir/key.pem" -in "$work_dir/cert.pem" \
  -name "$IDENTITY_NAME" -out "$work_dir/identity.p12" -passout "pass:$p12_password"

log "Importing it into the login keychain..."
security import "$work_dir/identity.p12" -k "$KEYCHAIN" -P "$p12_password" -T /usr/bin/codesign >/dev/null
allow_codesign_without_prompts

log "Trusting it for code signing (macOS asks for your password)..."
security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$work_dir/cert.pem"

security find-identity -v -p codesigning | grep -q "\"$IDENTITY_NAME\"" ||
  fail "The certificate was imported but macOS does not list it as a valid signing identity."

log "Done. The next ./scripts/build-and-install-macos.sh signs with \"$IDENTITY_NAME\"."
log "The first install after this resets the permissions once; later rebuilds keep them."
