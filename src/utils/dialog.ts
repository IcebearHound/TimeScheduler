/**
 * 弹窗工具 - 替代原生 alert/confirm
 */
import useUIStore from '../stores/uiStore'

export function dialogAlert(message: string, title = '提示') {
  useUIStore.getState().showDialog({
    type: 'alert', title, message, variant: 'info',
  })
}

export function dialogConfirm(
  message: string,
  title = '确认操作',
  variant: 'danger' | 'warning' | 'info' = 'warning',
): Promise<boolean> {
  return new Promise((resolve) => {
    useUIStore.getState().showDialog({
      type: 'confirm', title, message, variant,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}
