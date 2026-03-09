import { type Handler } from 'mitt'
import { EventBus } from './event-bus'
import type { EventBusEvents } from './event-bus-events'

type DomainBusTransform<TEvent extends keyof EventBusEvents, TPayload> = {
  toEvent: (payload: TPayload) => EventBusEvents[TEvent]
  fromEvent: (event: EventBusEvents[TEvent]) => TPayload
}

export type DomainBus<TPayload> = {
  emit: (payload: TPayload) => void
  subscribe: (listener: (payload: TPayload) => void) => () => void
}

/**
 * Builds a typed domain bus over the shared in-process EventBus.
 * Allows each domain to expose payload-only APIs while storing richer event envelopes.
 */
export const createDomainBus = <TEvent extends keyof EventBusEvents, TPayload>(
  eventType: TEvent,
  transform: DomainBusTransform<TEvent, TPayload>
): DomainBus<TPayload> => {
  return {
    emit(payload: TPayload): void {
      EventBus.emit(eventType, transform.toEvent(payload))
    },
    subscribe(listener: (payload: TPayload) => void): () => void {
      const wrapped: Handler<EventBusEvents[TEvent]> = (event) => {
        listener(transform.fromEvent(event))
      }

      EventBus.on(eventType, wrapped)
      return () => {
        EventBus.off(eventType, wrapped)
      }
    }
  }
}
