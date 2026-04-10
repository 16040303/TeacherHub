import {
  getSettings,
  setLanguageSetting,
  setThemeSetting,
  updateSettings,
} from '../repositories/settingsRepository';

export const settingsService = {
  getSettings,
  updateSettings,
  setThemeSetting,
  setLanguageSetting,
};
