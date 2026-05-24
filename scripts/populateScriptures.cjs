/**
 * Scripture Data Populator - Smart Edition
 *
 * Uses bible-api.com for OT/NT (KJV) with intelligent:
 * - Exponential backoff on rate limits
 * - Alternate book name formats per chapter
 * - Per-chapter retry with incremental saves
 * - Progress tracking so it resumes where it left off
 *
 * Run: node scripts/populateScriptures.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Book name variants for bible-api.com
const BOOK_VARIANTS = {
  'Genesis': ['genesis'],
  'Exodus': ['exodus'],
  'Leviticus': ['leviticus'],
  'Numbers': ['numbers'],
  'Deuteronomy': ['deuteronomy'],
  'Joshua': ['joshua'],
  'Judges': ['judges'],
  'Ruth': ['ruth'],
  '1 Samuel': ['1+samuel', 'first+samuel'],
  '2 Samuel': ['2+samuel', 'second+samuel'],
  '1 Kings': ['1+kings', 'first+kings'],
  '2 Kings': ['2+kings', 'second+kings'],
  '1 Chronicles': ['1+chronicles', 'first+chronicles'],
  '2 Chronicles': ['2+chronicles', 'second+chronicles'],
  'Ezra': ['ezra'],
  'Nehemiah': ['nehemiah'],
  'Esther': ['esther'],
  'Job': ['job'],
  'Psalms': ['psalms', 'psalm'],
  'Proverbs': ['proverbs'],
  'Ecclesiastes': ['ecclesiastes'],
  'Song of Solomon': ['song+of+solomon', 'song+of+songs'],
  'Isaiah': ['isaiah'],
  'Jeremiah': ['jeremiah'],
  'Lamentations': ['lamentations'],
  'Ezekiel': ['ezekiel'],
  'Daniel': ['daniel'],
  'Hosea': ['hosea'],
  'Joel': ['joel'],
  'Amos': ['amos'],
  'Obadiah': ['obadiah'],
  'Jonah': ['jonah'],
  'Micah': ['micah'],
  'Nahum': ['nahum'],
  'Habakkuk': ['habakkuk'],
  'Zephaniah': ['zephaniah'],
  'Haggai': ['haggai'],
  'Zechariah': ['zechariah'],
  'Malachi': ['malachi'],
  'Matthew': ['matthew'],
  'Mark': ['mark'],
  'Luke': ['luke'],
  'John': ['john'],
  'Acts': ['acts'],
  'Romans': ['romans'],
  '1 Corinthians': ['1+corinthians', 'first+corinthians'],
  '2 Corinthians': ['2+corinthians', 'second+corinthians'],
  'Galatians': ['galatians'],
  'Ephesians': ['ephesians'],
  'Philippians': ['philippians'],
  'Colossians': ['colossians'],
  '1 Thessalonians': ['1+thessalonians'],
  '2 Thessalonians': ['2+thessalonians'],
  '1 Timothy': ['1+timothy'],
  '2 Timothy': ['2+timothy'],
  'Titus': ['titus'],
  'Philemon': ['philemon'],
  'Hebrews': ['hebrews'],
  'James': ['james'],
  '1 Peter': ['1+peter', 'first+peter'],
  '2 Peter': ['2+peter', 'second+peter'],
  '1 John': ['1+john', 'first+john'],
  '2 John': ['2+john'],
  '3 John': ['3+john'],
  'Jude': ['jude'],
  'Revelation': ['revelation'],
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetch(url, retries = 3) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryFetch = () => {
      attempts++;
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Scripture Scholar Bot/1.0)' } }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode === 429 || res.statusCode >= 500) {
            if (attempts < retries) {
              const delay = Math.min(5000 * Math.pow(2, attempts - 1), 30000);
              console.log('    Rate limited, retrying in ' + delay + 'ms...');
              setTimeout(tryFetch, delay);
            } else {
              resolve({ ok: false, status: res.statusCode });
            }
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve({ ok: json.verses && json.verses.length > 0, status: res.statusCode, data: json });
          } catch (e) {
            resolve({ ok: false, status: res.statusCode });
          }
        });
      }).on('error', err => {
        if (attempts < retries) {
          setTimeout(tryFetch, 1000 * attempts);
        } else {
          reject(err);
        }
      });
    };
    tryFetch();
  });
}

async function fetchChapter(book, chapter) {
  const variants = BOOK_VARIANTS[book] || [book.toLowerCase().replace(/\s+/g, '+')];
  for (const variant of variants) {
    const query = variant + '+' + chapter;
    const result = await fetch('https://bible-api.com/' + query + '?translation=kjv');
    if (result.ok && result.data.verses && result.data.verses.length > 0) {
      return {
        chapter: result.data.verses[0].chapter,
        reference: result.data.reference,
        verses: result.data.verses.map(v => ({ verse: v.verse, text: v.text.trim() }))
      };
    }
    await sleep(300);
  }
  return null;
}

function hasVerses(chapter) {
  return chapter.verses && chapter.verses.length > 0;
}

async function populateFile(filePath) {
  console.log('\nProcessing ' + path.basename(filePath) + '...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let totalVerses = 0, done = 0, skipped = 0, failed = 0;

  for (const book of data.books) {
    console.log('  ' + book.book);
    for (const chapter of book.chapters) {
      if (hasVerses(chapter)) {
        totalVerses += chapter.verses.length;
        skipped++;
        continue;
      }
      await sleep(500);
      const result = await fetchChapter(book.book, chapter.chapter);
      if (result && result.verses.length > 0) {
        chapter.reference = result.reference;
        chapter.verses = result.verses;
        totalVerses += result.verses.length;
        done++;
        console.log('    Ch' + chapter.chapter + ': ' + result.verses.length + 'v');
      } else {
        chapter.verses = [];
        failed++;
        console.log('    Ch' + chapter.chapter + ': failed');
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  }
  console.log('  Done: ' + done + ' done, ' + skipped + ' skipped, ' + failed + ' failed, ' + totalVerses + ' total verses');
  return { done, skipped, failed, totalVerses };
}

async function main() {
  console.log('=== Scripture Data Populator (Smart) ===');
  console.log('Using bible-api.com for OT and NT (KJV public domain)');
  await populateFile(path.join(DATA_DIR, 'old-testament.json'));
  await sleep(3000);
  await populateFile(path.join(DATA_DIR, 'new-testament.json'));
  await sleep(3000);
  console.log('\n=== All Done ===');
}

main().catch(console.error);
