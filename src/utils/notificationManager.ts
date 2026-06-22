/**
 * 通知管理工具
 */

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
}

export class NotificationManager {
  static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied'
    }
    if (Notification.permission !== 'default') {
      return Notification.permission
    }
    return Notification.requestPermission()
  }

  static async showNotification(options: NotificationOptions): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/notification-icon.png',
      badge: options.badge,
      tag: options.tag,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  static scheduleNotification(
    options: NotificationOptions,
    delayMs: number
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      this.showNotification(options)
    }, delayMs)
  }

  static isSupported(): boolean {
    return 'Notification' in window
  }

  static getPermission(): NotificationPermission {
    return ('Notification' in window) ? Notification.permission : 'denied'
  }
}
