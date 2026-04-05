// Firebase Messaging Service Worker — FCM Background Push Handler
// This file must be at /public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config (same as client — no secrets, public values only)
const firebaseConfig = {
  apiKey:            self.__FIREBASE_API_KEY__,
  authDomain:        self.__FIREBASE_AUTH_DOMAIN__,
  projectId:         self.__FIREBASE_PROJECT_ID__,
  storageBucket:     self.__FIREBASE_STORAGE_BUCKET__,
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__,
  appId:             self.__FIREBASE_APP_ID__,
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message:', payload);

  const notification = payload.notification ?? {};
  const data         = payload.data ?? {};

  self.registration.showNotification(notification.title ?? 'FATH AI Signal', {
    body:  notification.body ?? '',
    icon:  '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    image: notification.image,
    data:  { url: data.clickAction ?? data.link ?? '/', ...data },
    actions: [
      { action: 'view',    title: 'Ko\'rish' },
      { action: 'dismiss', title: 'Yopish'   },
    ],
    tag:     data.signalId ?? 'notification',
    renotify: true,
  });
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
