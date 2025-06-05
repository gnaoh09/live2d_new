import {
  createContext, useContext, useState, memo, useCallback, useMemo,
} from 'react';
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch';

/**
 * Live2D model context state interface
 * @interface Live2DModelState
 */
interface Live2DModelState {
  /** Current Live2D model instance */
  currentModel: Live2DModel | null;
  /** Second Live2D model instance */
  secondModel: Live2DModel | null;

  /** Set current Live2D model */
  setCurrentModel: (model: Live2DModel | null) => void;
  /** Set second Live2D model */
  setSecondModel: (model: Live2DModel | null) => void;

  /** Update Live2D model state partially */
  updateModelState: (updates: Partial<Live2DModel>) => void;
  /** Update second Live2D model state partially */
  updateSecondModelState: (updates: Partial<Live2DModel>) => void;
}

/**
 * Default values and constants
 */
const DEFAULT_MODEL_STATE = {
  currentModel: null as Live2DModel | null,
  secondModel: null as Live2DModel | null,
};

/**
 * Create the Live2D model context
 */
const Live2DModelContext = createContext<Live2DModelState | null>(null);

/**
 * Live2D Model Provider Component
 * Manages the Live2D model instances and their state updates
 *
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export const Live2DModelProvider = memo(({ children }: { children: React.ReactNode }) => {
  // State management
  const [currentModel, setCurrentModel] = useState<Live2DModel | null>(
    DEFAULT_MODEL_STATE.currentModel,
  );
  const [secondModel, setSecondModel] = useState<Live2DModel | null>(
    DEFAULT_MODEL_STATE.secondModel,
  );

  /**
   * Update model state partially
   * @param updates - Partial updates to apply to the model
   */
  const updateModelState = useCallback((updates: Partial<Live2DModel>) => {
    setCurrentModel((prev) => {
      if (!prev) return null;
      return Object.assign(prev, updates) as Live2DModel;
    });
  }, []);

  /**
   * Update second model state partially
   * @param updates - Partial updates to apply to the second model
   */
  const updateSecondModelState = useCallback((updates: Partial<Live2DModel>) => {
    setSecondModel((prev) => {
      if (!prev) return null;
      return Object.assign(prev, updates) as Live2DModel;
    });
  }, []);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      currentModel,
      secondModel,
      setCurrentModel,
      setSecondModel,
      updateModelState,
      updateSecondModelState,
    }),
    [currentModel, secondModel, updateModelState, updateSecondModelState],
  );

  return (
    <Live2DModelContext.Provider value={contextValue}>
      {children}
    </Live2DModelContext.Provider>
  );
});

/**
 * Custom hook to use the Live2D model context
 * @throws {Error} If used outside of Live2DModelProvider
 */
export function useLive2DModel() {
  const context = useContext(Live2DModelContext);

  if (!context) {
    throw new Error('useLive2DModel must be used within a Live2DModelProvider');
  }

  return context;
}
