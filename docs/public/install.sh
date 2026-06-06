#!/usr/bin/env bash
set -e

# Colors for output
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BLUE}================================================${RESET}"
echo -e "${BLUE}🤖 Nyxora Agent - Automated Installer${RESET}"
echo -e "${BLUE}================================================${RESET}"

# 1. Check Node.js availability
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js not found!${RESET}"
    echo "Nyxora requires Node.js version 18 or higher."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Error: Node.js version is too old! (v${NODE_VERSION})${RESET}"
    echo "Nyxora requires Node.js v18+. Please update your installation."
    exit 1
fi
echo -e "${GREEN}✓ Node.js (v$(node -v)) detected.${RESET}"

# 2. Check npm availability
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: NPM not found!${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ NPM detected.${RESET}"

# 3. Global Installation Process
echo -e "\n${YELLOW}📦 Downloading and installing nyxora globally from NPM Registry...${RESET}"
echo "Please wait a moment (this may require sudo/administrator privileges)."

# Try standard install, fallback to sudo if failed
if ! npm install -g nyxora; then
    echo -e "${YELLOW}⚠️ Standard installation failed. Retrying with sudo privileges...${RESET}"
    if ! sudo npm install -g nyxora; then
        echo -e "${RED}❌ Installation failed. Please run 'npm install -g nyxora' manually.${RESET}"
        exit 1
    fi
fi

echo -e "\n${GREEN}================================================${RESET}"
echo -e "${GREEN}🎉 INSTALLATION SUCCESSFUL!${RESET}"
echo -e "${GREEN}================================================${RESET}"
echo -e "\nNyxora Agent has been successfully installed on your machine."
echo -e "\n🚀 ${YELLOW}Next Steps:${RESET}"
echo -e "Run the following command in your terminal to begin the setup wizard:"
echo -e "\n   ${BLUE}nyxora setup${RESET}\n"
