import { useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  displayValue?: string;
}

/** Drag-based slider (no third-party dependency) — mirrors the <input type="range">
 * sliders in the web app's toolbar, which plain numeric text fields didn't.
 *
 * Tracks drag via gesture.dx (delta from gesture start), the same technique
 * DraggableLayer already uses successfully — locationX (absolute position
 * within the touch target) is a known-flaky source on Android inside
 * PanResponder move handlers and was causing the thumb to jump around
 * instead of tracking the finger smoothly. */
export default function SliderField({ label, value, min, max, step = 1, onChange, displayValue }: Props) {
  const trackWidthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const dragStartValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const rangeRef = useRef({ min, max, step });
  rangeRef.current = { min, max, step };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        dragStartValueRef.current = valueRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const w = trackWidthRef.current;
        if (w <= 0) return;
        const { min: lo, max: hi, step: st } = rangeRef.current;
        const deltaValue = (gesture.dx / w) * (hi - lo);
        let v = dragStartValueRef.current + deltaValue;
        v = Math.round(v / st) * st;
        v = Math.min(hi, Math.max(lo, v));
        onChangeRef.current(v);
      },
      // Claim the responder immediately on touch-start (Capture variants)
      // and refuse to give it back — without this, Android's ScrollView
      // ancestor intercepts the touch mid-drag (native scroll "steals" it),
      // which is what made the thumb jump around instead of tracking smoothly.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  const pct = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{displayValue ?? String(value)}</Text>
      </View>
      <View
        style={styles.track}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackBase} />
        <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
        <View style={[styles.thumb, { left: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minWidth: 120 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  fieldValue: { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' },
  track: { height: 28, justifyContent: 'center' },
  trackBase: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: '#2563eb' },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    marginLeft: -9,
    top: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
