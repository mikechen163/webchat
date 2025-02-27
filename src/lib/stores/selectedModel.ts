import { writable } from 'svelte/store';
import type { ModelConfig } from '@prisma/client';

export const selectedModel = writable<ModelConfig | null>(null);
