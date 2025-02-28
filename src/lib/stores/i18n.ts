import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// 创建语言store
export const language = writable(
  browser ? localStorage.getItem('preferred-language') || 'en' : 'en'
);

// 当语言改变时保存到localStorage
language.subscribe(value => {
  if (browser) {
    localStorage.setItem('preferred-language', value);
  }
});

// 翻译内容
export const translations = {
  en: {
    userPreferences: {
      title: "User Preferences",
      subtitle: "Customize your chat experience",
      profileSettings: "Profile Settings",
      username: "Username",
      displayName: "Display Name",
      displayNamePlaceholder: "How you want to be addressed",
      appearance: "Appearance",
      theme: "Theme",
      language: "Language",
      chatPreferences: "Chat Preferences",
      defaultModel: "Default AI Model",
      messageDisplay: "Message Display Options",
      showTimestamps: "Show timestamps",
      compactView: "Compact message view",
      saveButton: "Save Preferences"
    }
  },
  zh: {
    userPreferences: {
      title: "用户偏好设置",
      subtitle: "自定义您的聊天体验",
      profileSettings: "个人资料设置",
      username: "用户名",
      displayName: "显示名称",
      displayNamePlaceholder: "您希望如何被称呼",
      appearance: "外观",
      theme: "主题",
      language: "语言",
      chatPreferences: "聊天偏好",
      defaultModel: "默认 AI 模型",
      messageDisplay: "消息显示选项",
      showTimestamps: "显示时间戳",
      compactView: "紧凑消息视图",
      saveButton: "保存设置"
    }
  }
};

// 获取翻译的辅助函数
export function t(key: string, lang: string): string {
  const keys = key.split('.');
  let value = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
    if (!value) break;
  }
  
  return value || key;
}
