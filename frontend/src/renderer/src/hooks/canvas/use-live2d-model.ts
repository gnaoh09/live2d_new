/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
import { useEffect, useRef, useCallback, useState } from "react";
import * as PIXI from "pixi.js";
import {
  Live2DModel,
  MotionPreloadStrategy,
  MotionPriority,
} from "pixi-live2d-display-lipsyncpatch";
import {
  ModelInfo,
  useLive2DConfig,
  MotionWeightMap,
  TapMotionMap,
} from "@/context/live2d-config-context";
import { useLive2DModel as useModelContext } from "@/context/live2d-model-context";
import { setModelSize, resetModelPosition } from "./use-live2d-resize";
import { audioTaskQueue } from "@/utils/task-queue";
import { AiStateEnum, useAiState } from "@/context/ai-state-context";
import { toaster } from "@/components/ui/toaster";
import { useForceIgnoreMouse } from "../utils/use-force-ignore-mouse";

interface UseLive2DModelProps {
  isPet: boolean; // Whether the model is in pet mode
  modelInfo: ModelInfo | undefined; // Live2D model configuration information
  modelIndex?: number; // 0 for first model, 1 for second model
}

export const useLive2DModel = ({
  isPet,
  modelInfo,
  modelIndex = 0,
}: UseLive2DModelProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const kScaleRef = useRef<string | number | undefined>(undefined);
  const { setCurrentModel, setSecondModel } = useModelContext();
  const { setIsLoading } = useLive2DConfig();
  const loadingRef = useRef(false);
  const { setAiState, aiState } = useAiState();
  const [isModelReady, setIsModelReady] = useState(false);
  const { forceIgnoreMouse } = useForceIgnoreMouse();
  const modelUrlRef = useRef<string | undefined>(undefined);

  const stableProps = useRef({
    isPet,
    modelInfo,
    modelIndex,
    setCurrentModel,
    setSecondModel,
    setIsLoading,
    setAiState,
    aiState,
    forceIgnoreMouse
  });

  useEffect(() => {
    stableProps.current = {
      isPet,
      modelInfo,
      modelIndex,
      setCurrentModel,
      setSecondModel,
      setIsLoading,
      setAiState,
      aiState,
      forceIgnoreMouse
    };
  });

  // Cleanup function for Live2D model
  const cleanupModel = useCallback(() => {
    if (modelRef.current) {
      modelRef.current.removeAllListeners();
      const { modelIndex: mi, setCurrentModel: setCM, setSecondModel: setSM } = stableProps.current;
      if (mi === 0) {
        setCM(null);
      } else {
        setSM(null);
      }
      if (appRef.current) {
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
        modelRef.current = null;
      }
    }
    setIsModelReady(false);
  }, []);

  // Cleanup function for PIXI application
  const cleanupApp = useCallback(() => {
    if (appRef.current) {
      if (modelRef.current) {
        cleanupModel();
      }
      appRef.current.stage.removeChildren();
      PIXI.utils.clearTextureCache();
      appRef.current.renderer.clear();
      appRef.current.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
      });
      PIXI.utils.destroyTextureCache();
      appRef.current = null;
    }
  }, [cleanupModel]);

  // Initialize PIXI application with canvas (only once)
  useEffect(() => {
    if (!appRef.current && canvasRef.current) {
      const app = new PIXI.Application({
        view: canvasRef.current, // cavas element to render on
        autoStart: true,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0, // transparent background
        antialias: true, // antialiasing
        clearBeforeRender: true, // clear before render
        preserveDrawingBuffer: false, // don't preserve drawing buffer
        powerPreference: "high-performance", // high performance, use GPU if available
        resolution: window.devicePixelRatio || 1,
        autoDensity: true, // auto adjust resolution to fit the screen
      });

      // Render on every frame
      app.ticker.add(() => {
        if (app.renderer) {
          app.renderer.render(app.stage);
        }
      });

      appRef.current = app;
    }

    return () => {
      cleanupApp();
    };
  }, [cleanupApp]);

  const setupModel = useCallback(
    async (model: Live2DModel) => {
      if (!appRef.current) return;

      if (modelRef.current) {
        modelRef.current.removeAllListeners();
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
      }

      modelRef.current = model;
      const { modelIndex: mi, setCurrentModel: setCM, setSecondModel: setSM } = stableProps.current;
      if (mi === 0) {
        setCM(model);
      } else {
        setSM(model);
      }
      appRef.current.stage.addChild(model);

      model.interactive = true;
      model.cursor = "pointer";
      setIsModelReady(true);
    },
    []
  );

  const setupModelSizeAndPosition = useCallback(() => {
    if (!modelRef.current) return;
    setModelSize(modelRef.current, kScaleRef.current);

    const { isPet: ip, modelInfo: mi } = stableProps.current;
    const { width, height } = ip
      ? { width: window.innerWidth, height: window.innerHeight }
      : containerRef.current?.getBoundingClientRect() || {
        width: 0,
        height: 0,
      };

    resetModelPosition(modelRef.current, width, height, mi?.initialXshift, mi?.initialYshift);
  }, []);

  // Load Live2D model with configuration
  const loadModel = useCallback(async () => {
    const { modelInfo: mi, setIsLoading: setIL, setAiState: setAS, aiState: as } = stableProps.current;
    if (!mi?.url || !appRef.current) {
      console.log('Cannot load model:', {
        hasUrl: !!mi?.url,
        hasApp: !!appRef.current
      });
      return;
    }
    if (loadingRef.current) {
      console.log('Model is already loading');
      return;
    }
    if (modelUrlRef.current === mi.url && modelRef.current) {
      console.log('Model URL has not changed, skipping load');
      return;
    }

    console.log('Loading model:', {
      url: mi.url,
      modelInfo: {
        ...mi,
        url: mi.url
      }
    });
    modelUrlRef.current = mi.url;

    try {
      loadingRef.current = true;
      setIL(true);
      setAS(AiStateEnum.LOADING);

      console.log('Creating Live2D model with config:', {
        autoHitTest: true,
        autoFocus: mi.pointerInteractive ?? false,
        autoUpdate: true,
        motionPreload: MotionPreloadStrategy.IDLE,
        idleMotionGroup: mi.idleMotionGroupName
      });

      const model = await Live2DModel.from(mi.url, {
        autoHitTest: true,
        autoFocus: mi.pointerInteractive ?? false,
        autoUpdate: true,
        ticker: PIXI.Ticker.shared,
        motionPreload: MotionPreloadStrategy.IDLE,
        idleMotionGroup: mi.idleMotionGroupName
      });

      console.log('Model created successfully, setting up...');
      await setupModel(model);
      console.log('Model setup complete');
    } catch (error) {
      console.error('Failed to load Live2D model:', error);
      toaster.create({
        title: `Failed to load Live2D model: ${error}`,
        type: 'error',
        duration: 2000
      });
    } finally {
      loadingRef.current = false;
      setIL(false);
      if (stableProps.current.aiState === AiStateEnum.LOADING) {
        setAS(AiStateEnum.IDLE);
      }
    }
  }, [setupModel]);

  const handleTapMotion = useCallback(
    (model: Live2DModel, x: number, y: number) => {
      const { modelInfo: mi } = stableProps.current;
      if (!mi?.tapMotions) return;

      console.log('handleTapMotion', mi?.tapMotions);
      // Convert global coordinates to model's local coordinates
      const localPos = model.toLocal(new PIXI.Point(x, y));
      const hitAreas = model.hitTest(localPos.x, localPos.y);

      const foundMotion = hitAreas.find((area) => {
        const motionGroup = mi?.tapMotions?.[area];
        if (motionGroup) {
          console.log(`Found motion group for area ${area}:`, motionGroup);
          playRandomMotion(model, motionGroup);
          return true;
        }
        return false;
      });

      if (!foundMotion && Object.keys(mi.tapMotions).length > 0) {
        const mergedMotions = getMergedMotionGroup(mi.tapMotions);
        playRandomMotion(model, mergedMotions);
      }
    },
    []
  );

  const setupModelInteractions = useCallback(
    (model: Live2DModel) => {
      if (!model) return;

      // Clear all previous listeners
      model.removeAllListeners("pointerenter");
      model.removeAllListeners("pointerleave");
      model.removeAllListeners("rightdown");
      model.removeAllListeners("pointerdown");
      model.removeAllListeners("pointermove");
      model.removeAllListeners("pointerup");
      model.removeAllListeners("pointerupoutside");

      const { forceIgnoreMouse: fim, isPet: ip } = stableProps.current;
      // If force ignore mouse is enabled, disable interaction
      if (fim && ip) {
        model.interactive = false;
        model.cursor = "default";
        return;
      }

      // Enable interactions
      model.interactive = true;
      model.cursor = "pointer";

      let dragging = false;
      let pointerX = 0;
      let pointerY = 0;
      let isTap = false;
      const dragThreshold = 5;

      if (ip) {
        model.on("pointerenter", () => {
          (window.api as any)?.updateComponentHover("live2d-model", true);
        });

        model.on("pointerleave", () => {
          if (!dragging) {
            (window.api as any)?.updateComponentHover("live2d-model", false);
          }
        });

        model.on("rightdown", (e: any) => {
          e.data.originalEvent.preventDefault();
          (window.api as any).showContextMenu();
        });
      }

      model.on("pointerdown", (e) => {
        if (e.button === 0) {
          dragging = true;
          isTap = true;
          pointerX = e.global.x - model.x;
          pointerY = e.global.y - model.y;
        }
      });

      model.on("pointermove", (e) => {
        if (dragging) {
          const newX = e.global.x - pointerX;
          const newY = e.global.y - pointerY;
          const dx = newX - model.x;
          const dy = newY - model.y;

          if (Math.hypot(dx, dy) > dragThreshold) {
            isTap = false;
          }

          model.position.x = newX;
          model.position.y = newY;
        }
      });

      model.on("pointerup", (e) => {
        if (dragging) {
          dragging = false;
          if (isTap) {
            handleTapMotion(model, e.global.x, e.global.y);
          }
        }
      });

      model.on("pointerupoutside", () => {
        dragging = false;
      });
    },
    [handleTapMotion]
  );

  // Reset expression when AI state changes to IDLE (like finishing a conversation)
  useEffect(() => {
    if (aiState === AiStateEnum.IDLE) {
      const { modelInfo: mi } = stableProps.current;
      console.log('defaultEmotion: ', mi?.defaultEmotion);
      if (mi?.defaultEmotion) {
        modelRef.current?.internalModel.motionManager.expressionManager?.setExpression(
          mi.defaultEmotion
        );
      } else {
        modelRef.current?.internalModel.motionManager.expressionManager?.resetExpression();
      }
    }
  }, [aiState]);

  // Load model when URL changes and cleanup on unmount
  useEffect(() => {
    if (modelInfo?.url) {
      loadModel();
    }
    return () => {
      cleanupModel();
    };
  }, [modelInfo?.url, loadModel, cleanupModel]);

  useEffect(() => {
    kScaleRef.current = modelInfo?.kScale;
  }, [modelInfo?.kScale]);

  useEffect(() => {
    setupModelSizeAndPosition();
  }, [isModelReady, setupModelSizeAndPosition]);

  useEffect(() => {
    if (modelRef.current && isModelReady) {
      setupModelInteractions(modelRef.current);
    }
  }, [modelRef.current, isModelReady, setupModelInteractions]);

  return {
    canvasRef,
    appRef,
    modelRef,
    containerRef,
  };
};

const playRandomMotion = (model: Live2DModel, motionGroup: MotionWeightMap) => {
  if (!motionGroup || Object.keys(motionGroup).length === 0) return;

  const totalWeight = Object.values(motionGroup).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  Object.entries(motionGroup).find(([motion, weight]) => {
    random -= weight;
    if (random <= 0) {
      const priority = audioTaskQueue.hasTask()
        ? MotionPriority.NORMAL
        : MotionPriority.FORCE;

      console.log(
        `Playing weighted motion: ${motion} (weight: ${weight}/${totalWeight}, priority: ${priority})`,
      );
      model.motion(motion, undefined, priority);
      return true;
    }
    return false;
  });
};

const getMergedMotionGroup = (
  tapMotions: TapMotionMap,
): MotionWeightMap => {
  const mergedMotions: {
    [key: string]: { total: number; count: number };
  } = {};

  Object.values(tapMotions)
    .flatMap((motionGroup) => Object.entries(motionGroup))
    .reduce((acc, [motion, weight]) => {
      if (!acc[motion]) {
        acc[motion] = { total: 0, count: 0 };
      }
      acc[motion].total += weight;
      acc[motion].count += 1;
      return acc;
    }, mergedMotions);

  return Object.entries(mergedMotions).reduce(
    (acc, [motion, { total, count }]) => ({
      ...acc,
      [motion]: total / count,
    }),
    {} as MotionWeightMap,
  );
};
