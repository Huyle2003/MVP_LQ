import { ReactNode, useRef } from 'react';
import { PanResponder, StyleProp, View, ViewStyle } from 'react-native';

interface Props {
  x: number;
  y: number;
  scale: number;
  onMove: (x: number, y: number) => void;
  onPress?: () => void;
  /** Fired when a drag gesture starts/ends — lets the parent screen pause its
   * own ScrollView(s) so they can't steal the gesture mid-drag on Android. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Position-only drag surface (mirrors the pointer-event dragging in the web
 * app's SkinBoardEditor.jsx — size/scale/etc are edited via the toolbar, not
 * gestures). The PanResponder is created once via useRef and reads
 * position/scale/callbacks through refs so it never goes stale across
 * re-renders without needing to be rebuilt mid-gesture.
 *
 * Nested inside a ScrollView, Android's native scroll can otherwise "steal"
 * the touch mid-gesture (the classic PanResponder-inside-ScrollView jumping
 * bug). onShouldBlockNativeResponder + onPanResponderTerminationRequest keep
 * this responder locked once a drag has actually started.
 */
export default function DraggableLayer({ x, y, scale, onMove, onPress, onDragStart, onDragEnd, style, children }: Props) {
  const posRef = useRef({ x, y });
  posRef.current = { x, y };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const dragStart = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        onPressRef.current?.();
        dragStart.current = { ...posRef.current };
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_, gesture) => {
        const s = scaleRef.current || 1;
        onMoveRef.current(dragStart.current.x + gesture.dx / s, dragStart.current.y + gesture.dy / s);
      },
      onPanResponderRelease: () => {
        onDragEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        onDragEndRef.current?.();
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  return (
    <View style={[{ position: 'absolute', left: x * scale, top: y * scale }, style]} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
