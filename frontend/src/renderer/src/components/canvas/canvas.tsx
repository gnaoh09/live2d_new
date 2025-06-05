import { Box, Flex } from '@chakra-ui/react';
import Background from './background';
import Subtitle from './subtitle';
import WebSocketStatus from './ws-status';
import { Live2D } from './live2d';
import { canvasStyles } from './canvas-styles';

function Canvas(): JSX.Element {
  return (
    <Background>
      <Box {...canvasStyles.canvas.container}>
        <Flex width="100%" height="calc(100% - 100px)" position="relative">
          <Box flex="1" position="relative" height="100%">
            <Live2D isPet={false} modelIndex={0} />
          </Box>
          <Box flex="1" position="relative" height="100%">
            <Live2D isPet={false} modelIndex={1} />
          </Box>
        </Flex>
        <Box position="absolute" width="100%" bottom="0" left="0" zIndex={10}>
          <Subtitle />
        </Box>
        <WebSocketStatus />
      </Box>
    </Background>
  );
}

export default Canvas;
