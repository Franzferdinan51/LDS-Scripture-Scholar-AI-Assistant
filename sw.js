const CACHE_NAME = 'lds-scripture-scholar-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/services/geminiService.ts',
  '/utils/audio.ts',
  '/utils/file.ts',
  '/contexts/SettingsContext.tsx',
  '/components/ChatWindow.tsx',
  '/components/Sidebar.tsx',
  '/components/NotesPanel.tsx',
  '/components/JournalPanel.tsx',
  '/components/CrossReferencePanel.tsx',
  '/components/ScripturePanel.tsx',
  '/components/SettingsModal.tsx',
  '/components/HamburgerIcon.tsx',
  '/components/MessageBubble.tsx',
  '/components/ChatInput.tsx',
  '/components/LoadingDots.tsx',
  '/components/VoiceButton.tsx',
  '/components/SettingsIcon.tsx',
  '/components/ImageWithFallback.tsx',
  '/components/SpeakerIcon.tsx',
  '/components/PauseIcon.tsx',
  '/components/BookOpenIcon.tsx',
  '/components/ExplainIcon.tsx',
  '/components/MapIcon.tsx',
  '/components/WebIcon.tsx',
  '/components/ChatIcon.tsx',
  '/components/NoteIcon.tsx',
  '/components/JournalIcon.tsx',
  '/components/CrossReferenceIcon.tsx',
  '/components/CopyIcon.tsx',
  '/components/CheckIcon.tsx',
  '/components/StudyPlanView.tsx',
  '/components/MultiQuizView.tsx',
  '/components/LightbulbIcon.tsx',
  '/components/RetryIcon.tsx',
  '/components/StarIcon.tsx',
  '/components/PlusIcon.tsx',
  '/components/ThinkingIcon.tsx',
  '/components/SendIcon.tsx',
  '/data/book-of-mormon.json',
  '/data/doctrine-and-covenants.json',
  '/data/pearl-of-great-price.json',
  '/data/old-testament.json',
  '/data/new-testament.json',
  '/app-icon-192.png',
  '/app-icon-512.png',
  'https://i.imgur.com/AdUgfiQ.jpeg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        const cachePromises = urlsToCache.map(urlToCache => {
            const request = new Request(urlToCache, {mode: 'no-cors'});
            return cache.add(request).catch(err => {
                console.warn(`Could not cache ${urlToCache}:`, err);
            });
        });
        return Promise.all(cachePromises);
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
      return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});