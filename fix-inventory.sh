#!/bin/bash

# Fix all inventory page files
for file in app/inventory/*.tsx app/inventory/**/page.tsx; do
  if [ -f "$file" ]; then
    # Fix broken JSX syntax
    sed -i '' 's/className="rounded-2xl  shadow-sm" style={{ background: '\''var(--card-bg)'\'' className="p-4" style={{ background: '\''var(--card-bg)'\'' }}/className="rounded-2xl bg-white p-4"/g' "$file"
    
    sed -i '' 's/className="rounded-2xl  shadow-sm" style={{ background: '\''var(--card-bg)'\'' className="overflow-hidden" style={{ background: '\''var(--card-bg)'\'' }}/className="rounded-2xl bg-white overflow-hidden"/g' "$file"
    
    # Remove any remaining broken patterns
    sed -i '' 's/}} p-4"/className="bg-white p-4"/g' "$file"
    sed -i '' 's/}} overflow-hidden"/className="bg-white overflow-hidden"/g' "$file"
    
    echo "Fixed $file"
  fi
done

echo "All files fixed!"
