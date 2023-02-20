import type { Subscriber, Unsubscriber } from 'svelte/store';
import type { Subscription } from 'dexie';

declare module 'dexie' {
  interface Observable<T> {
    subscribe(run: Subscriber<T>): Unsubscriber | Subscription;
  }
}