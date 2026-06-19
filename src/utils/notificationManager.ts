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
  private static requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications')
      return Promise.resolve('denied')
    }

    if (Notification.permission === 'granted') {
      return Promise.resolve('granted')
    }

    if (Notification.permission !== 'denied') {
      return Notification.requestPermission()
    }

    return Promise.resolve('denied')
  }

  static async showNotification(options: NotificationOptions): Promise<void> {
    const permission = await this.requestPermission()
    
    if (permission === 'granted') {
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
