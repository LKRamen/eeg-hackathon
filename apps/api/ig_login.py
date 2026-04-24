#!/usr/bin/env python3
"""
One-time Instagram login — saves a session file so the scraper
never needs to log in again.

Usage:
    python ig_login.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

import os
import instaloader

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

ig_user = os.environ.get("IG_USERNAME") or input("Instagram username: ")
ig_pass = os.environ.get("IG_PASSWORD") or input("Instagram password: ")

L = instaloader.Instaloader()

print(f"Logging in as @{ig_user}...")
try:
    L.login(ig_user, ig_pass)
    session_path = CACHE_DIR / f"ig_session.{ig_user}"
    L.save_session_to_file(str(session_path))
    print(f"✓ Session saved to {session_path}")
    print("  The scraper will reuse this session — no more logins needed.")
except Exception as e:
    print(f"✗ Login failed: {e}")
    print()
    print("Common causes:")
    print("  - Wrong username or password")
    print("  - Instagram sent a verification code to your email/phone")
    print("    → Log in at instagram.com first, approve the device, then retry")
    print("  - Account is too new or flagged as suspicious")
    sys.exit(1)
