import { invoke } from '@tauri-apps/api/core'

export interface AppConfig {
  pdfs_directory: string
}

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    return await invoke<AppConfig>('get_config')
  },

  async updateConfig(pdfsDirectory: string): Promise<AppConfig> {
    return await invoke<AppConfig>('update_config', {
      pdfsDirectory,
    })
  },

  async selectDirectory(): Promise<string | null> {
    return await invoke<string | null>('select_directory')
  },
}
