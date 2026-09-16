import { EventEmitter } from 'node:events';

export type RealtimeEvent = { path: string; method: string };

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

export const realtimeService = {
  publish(event: RealtimeEvent) {
    emitter.emit('event', event);
  },
  subscribe(listener: (event: RealtimeEvent) => void) {
    emitter.on('event', listener);
    return () => emitter.off('event', listener);
  },
};
