import { useState, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: {
    filter?: (value: T) => T
  },
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsedValue = item ? JSON.parse(item) : initialValue;
      return options?.filter ? options.filter(parsedValue) : parsedValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      const filteredValue = options?.filter ? options.filter(valueToStore) : valueToStore;
      
      // Only update if the values are different
      if (JSON.stringify(filteredValue) !== JSON.stringify(storedValue)) {
        setStoredValue(filteredValue);
        window.localStorage.setItem(key, JSON.stringify(filteredValue));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, options, storedValue]);

  return [storedValue, setValue] as const;
}
