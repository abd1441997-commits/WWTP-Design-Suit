#!/usr/bin/env bash
# Creates the Android upload/signing key ONCE. Keep the .jks file and passwords somewhere safe:
# every future update of the app must be signed with this same key.
set -euo pipefail
KS="${1:-wwtp-release.jks}"; ALIAS="${2:-wwtp}"
read -r -s -p "Choose a keystore password (min 6 chars): " PW; echo
keytool -genkeypair -v -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PW" -keypass "$PW" -dname "CN=Abdelrahman Elwishy, OU=Proposal & Designing Department, O=Industrial WWTP Design Suite, C=EG"
echo; echo "Created $KS (alias: $ALIAS). Add these four GitHub repository secrets:"
echo "  ANDROID_KEYSTORE_BASE64   = $(base64 -w0 "$KS" 2>/dev/null | cut -c1-24)...  (run: base64 -w0 $KS   [macOS: base64 -i $KS])"
echo "  ANDROID_KEYSTORE_PASSWORD = the password you just typed"
echo "  ANDROID_KEY_ALIAS         = $ALIAS"
echo "  ANDROID_KEY_PASSWORD      = the same password"
