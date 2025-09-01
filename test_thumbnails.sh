#!/bin/bash
echo "=== Testing CWA Thumbnail Sizes ==="
echo

# Test book ID 46778 with different resolutions
echo "ORIGINAL:" 
curl -s "http://localhost:8084/api/cwa/library/books/46778/cover" -o /tmp/test_original.jpg
ls -lh /tmp/test_original.jpg | awk '{print "  Size: " $5}'

echo "SMALL (sm):"
curl -s "http://localhost:8084/api/cwa/library/books/46778/cover/sm" -o /tmp/test_small.jpg  
ls -lh /tmp/test_small.jpg | awk '{print "  Size: " $5}'

echo "MEDIUM (md):"
curl -s "http://localhost:8084/api/cwa/library/books/46778/cover/md" -o /tmp/test_medium.jpg
ls -lh /tmp/test_medium.jpg | awk '{print "  Size: " $5}'

echo "LARGE (lg):"
curl -s "http://localhost:8084/api/cwa/library/books/46778/cover/lg" -o /tmp/test_large.jpg
ls -lh /tmp/test_large.jpg | awk '{print "  Size: " $5}'

echo
echo "=== Image Dimensions ==="
file /tmp/test_small.jpg | grep -o '[0-9]*x[0-9]*' | head -1 | sed 's/^/SMALL: /'
file /tmp/test_medium.jpg | grep -o '[0-9]*x[0-9]*' | head -1 | sed 's/^/MEDIUM: /'
file /tmp/test_large.jpg | grep -o '[0-9]*x[0-9]*' | head -1 | sed 's/^/LARGE: /'
