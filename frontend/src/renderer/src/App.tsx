// import { StrictMode } from 'react';
import {
  Box, Flex, ChakraProvider, defaultSystem,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import Canvas from './components/canvas/canvas';
import Sidebar from './components/sidebar/sidebar';
import Footer from './components/footer/footer';
import { AiStateProvider } from './context/ai-state-context';
import { Live2DConfigProvider } from './context/live2d-config-context';
import { SubtitleProvider } from './context/subtitle-context';
import { BgUrlProvider, useBgUrl } from './context/bgurl-context';
import { layoutStyles } from './layout';
import WebSocketHandler from './services/websocket-handler';
import { CameraProvider } from './context/camera-context';
import { ChatHistoryProvider } from './context/chat-history-context';
import { CharacterConfigProvider } from './context/character-config-context';
import { Toaster } from './components/ui/toaster';
import { VADProvider } from './context/vad-context';
import { Live2D } from './components/canvas/live2d';
import TitleBar from './components/electron/title-bar';
import { Live2DModelProvider } from './context/live2d-model-context';
import { InputSubtitle } from './components/electron/input-subtitle';
import { ProactiveSpeakProvider } from './context/proactive-speak-context';
import { ScreenCaptureProvider } from './context/screen-capture-context';
import { GroupProvider } from './context/group-context';
// eslint-disable-next-line import/no-extraneous-dependencies, import/newline-after-import
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";

function BackgroundLayer() {
  const { backgroundUrl } = useBgUrl();
  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={0}
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

function App(): JSX.Element {
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  const [mode, setMode] = useState('window');
  const isElectron = window.api !== undefined;

  useEffect(() => {
    if (isElectron) {
      window.electron.ipcRenderer.on('pre-mode-changed', (_event, newMode) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.electron.ipcRenderer.send('renderer-ready-for-mode-change', newMode);
          });
        });
      });
    }
  }, [isElectron]);

  useEffect(() => {
    if (isElectron) {
      window.electron.ipcRenderer.on('mode-changed', (_event, newMode) => {
        setMode(newMode);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.electron.ipcRenderer.send('mode-change-rendered');
          });
        });
      });
    }
  }, [isElectron]);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ChakraProvider value={defaultSystem}>
      <Live2DModelProvider>
        <CameraProvider>
          <ScreenCaptureProvider>
            <CharacterConfigProvider>
              <ChatHistoryProvider>
                <AiStateProvider>
                  <ProactiveSpeakProvider>
                    <Live2DConfigProvider>
                      <SubtitleProvider>
                        <VADProvider>
                          <BgUrlProvider>
                            <GroupProvider>
                              <WebSocketHandler>
                                <Toaster />
                                {mode === 'window' ? (
                                  <>
                                    {isElectron && <TitleBar />}
                                    <Flex {...layoutStyles.appContainer}>
                                      <Box
                                        {...layoutStyles.sidebar}
                                        {...(!showSidebar && { width: '24px' })}
                                      >
                                        <Sidebar
                                          isCollapsed={!showSidebar}
                                          onToggle={() => setShowSidebar(!showSidebar)}
                                        />
                                      </Box>
                                      <Box {...layoutStyles.mainContent}>
                                        <BackgroundLayer />
                                        <Flex width="100%" height="100%" position="relative" zIndex={1}>
                                          <Box flex="1" position="relative">
                                            <Live2D isPet={false} modelIndex={0} />
                                          </Box>
                                          <Box flex="1" position="relative">
                                            <Live2D isPet={false} modelIndex={1} />
                                          </Box>
                                        </Flex>
                                        <Box
                                          {...layoutStyles.footer}
                                          {...(isFooterCollapsed
                                            && layoutStyles.collapsedFooter)}
                                        >
                                          <Footer
                                            isCollapsed={isFooterCollapsed}
                                            onToggle={() => setIsFooterCollapsed(
                                              !isFooterCollapsed,
                                            )}
                                          />
                                        </Box>
                                      </Box>
                                    </Flex>
                                  </>
                                ) : (
                                  <>
                                    <Flex width="100vw" height="100vh">
                                      <Box flex="1" position="relative">
                                        <Live2D isPet={mode === 'pet'} modelIndex={0} />
                                      </Box>
                                      <Box flex="1" position="relative">
                                        <Live2D isPet={mode === 'pet'} modelIndex={1} />
                                      </Box>
                                    </Flex>
                                    {mode === 'pet' && (
                                      <InputSubtitle isPet={mode === 'pet'} />
                                    )}
                                  </>
                                )}
                              </WebSocketHandler>
                            </GroupProvider>
                          </BgUrlProvider>
                        </VADProvider>
                      </SubtitleProvider>
                    </Live2DConfigProvider>
                  </ProactiveSpeakProvider>
                </AiStateProvider>
              </ChatHistoryProvider>
            </CharacterConfigProvider>
          </ScreenCaptureProvider>
        </CameraProvider>
      </Live2DModelProvider>
    </ChakraProvider>
  );
}
export default App;
