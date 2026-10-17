import argparse
import getpass
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.auth import password_hash


def main():
    parser = argparse.ArgumentParser(description="Hash a LunchLoop school password")
    parser.parse_args()
    password = getpass.getpass() if sys.stdin.isatty() else sys.stdin.read().rstrip("\n")
    print(password_hash(password))


if __name__ == "__main__":
    main()
