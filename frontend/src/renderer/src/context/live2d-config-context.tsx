import {
  createContext, useContext, useState, useMemo, useEffect, useCallback,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useConfig } from '@/context/character-config-context';
import { toaster } from '@/components/ui/toaster';

/**
 * Model emotion mapping interface
 * @interface EmotionMap
 */
interface EmotionMap {
  [key: string]: number | string;
}

/**
 * Motion weight mapping interface
 * @interface MotionWeightMap
 */
export interface MotionWeightMap {
  [key: string]: number;
}

/**
 * Tap motion mapping interface
 * @interface TapMotionMap
 */
export interface TapMotionMap {
  [key: string]: MotionWeightMap;
}

/**
 * Live2D model information interface
 * @interface ModelInfo
 */
export interface ModelInfo {
  /** Model name */
  name?: string;

  /** Model description */
  description?: string;

  /** Model URL */
  url: string;

  /** Scale factor */
  kScale: number;

  /** Initial X position shift */
  initialXshift: number;

  /** Initial Y position shift */
  initialYshift: number;

  /** Idle motion group name */
  idleMotionGroupName?: string;

  /** Default emotion */
  defaultEmotion?: number | string;

  /** Emotion mapping configuration */
  emotionMap: EmotionMap;

  /** Enable pointer interactivity */
  pointerInteractive?: boolean;

  /** Tap motion mapping configuration */
  tapMotions?: TapMotionMap;

  /** Enable scroll to resize */
  scrollToResize?: boolean;
}

/**
 * Live2D configuration context state interface
 * @interface Live2DConfigState
 */
interface Live2DConfigState {
  modelInfo?: ModelInfo;
  secondModelInfo?: ModelInfo;
  setModelInfo: (info: ModelInfo | undefined) => void;
  setSecondModelInfo: (info: ModelInfo | undefined) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  updateModelScale: (newScale: number) => void;
  updateSecondModelScale: (newScale: number) => void;
}

/**
 * Default values and constants
 */
const DEFAULT_CONFIG = {
  modelInfo: {
    scrollToResize: true,
  } as ModelInfo | undefined,
  secondModelInfo: {
    scrollToResize: true,
  } as ModelInfo | undefined,
  isLoading: false,
};

/**
 * Create the Live2D configuration context
 */
export const Live2DConfigContext = createContext<Live2DConfigState | null>(null);

/**
 * Live2D Configuration Provider Component
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function Live2DConfigProvider({ children }: { children: React.ReactNode }) {
  const { confUid } = useConfig();

  const [isPet, setIsPet] = useState(false);
  const [isLoading, setIsLoading] = useState(DEFAULT_CONFIG.isLoading);

  useEffect(() => {
    const unsubscribe = (window.api as any)?.onModeChanged((mode: string) => {
      setIsPet(mode === "pet");
    });
    return () => unsubscribe?.();
  }, []);

  const getStorageKey = (uid: string, isPetMode: boolean, isSecondModel: boolean) => 
    `${uid}_${isPetMode ? "pet" : "window"}${isSecondModel ? "_second" : ""}`;

  const [modelInfo, setModelInfoState] = useLocalStorage<ModelInfo | undefined>(
    "modelInfo",
    DEFAULT_CONFIG.modelInfo,
    {
      filter: (value) => (value ? { ...value, url: "" } : value),
    },
  );

  const [secondModelInfo, setSecondModelInfoState] = useLocalStorage<ModelInfo | undefined>(
    "secondModelInfo",
    DEFAULT_CONFIG.secondModelInfo,
    {
      filter: (value) => (value ? { ...value, url: "" } : value),
    },
  );

  const [scaleMemory, setScaleMemory] = useLocalStorage<Record<string, number>>(
    "scale_memory",
    {},
  );

  /**
   * Updates the Live2D model information and manages model scale persistence
   * @param info - The new model information to be set
   * @param isSecondModel - Whether this is for the second model
   * @returns void
   */
  const setModelInfo = (info: ModelInfo | undefined, isSecondModel = false) => {
    // Skip if no model URL is provided (avoid localStorage modelInfo remaining)
    if (!info?.url) {
      return;
    }

    // Validate configuration UID exists
    if (!confUid) {
      console.warn("Attempting to set model info without confUid");
      toaster.create({
        title: "Attempting to set model info without confUid",
        type: "error",
        duration: 2000,
      });
      return;
    }

    const currentInfo = isSecondModel ? secondModelInfo : modelInfo;
    const setInfoState = isSecondModel ? setSecondModelInfoState : setModelInfoState;

    // Prevent unnecessary updates if model info hasn't changed
    if (JSON.stringify(info) === JSON.stringify(currentInfo)) {
      return;
    }

    if (info) {
      // Generate storage key based on confUid and mode
      const storageKey = getStorageKey(confUid, isPet, isSecondModel);
      let finalScale: number;

      // Retrieve stored scale
      const storedScale = scaleMemory[storageKey];
      if (storedScale !== undefined) {
        finalScale = storedScale;
      } else {
        finalScale = Number(info.kScale || 0.001);
        // If no stored scale, store the initial scale in memory
        setScaleMemory((prev) => ({
          ...prev,
          [storageKey]: finalScale,
        }));
      }

      console.log("finalScale", finalScale);

      setInfoState({
        ...info,
        kScale: finalScale,
      });
    }
  };

  const setSecondModelInfo = (info: ModelInfo | undefined) => {
    setModelInfo(info, true);
  };

  const updateModelScale = (newScale: number) => {
    if (!modelInfo || !confUid) return;

    const storageKey = getStorageKey(confUid, isPet, false);
    setScaleMemory((prev) => ({
      ...prev,
      [storageKey]: newScale,
    }));

    setModelInfoState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        kScale: newScale,
      };
    });
  };

  const updateSecondModelScale = (newScale: number) => {
    if (!secondModelInfo || !confUid) return;

    const storageKey = getStorageKey(confUid, isPet, true);
    setScaleMemory((prev) => ({
      ...prev,
      [storageKey]: newScale,
    }));

    setSecondModelInfoState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        kScale: newScale,
      };
    });
  };

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      modelInfo,
      secondModelInfo,
      setModelInfo,
      setSecondModelInfo,
      isLoading,
      setIsLoading,
      updateModelScale,
      updateSecondModelScale,
    }),
    [
      modelInfo,
      secondModelInfo,
      setModelInfo,
      setSecondModelInfo,
      isLoading,
      setIsLoading,
      updateModelScale,
      updateSecondModelScale,
    ],
  );

  return (
    <Live2DConfigContext.Provider value={contextValue}>
      {children}
    </Live2DConfigContext.Provider>
  );
}

/**
 * Custom hook to use the Live2D configuration context
 * @throws {Error} If used outside of Live2DConfigProvider
 */
export function useLive2DConfig() {
  const context = useContext(Live2DConfigContext);

  if (!context) {
    throw new Error('useLive2DConfig must be used within a Live2DConfigProvider');
  }

  return context;
}

// Export the provider as default
export default Live2DConfigProvider;
