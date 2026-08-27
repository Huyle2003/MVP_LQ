import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { checkPassword, markUnlocked } from './unlockGate';

interface Props {
  onUnlock: () => void;
}

export default function UnlockScreen({ onUnlock }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (checkPassword(value)) {
      markUnlocked();
      setError('');
      onUnlock();
    } else {
      setError('Mật khẩu không đúng, vui lòng thử lại.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Nhập mật khẩu</Text>
        <Text style={styles.subtitle}>Chỉ cần nhập đúng 1 lần sau khi cài app.</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => {
            setValue(t);
            if (error) setError('');
          }}
          placeholder="Nhập mật khẩu"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Xác nhận</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  error: { color: '#dc2626', fontSize: 12, marginTop: 8 },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
