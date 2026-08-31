'use client'

import { create } from 'zustand'
import type { CommandResult } from '@/lib/chart/commandExecutor'

export type ChatRole = 'user' | 'assistant'

export type ChatEntry = {
  id: string
  role: ChatRole
  content: string
  results?: CommandResult[]
  /** Which engine produced the commands: a provider id, `demo`, or `fallback`. */
  mode?: string
  failed?: boolean
}

type AiState = {
  messages: ChatEntry[]
  isSending: boolean
  append: (entry: Omit<ChatEntry, 'id'>) => ChatEntry
  setSending: (value: boolean) => void
  reset: () => void
}

let counter = 0

export const useAiStore = create<AiState>()((set) => ({
  messages: [],
  isSending: false,
  append: (entry) => {
    const full: ChatEntry = { ...entry, id: `m${++counter}` }
    set((state) => ({ messages: [...state.messages, full] }))
    return full
  },
  setSending: (isSending) => set({ isSending }),
  reset: () => set({ messages: [] }),
}))
