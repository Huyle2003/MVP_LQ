import { ReactNode, useRef } from 'react';
import { PanResponder, StyleProp, View, ViewStyle } from 'react-native';

interface Props {
  x: number;
  y: number;
  scale: number;
  onMove: (x: number, y: number) => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Position-only drag surface (mirrors the pointer-event dragging in the web
 * app's SkinBoardEditor.jsx — size/scale/etc are edited via the toolbar, not
 * gestures). The PanResponder is created once via useRef and reads
 * position/scale/callbacks through refs so it never goes stale across
 * re-renders without needing to be rebuilt mid-gesture.
 */
export default function DraggableLayer({ x, y, scale, onMove, onPress, style, children }: Props) {
  const posRef = useRef({ x, y });
  posRef.current = { x, y };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const dragStart = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        onPressRef.current?.();
        dragStart.current = { ...posRef.current };
      },
      onPanResponderMove: (_, gesture) => {
        const s = scaleRef.current || 1;
        onMoveRef.current(dragStart.current.x + gesture.dx / s, dragStart.current.y + gesture.dy / s);
      },
    })
  ).current;

  return (
    <View style={[{ position: 'absolute', left: x * scale, top: y * scale }, style]} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
