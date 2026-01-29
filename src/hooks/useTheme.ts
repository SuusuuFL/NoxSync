import { useEffect } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  // Always enforce dark theme
  const theme: Theme = 'dark';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    // No need to store in localStorage as we enforce it
  }, []);

  // Toggle does nothing now
  const toggleTheme = () => {
    // No-op
  };

  return { theme, setTheme: () => {}, toggleTheme, isDark: true };
}
