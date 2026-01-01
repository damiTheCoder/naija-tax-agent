#!/bin/bash

# Comprehensive fix for all inventory pages
cd app/inventory

# Find and process all .tsx files
for file in $(find . -name "*.tsx"); do
    echo "Processing $file..."
    
    # Fix pattern 1: }} border
    sed -i '' 's/bg-white }} border border-gray-200/bg-white/g' "$file"
    
    # Fix pattern 2: }} text-center
    sed -i '' 's/ }} text-center"/ text-center bg-white"/g' "$file"
    
    # Fix pattern 3: Remove any dangling style attributes
    sed -i '' 's/ style={{ background: '\''var(--card-bg)'\'' }}//g' "$file"
    
    # Fix pattern 4: Remove border classes
    sed -i '' 's/ border border-gray-200 dark:border-gray-700\/50//g' "$file"
    sed -i '' 's/ border border-gray-200 dark:border-gray-700//g' "$file"
    
    echo "Fixed $file"
done

echo "All inventory files fixed!"
