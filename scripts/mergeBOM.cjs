/**
 * Merge BOM data from part1 + part2 into main book-of-mormon.json
 */

const fs = require('fs');

const p2 = JSON.parse(fs.readFileSync('data/book-of-mormon-part2.json', 'utf8'));
console.log('Part2:', p2.metadata?.title);
console.log('Part2 books:', p2.books?.length);
console.log('Part2 first book:', p2.books?.[0]?.title);

// Parse part1
const raw1 = fs.readFileSync('data/book-of-mormon-part1.json', 'utf8');

// Try to find where the JSON breaks
let lastGood = 0;
for (let i = 0; i < raw1.length; i += 10000) {
  try {
    JSON.parse(raw1.slice(0, i));
    lastGood = i;
  } catch (e) {}
}
console.log('Part1 valid up to:', lastGood, 'of', raw1.length);

// Try binary search for exact break point
let lo = lastGood, hi = lastGood + 100000;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  try {
    JSON.parse(raw1.slice(0, mid));
    lo = mid + 1;
  } catch (e) { hi = mid; }
}
const validLen = lo - 1;
console.log('Part1 valid length:', validLen);

const truncJson = raw1.slice(0, validLen);
// Find last complete book
const booksMatch = truncJson.match(/"books"\s*:\s*\[/);
if (booksMatch) {
  console.log('Part1 books array found at:', booksMatch.index);
}

// Close the JSON properly
let closeJson = truncJson;
// Remove trailing incomplete object
const lastComma = closeJson.lastIndexOf(',');
if (lastComma > validLen - 500) {
  closeJson = closeJson.slice(0, lastComma);
}
closeJson += ']}';

try {
  const p1 = JSON.parse(closeJson);
  console.log('Part1 parsed! Books:', p1.books?.length);

  // Merge p1 and p2
  const merged = [...p1.books];
  const p2Book = p2.books?.[0];
  if (p2Book) merged.push(p2Book);

  const mainBom = JSON.parse(fs.readFileSync('data/book-of-mormon.json', 'utf8'));
  mainBom.books = merged;

  fs.writeFileSync('data/book-of-mormon.json', JSON.stringify(mainBom, null, 2));

  // Count
  let v = 0;
  merged.forEach(b => { b.chapters?.forEach(c => { if (c.verses) v += c.verses.length; }); });
  console.log('Merged BOM:', merged.length, 'books,', v, 'verses');
  console.log('Books:', merged.map(b => b.title || b.book).join(', '));
} catch (e) {
  console.log('Merge error:', e.message);
}