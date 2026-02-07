#!/bin/bash

# BoxHero API Integration Setup Script
# This script helps set up the BoxHero API integration with proper dependencies

echo "🚀 Setting up BoxHero API Integration..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
echo "📋 Node.js version: $(node -v)"

if [ "$NODE_VERSION" -lt 14 ]; then
    echo "⚠️  Warning: Node.js version 14+ is recommended for better fetch support"
fi

# Install/update node-fetch to version 2 (CommonJS compatible)
echo "📦 Installing node-fetch v2 for Node.js compatibility..."
npm install node-fetch@2.7.0

# Verify installation
if npm list node-fetch &> /dev/null; then
    echo "✅ node-fetch installed successfully"
    echo "📋 Version: $(npm list node-fetch --depth=0 | grep node-fetch)"
else
    echo "❌ Failed to install node-fetch"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from example..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ Created .env file from env.example"
        echo "🔧 Please update BOXHERO_API_TOKEN in .env file"
    else
        echo "❌ env.example file not found"
    fi
else
    echo "✅ .env file exists"
fi

# Check if BOXHERO_API_TOKEN is set
if grep -q "BOXHERO_API_TOKEN=" .env && ! grep -q "BOXHERO_API_TOKEN=your-boxhero-api-token-here" .env; then
    echo "✅ BOXHERO_API_TOKEN appears to be configured"
else
    echo "⚠️  Please set BOXHERO_API_TOKEN in .env file"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update BOXHERO_API_TOKEN in .env file"
echo "2. Run: npm run db:generate"
echo "3. Run: npm run db:push"
echo "4. Start server: npm run dev"
echo "5. Test API: node test-real-boxhero-api.js"
echo ""
echo "🔧 Troubleshooting:"
echo "- If you get 'fetch is not a function', run: npm install node-fetch@2.7.0"
echo "- If you get module errors, try: npm install"
echo "- Check Node.js version: node -v (should be 14+)"



