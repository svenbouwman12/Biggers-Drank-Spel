#!/bin/bash

# ============================================================================
# DRANKSPEL MULTIPLAYER - Deployment Script
# ============================================================================

echo "🚀 Starting Drankspel Multiplayer Deployment"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the right directory?"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    print_error "Git repository not found. Please initialize git first."
    exit 1
fi

# Check if all files are committed
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Uncommitted changes detected. Committing them now..."
    git add .
    git commit -m "🚀 Deploy to Vercel - $(date)"
fi

# Check if we're on main branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    print_warning "Not on main branch. Current branch: $current_branch"
    read -p "Do you want to continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled."
        exit 1
    fi
fi

# Push to GitHub
print_status "Pushing to GitHub..."
git push origin main
if [ $? -eq 0 ]; then
    print_success "Code pushed to GitHub successfully!"
else
    print_error "Failed to push to GitHub. Please check your git configuration."
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_warning "Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    print_warning "Not logged in to Vercel. Please login first:"
    echo "Run: vercel login"
    exit 1
fi

# Deploy to Vercel
print_status "Deploying to Vercel..."
vercel --prod

if [ $? -eq 0 ]; then
    print_success "Deployment successful!"
    echo ""
    echo "🎉 Your Drankspel Multiplayer app is now live!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Test your app at the Vercel URL"
    echo "2. Configure custom domain (optional)"
    echo "3. Set up monitoring and analytics"
    echo ""
    echo "🔧 Don't forget to:"
    echo "- Install database schema in Supabase"
    echo "- Update CORS settings in Supabase"
    echo "- Test all features"
    echo ""
    print_success "Deployment completed successfully! 🚀"
else
    print_error "Deployment failed. Please check the error messages above."
    exit 1
fi
