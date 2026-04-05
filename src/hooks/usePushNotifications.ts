'use client'
// ============================================================
// usePushNotifications — FCM client-side hook
// Handles permission request, token registration, subscription
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'
import { getApp } from 'firebase/app'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? ''

interface UsePushReturn {
  permission:   NotificationPermission | 'default'
  token:        string | null
  isSupported:  boolean
  isLoading:    boolean
  requestPermission: () => Promise<void>
}

export function usePushNotifications(uid?: string): UsePushReturn {
  const [permission,  setPermission]  = useState<NotificationPermission | 'default'>('default')
  const [token,       setToken]       = useState<string | null>(null)
  const [isLoading,   setIsLoading]   = useState(false)
  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator

  // Register service worker + sync config vars on init
  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission)

    // If already granted, try to get token silently
    if (Notification.permission === 'granted') {
      getAndSaveToken(uid).catch(console.warn)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // FCM foreground message handler
  useEffect(() => {
    if (!isSupported || !token) return
    let messaging: Messaging
    try {
      messaging = getMessaging(getApp())
    } catch { return }

    const unsubscribe = onMessage(messaging, payload => {
      const n = payload.notification
      if (n?.title) {
        new Notification(n.title, {
          body:  n.body  ?? '',
          icon:  '/icons/icon-192.png',
          data:  payload.data,
        })
      }
    })
    return () => unsubscribe()
  }, [token, isSupported])

  const getAndSaveToken = useCallback(async (userId?: string) => {
    try {
      // Register SW first (it must be at /firebase-messaging-sw.js)
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      const messaging    = getMessaging(getApp())

      const fcmToken = await getToken(messaging, {
        vapidKey:         VAPID_KEY,
        serviceWorkerRegistration: registration,
      })

      if (!fcmToken) return

      setToken(fcmToken)

      // Save token to backend
      await fetch('/api/notifications/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: fcmToken, uid: userId ?? null, topics: ['signals'] }),
      })
    } catch (err) {
      console.warn('FCM token failed:', err)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!isSupported) return
    setIsLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        await getAndSaveToken(uid)
      }
    } finally {
      setIsLoading(false)
    }
  }, [uid, getAndSaveToken, isSupported])

  return { permission, token, isSupported, isLoading, requestPermission }
}
