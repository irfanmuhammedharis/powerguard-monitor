import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { bootstrap } from './src/core/bootstrap';
import {
  registerBackgroundEvents,
  registerBackgroundMonitor,
} from './src/services/backgroundMonitor';
import App from './App';
import { name as appName } from './app.json';

registerBackgroundMonitor();
registerBackgroundEvents();
// Start the feed and alert controller at JS start (not on first render), so they also
// run when the foreground service holds the process without any screen mounted.
bootstrap().catch(() => undefined);
AppRegistry.registerComponent(appName, () => App);
