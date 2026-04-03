import { darkTheme, lightTheme } from '@/constants/theme';
import { useStore } from '@/hooks/useStore';

export function useAppTheme() {
  const themeMode = useStore((state) => state.themeMode);
  const setThemeMode = useStore((state) => state.setThemeMode);
  const toggleThemeMode = useStore((state) => state.toggleThemeMode);

  return {
    themeMode,
    theme: themeMode === 'light' ? lightTheme : darkTheme,
    setThemeMode,
    toggleThemeMode
  };
}
