import React, { Component, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '../theme/tokens';

interface State {
  failed: boolean;
}

/** Last line of defence: a render crash shows a recoverable screen, not a white one. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const c = palette.dark;
    return (
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <Text style={[s.title, { color: c.text }]}>Something went wrong</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={() => this.setState({ failed: false })}
          style={[s.button, { borderColor: c.info }]}
        >
          <Text style={[s.buttonText, { color: c.info }]}>TRY AGAIN</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '800' },
  button: { marginTop: 20, minHeight: 48, paddingHorizontal: 24, borderWidth: 1, borderRadius: 14, justifyContent: 'center' },
  buttonText: { fontWeight: '800', letterSpacing: 1 },
});
